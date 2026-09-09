-- =========================================================================
-- Conciliación automática con Alegra: base de datos
--
-- Contexto (AGENTS.md, "Conciliación con Alegra"): el colegio cobra en
-- Alegra POS y esos cobros no existían aquí, así que Cuentas por Cobrar
-- mostraba deuda ya pagada. El 2026-09-09 se cargaron a mano 28 cobros con
-- un script de una sola vez. Esta migración es la base para que eso pase
-- solo, todos los días, sin que nadie corra un script.
--
-- Cuatro cambios, cada uno con su motivo real:
--
-- 1) `students.student_code` pasa de `unique` GLOBAL a `unique (school_id,
--    student_code)`. Dos motivos:
--    a) La trampa que AGENTS.md ya venía avisando: con un segundo colegio
--       afiliado cuyas matrículas sigan el mismo patrón `AA-NNNN`, la
--       primera colisión revienta el alta del estudiante.
--    b) Sin esto no se puede poblar la matrícula, y la matrícula es lo que
--       vuelve confiable el emparejamiento automático: hoy la columna está
--       vacía y hay que emparejar por NOMBRE, que es frágil (el 2026-09-09,
--       4 de 34 cobros no emparejaron por una letra de diferencia:
--       Olivarez/Olivares, Morale/Morales, Andrian/Adrian, Sara/Sarha).
--       En Alegra cada estudiante YA tiene su matrícula, como
--       `client.identification` de tipo `IE`.
--
-- 2) `invoices.external_reference` -- el guardaduplicados de verdad.
--    El script del 2026-09-09 comparaba por MONTO, y por eso tuvo un punto
--    ciego real: cuando un estudiante tiene dos facturas del mismo monto y
--    solo una está cargada, saltaba las dos. Le pasó a Heather Liz (dos de
--    RD$1,950 el mismo día) y se detectó a mano. Con el e-CF guardado en
--    columna, el mismo comprobante no se puede cargar dos veces y dos
--    comprobantes distintos del mismo monto sí entran los dos.
--    El índice único incluye `student_id` a propósito: un e-CF conjunto a
--    nombre del tutor cubre a VARIOS hermanos (requisito fiscal, ver
--    AGENTS.md) y se registra como una fila por hijo.
--
-- 3) `alegra_sync_runs` -- una fila por corrida. Es lo que alimenta la
--    alerta de "última actualización" en Cuentas por Cobrar: sin registro,
--    la pantalla no puede decir con honestidad cuándo se miró Alegra por
--    última vez, ni si la última corrida falló.
--
-- 4) `alegra_payment_matches` -- la bandeja de revisión. El motor NUNCA
--    carga un cobro que necesite criterio humano; lo deja aquí. Mismo
--    principio que las bandejas de OCR y de comprobantes de pago que ya
--    existen en el proyecto: nada de dinero entra sin que alguien lo vea.
--    Medida real del 2026-09-09: de 34 cobros, 26 emparejaron exactos y 8
--    necesitaron criterio humano (24%). Un robot que "resuelva" esos 8
--    solo metería plata en el estudiante equivocado.
--
-- Idempotente: se puede volver a aplicar sin efecto.
-- =========================================================================

