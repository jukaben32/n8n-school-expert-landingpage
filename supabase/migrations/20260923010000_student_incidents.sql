-- =========================================================================
-- MentorIApp — Registro de incidencias en el aula (2026-09-23)
--
-- Reemplaza la ficha en papel "Registro de Incidencia y Seguimiento
-- Conductual" del colegio: el docente la llena en la plataforma y
-- dirección/gestión ve todos los casos y registra el seguimiento.
--
-- Quién ve qué:
--   - Dirección (super_admin / school_admin / director): todo su colegio,
--     y es la única que registra el seguimiento (estado + notas).
--   - Docente: lo que él mismo reportó, y los casos de los cursos que tiene
--     asignados (teacher_is_assigned_to_grade, SIEMPRE con 3 argumentos y
--     'regular' -- la versión de 2 argumentos es ambigua, ver AGENTS.md).
--     Orientación (asignada a "todo el colegio") ve todos los casos.
--   - Tutores y estudiantes: NINGUNA policy. Es un expediente interno; a la
--     familia se le notifica por los canales de siempre.
--
-- No hay policy de delete: una incidencia registrada no se borra.
-- =========================================================================

-- Curso actual del estudiante, sin pasar por las policies de `students`
-- (mismo motivo que student_school_id(): evitar sorpresas de RLS dentro de
-- otra policy). Nombre nuevo a propósito -- nada de sobrecargas.
create or replace function incident_student_grade(p_student_id uuid, p_school_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
    select s.grade_level from students s
    where s.id = p_student_id and s.school_id = p_school_id and s.deleted_at is null
$$;
revoke execute on function incident_student_grade(uuid, uuid) from public;
revoke execute on function incident_student_grade(uuid, uuid) from anon;
grant execute on function incident_student_grade(uuid, uuid) to authenticated, service_role;

create table if not exists student_incidents (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    student_id uuid not null references students(id),
    grade_level text, -- curso del estudiante al momento del reporte
    incident_date date not null,
    incident_time time,
    location text not null check (location in ('aula', 'recreo', 'pasillo', 'otro')),
    location_other text,
    severity text not null check (severity in ('leve', 'grave', 'muy_grave')),
    description text not null check (length(trim(description)) > 0),
    measures text[] not null default '{}'
        check (measures <@ array['dialogo', 'amonestacion', 'orientacion', 'citacion_padres', 'reparacion']::text[]),
    student_heard boolean not null default false, -- "He sido escuchado"
    reported_by uuid not null references users_profiles(id),
    reporter_name text not null,
    status text not null default 'abierto' check (status in ('abierto', 'en_seguimiento', 'cerrado')),
    follow_up_notes text,
    reviewed_by uuid references users_profiles(id),
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_student_incidents_school on student_incidents(school_id, incident_date desc);
create index if not exists idx_student_incidents_student on student_incidents(student_id, incident_date desc);

alter table student_incidents enable row level security;

drop policy if exists "student_incidents_manager_read" on student_incidents;
create policy "student_incidents_manager_read" on student_incidents
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "student_incidents_teacher_read" on student_incidents;
create policy "student_incidents_teacher_read" on student_incidents
for select using (
    exists (
        select 1 from users_profiles up
        where up.auth_id = auth.uid() and up.role = 'teacher' and up.school_id = student_incidents.school_id
    )
    and (
        reported_by in (select id from users_profiles where auth_id = auth.uid())
        or teacher_is_assigned_to_grade(school_id, grade_level, 'regular')
    )
);

-- Reportar: solo en nombre propio, en su colegio, con el curso REAL del
-- estudiante, y el docente solo para estudiantes de sus cursos asignados.
drop policy if exists "student_incidents_insert" on student_incidents;
create policy "student_incidents_insert" on student_incidents
for insert with check (
    exists (
        select 1 from users_profiles up
        where up.auth_id = auth.uid()
          and up.id = student_incidents.reported_by
          and up.school_id = student_incidents.school_id
          and (
              up.role in ('super_admin', 'school_admin', 'director')
              or (up.role = 'teacher' and teacher_is_assigned_to_grade(student_incidents.school_id, student_incidents.grade_level, 'regular'))
          )
    )
    and grade_level is not distinct from incident_student_grade(student_id, school_id)
    and incident_student_grade(student_id, school_id) is not null
    and status = 'abierto'
    and reviewed_by is null
    and follow_up_notes is null
);

-- Seguimiento: solo dirección.
drop policy if exists "student_incidents_manager_update" on student_incidents;
create policy "student_incidents_manager_update" on student_incidents
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "student_incidents_super_admin" on student_incidents;
create policy "student_incidents_super_admin" on student_incidents
for select using (is_super_admin());

grant select, insert, update on student_incidents to authenticated;
grant all privileges on student_incidents to service_role;
