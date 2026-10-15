-- Cuentas de Amco / Excellent por estudiante (año escolar 2026-2027).
--
-- Amco (el área de Inglés del colegio) le crea a cada estudiante un correo
-- propio que le sirve de usuario en la plataforma Excellent, donde toma sus
-- evaluaciones de inglés. El correo vale todo el período escolar. Este dato
-- NO vive en `students` a propósito: es de un proveedor externo, se carga por
-- lotes (la supervisora lo envía por cursos) y se renueva cada año.
--
-- Solo lo lee el personal de dirección. Las familias lo reciben por correo
-- (ver /api/cron/amco-excellent) y el asistente de IA lo consulta con el
-- cliente de servicio, filtrado por la familia -- nunca hay una policy de
-- lectura para tutores o estudiantes.

create table if not exists amco_student_accounts (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    school_year text not null default '2026-2027',
    -- null mientras no se haya emparejado con un estudiante del sistema
    student_id uuid references students(id) on delete set null,
    -- tal como vino en la lista de Amco (los nombres traen faltas de ortografía)
    source_full_name text not null,
    source_grade text not null,
    email text not null,
    match_method text not null default 'sin_emparejar'
        check (match_method in ('sin_emparejar', 'nombre_exacto', 'nombre_contenido', 'manual')),
    -- lote de envío: 1 = 3ro Primaria a 6to Secundaria; el siguiente lote
    -- (1ro-2do Primaria, Inicial) se carga cuando Amco lo confirme
    batch integer not null default 1,
    -- no se envía nada antes de esta hora (8:00 am hora RD = 12:00 UTC)
    send_after timestamptz not null default '2026-10-16 12:00:00+00',
    created_at timestamptz not null default now()
);

create unique index if not exists uq_amco_accounts_source
    on amco_student_accounts (school_id, school_year, source_grade, lower(email));
create unique index if not exists uq_amco_accounts_student
    on amco_student_accounts (school_id, school_year, student_id) where student_id is not null;
create index if not exists idx_amco_accounts_student on amco_student_accounts (student_id);

-- Un envío por familia y lote. Es la guarda contra mandar dos veces el mismo
-- correo si la tarea se dispara más de una vez (se programa en 3 horarios).
create table if not exists amco_access_dispatches (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    family_id uuid not null references families(id) on delete cascade,
    school_year text not null default '2026-2027',
    batch integer not null default 1,
    status text not null check (status in ('enviando', 'enviado', 'sin_correo', 'error')),
    recipient text,
    detail text,
    attempted_at timestamptz not null default now(),
    unique (school_id, family_id, school_year, batch)
);

alter table amco_student_accounts enable row level security;
alter table amco_access_dispatches enable row level security;

drop policy if exists amco_accounts_director_read on amco_student_accounts;
create policy amco_accounts_director_read on amco_student_accounts
    for select to authenticated
    using (
        is_super_admin()
        or (
            school_id = auth_profile_school_id()
            and auth_profile_role() in ('school_admin', 'director', 'reception')
        )
    );

drop policy if exists amco_dispatches_director_read on amco_access_dispatches;
create policy amco_dispatches_director_read on amco_access_dispatches
    for select to authenticated
    using (
        is_super_admin()
        or (
            school_id = auth_profile_school_id()
            and auth_profile_role() in ('school_admin', 'director', 'reception')
        )
    );

grant select on amco_student_accounts, amco_access_dispatches to authenticated;
-- Todas las escrituras pasan por el cliente de servicio (cron y seeds).
revoke insert, update, delete on amco_student_accounts, amco_access_dispatches from anon, authenticated;
revoke all on amco_student_accounts, amco_access_dispatches from anon;