-- ── 1. Matrícula única POR COLEGIO, no global ───────────────────────────
-- El nombre de la restricción lo generó Postgres (`students_student_code_key`),
-- pero no se asume: se busca por introspección, mismo patrón que ya usó la
-- migración 20260823010000 con `teacher_assignments`.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'students'
      and con.contype = 'u'
      and con.conkey = array[
        (select attnum from pg_attribute
          where attrelid = rel.oid and attname = 'student_code')
      ]
  loop
    execute format('alter table students drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists idx_students_code_por_colegio
  on students (school_id, student_code)
  where student_code is not null and deleted_at is null;

-- ── 2. Referencia externa del comprobante (e-CF de Alegra) ──────────────
alter table invoices add column if not exists external_reference text;

comment on column invoices.external_reference is
  'Comprobante del sistema donde se cobró de verdad (e-CF de Alegra, ej. E320000000410). '
  'Es el guardaduplicados de la conciliación automática: el mismo comprobante nunca se '
  'carga dos veces para el mismo estudiante. NO es un NCF emitido por esta plataforma '
  '-- ncf/ncf_type siguen en null a propósito para estos registros.';

-- Backfill de los 28 cobros cargados a mano el 2026-09-09: su e-CF ya está
-- escrito dentro de la descripción ("... e-CF E320000000410 · ...").
update invoices
   set external_reference = substring(description from 'e-CF (E[0-9]+)')
 where external_reference is null
   and description like '%e-CF E%'
   and substring(description from 'e-CF (E[0-9]+)') is not null;

create unique index if not exists idx_invoices_external_reference
  on invoices (school_id, external_reference, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where external_reference is not null and deleted_at is null;

-- ── 3. Registro de cada corrida de conciliación ─────────────────────────
create table if not exists alegra_sync_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- 'ok' = corrió completa; 'error' = no pudo terminar; 'sin_credenciales'
  -- = Alegra no está configurado todavía (no es un fallo, es un pendiente).
  status text not null default 'ok'
    check (status in ('ok','error','sin_credenciales')),
  trigger_source text not null default 'cron'
    check (trigger_source in ('cron','manual')),
  -- Desde qué fecha se le pidieron facturas a Alegra en esta corrida.
  since_date date,
  invoices_seen integer not null default 0,
  loaded_count integer not null default 0,
  loaded_amount numeric(12,2) not null default 0,
  review_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_alegra_sync_runs_school
  on alegra_sync_runs (school_id, started_at desc);

-- ── 4. Bandeja de revisión: los cobros que necesitan criterio humano ────
create table if not exists alegra_payment_matches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  run_id uuid references alegra_sync_runs(id),

  -- Lo que dice Alegra, tal cual (fuente de verdad del cobro real)
  alegra_invoice_id text not null,
  alegra_number text,                 -- e-CF, ej. E320000000410
  alegra_date date not null,
  alegra_client_name text,
  alegra_client_identification text,  -- matrícula (IE) o cédula del tutor (CED)
  alegra_client_id_type text,
  alegra_note text,
  alegra_payment_method text,
  -- Solo la parte de mensualidad/abono; Libros y Uniformes no tocan
  -- Cuentas por Cobrar y no se registran como pago de mensualidad.
  amount numeric(12,2) not null,

  -- Por qué quedó aquí en vez de cargarse solo
  reason text not null
    check (reason in ('sin_emparejar','ambiguo','aproximado','posible_duplicado','conjunto')),
  -- Los estudiantes candidatos, con su puntaje -- para que quien revisa
  -- decida viendo lo mismo que vio el motor.
  candidates jsonb not null default '[]'::jsonb,

  status text not null default 'pendiente'
    check (status in ('pendiente','cargado','descartado')),
  -- Cuánto de `amount` ya quedó atribuido a un estudiante. Un e-CF
  -- conjunto de hermanos se resuelve en varias pasadas hasta cubrirlo.
  assigned_amount numeric(12,2) not null default 0,
  resolved_by uuid references users_profiles(id),
  resolved_at timestamptz,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una sola fila de bandeja por comprobante de Alegra: si la corrida de
-- mañana vuelve a ver el mismo cobro sin resolver, no lo duplica.
create unique index if not exists idx_alegra_matches_unico
  on alegra_payment_matches (school_id, alegra_invoice_id);

create index if not exists idx_alegra_matches_pendientes
  on alegra_payment_matches (school_id, status, alegra_date desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Lectura para el mismo grupo de roles que ya alcanza Tesorería (incluye
-- `reception`, ver migración 20260910010000). Escritura: ninguna policy a
-- propósito -- el motor escribe con service_role y resolver una fila de la
-- bandeja pasa por una Server Action que repite la autorización en código,
-- igual que `recordExternalPayment`.
alter table alegra_sync_runs enable row level security;
alter table alegra_payment_matches enable row level security;

drop policy if exists "alegra_sync_runs_staff_read" on alegra_sync_runs;
create policy "alegra_sync_runs_staff_read" on alegra_sync_runs
for select using (
  school_id in (
    select up.school_id from users_profiles up
    where up.auth_id = (select auth.uid())
      and up.role in ('super_admin','school_admin','director','finance','reception')
  )
);

drop policy if exists "alegra_matches_staff_read" on alegra_payment_matches;
create policy "alegra_matches_staff_read" on alegra_payment_matches
for select using (
  school_id in (
    select up.school_id from users_profiles up
    where up.auth_id = (select auth.uid())
      and up.role in ('super_admin','school_admin','director','finance','reception')
  )
);

-- Supabase no expone las tablas nuevas por sí solo (trampa ya documentada
-- en AGENTS.md con `attendance_justifications`): sin el grant, la Data API
-- responde "permission denied" aunque la RLS esté perfecta.
grant select on alegra_sync_runs to authenticated;
grant select on alegra_payment_matches to authenticated;
