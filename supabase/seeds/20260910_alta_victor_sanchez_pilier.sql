-- =========================================================================
-- Alta de Victor Enmanuel Sanchez Pilier + su cobro de Alegra (2026-09-10)
--
-- Por que existe este archivo y no se hizo desde la sesion de Claude Code:
-- el clasificador de seguridad del harness bloqueo la escritura (mismo
-- bloqueo ya documentado en AGENTS.md para la carga de horarios y el arreglo
-- de cursos). Se pega tal cual en el SQL Editor de Supabase.
--
-- ALTERNATIVA, probablemente mejor: darlo de alta desde la pantalla normal
-- (/dashboard/estudiantes/nuevo, modo "Familia nueva"). El bug del boton
-- colgado en "Guardando..." ya esta corregido (PR #24): si la sesion vencio,
-- ahora lo dice en vez de quedarse mudo.
--
-- DATOS Y DE DONDE SALEN:
--   Estudiante -- de lo que tecleo Bethania en el formulario (captura del
--   2026-09-10): Victor Enmanuel / Sanchez Pilier / 17-03-2012 / Masculino /
--   Inscrito / 3ro. Secundaria.
--   Cobro -- e-CF E320000000401 de Alegra, verificado por API: 2026-09-04,
--   RD$2,250, efectivo, nota "mes de ago". La linea es Mensualidad de
--   Secundaria (RD$4,500) con 50% de descuento, o sea la media cuota de
--   agosto exacta -- cuadra con 3ro. Secundaria.
--   Matricula 16-0059 -- del contacto de Alegra. Se guarda en
--   students.student_code, que desde la migracion 20260912000000 es unico
--   POR COLEGIO y ya se puede poblar sin riesgo.
--
-- ✅ EL NOMBRE YA ESTA CONFIRMADO (2026-09-10): el usuario reviso la foto del
--    ACTA DE NACIMIENTO -- "Victor ENMANUEL" (con N) es el correcto, que es lo
--    que usa este script. Alegra lo tenia mal ("Emmanuel", con M) y el usuario
--    lo corrigio del lado de Alegra ese mismo dia. Nada que decidir aqui.
--
-- ⚠️ LO QUE SI QUEDA PENDIENTE:
--   LA FAMILIA QUEDA SIN TUTOR. `guardians` exige first_name/last_name
--      NOT NULL y no habia ningun nombre real disponible; no se invento uno.
--      El telefono que trae la factura de Alegra es 829-713-3189.
--      Agregar el tutor desde /dashboard/familias/[id]/editar en cuanto se
--      tenga el nombre -- sin tutor, esa familia no puede recibir acceso al
--      Portal Familiar ni los avisos de ausencia por correo.
--
-- Idempotente: si se corre dos veces, la segunda no inserta nada.
-- =========================================================================
begin;

with colegio as (select id from schools limit 1),
fam as (
  insert into families (school_id, name)
  select id, 'Sanchez Pilier' from colegio
   where not exists (select 1 from families
                      where name = 'Sanchez Pilier' and deleted_at is null)
  returning id, school_id
),
alumno as (
  insert into students (school_id, family_id, first_name, last_name, birth_date,
                        gender, enrollment_status, grade_level, student_code)
  select f.school_id, f.id, 'Victor Enmanuel', 'Sanchez Pilier', date '2012-03-17',
         'M', 'inscrito', '3ro. Secundaria', '16-0059'
    from fam f
  returning id, school_id, family_id
),
concepto as (
  select id from billing_concepts
   where recurrence='monthly' and name ilike '%mensualidad%' and deleted_at is null
   limit 1
),
factura as (
  -- ncf/ncf_type SIEMPRE null: el comprobante fiscal real ya lo emitio
  -- Alegra. Uno local seria un documento fantasma ante la DGII.
  insert into invoices (school_id, family_id, student_id, concept_id, description,
                        amount, tax_amount, total_amount, due_date, status, paid_at,
                        ncf, ncf_type, external_reference)
  select a.school_id, a.family_id, a.id, c.id,
         'Mensualidad — cobro ya registrado (Alegra (POS)): e-CF E320000000401 · cash · mes de ago',
         2250.00, 0, 2250.00, date '2026-09-04', 'pagado',
         timestamptz '2026-09-04 00:00:00-04', null, null, 'E320000000401'
    from alumno a cross join concepto c
   where not exists (select 1 from invoices
                      where external_reference='E320000000401' and deleted_at is null)
  returning id, school_id, total_amount, paid_at
)
insert into payments (school_id, invoice_id, amount_paid, payment_method, paid_at, notes)
select f.school_id, f.id, f.total_amount, 'alegra', f.paid_at,
       'e-CF E320000000401 · cash · mes de ago (media cuota agosto Secundaria)'
  from factura f;

commit;

-- ── Comprobacion (pegar despues; debe devolver 1 fila) ──────────────────
-- select s.first_name||' '||s.last_name as estudiante, s.student_code, s.grade_level,
--        f.name as familia,
--        (select count(*) from guardians g where g.family_id=f.id) as tutores,
--        i.total_amount, i.status, i.external_reference, i.ncf, p.payment_method
--   from students s join families f on f.id=s.family_id
--   left join invoices i on i.student_id=s.id and i.deleted_at is null
--   left join payments p on p.invoice_id=i.id
--  where s.last_name='Sanchez Pilier' and s.deleted_at is null;

-- ── REVERSION (por si hay que deshacerlo) ───────────────────────────────
-- begin;
--   delete from payments where invoice_id in
--     (select id from invoices where external_reference='E320000000401');
--   delete from invoices where external_reference='E320000000401';
--   delete from students where last_name='Sanchez Pilier' and first_name='Victor Enmanuel';
--   delete from families where name='Sanchez Pilier';
-- commit;
