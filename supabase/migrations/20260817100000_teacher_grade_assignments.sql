-- =========================================================================
-- MentorIApp — Migración 033: profesor ↔ grado/sección (segmentación real)
--
-- Hasta ahora un profesor con acceso a Asistencia/Actualizaciones veía y
-- gestionaba a TODOS los estudiantes del colegio -- el permiso solo
-- filtraba por school_id, nunca por salón. No existía ninguna tabla que
-- dijera "este profesor es responsable de este grado/sección".
--
-- teacher_assignments resuelve eso: un profesor (staff_id) puede tener
-- uno o varios grade_level asignados (mismo campo de texto libre que ya
-- usan Comunicados/Actualizaciones desde las migraciones 030/032). Las
-- policies de students/attendance/class_updates se reescriben para que
-- 'teacher' solo vea/gestione lo de sus grados asignados -- los demás
-- roles de staff (super_admin/school_admin/director/reception/finance)
-- NO cambian, siguen viendo todo el colegio.
--
-- 'teacher' también se retira por completo de la escritura de `students`
-- -- se confirmó que ningún flujo de la interfaz de profesor escribe ahí
-- (el módulo `estudiantes` ni siquiera está en su lista de permisos).
--
-- Fuera de alcance a propósito: Comunicados (lectura de avisos ya
-- publicados por otros sigue sin restringir -- un profesor debe poder
-- ver un aviso de "no hay clases mañana" aunque lo haya escrito
-- dirección), Mensajes (una familia puede tener hijos en más de un
-- grado, no mapea limpio a "mi grado"), y Academia (usa un concepto de
-- grado completamente distinto, grade_levels/enrollments, que nunca se
-- llegó a poblar -- mezclar los dos sistemas de "grado" es un cambio
-- aparte).
-- =========================================================================

create table teacher_assignments (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    staff_id uuid not null references staff(id) on delete cascade,
    grade_level text not null,
    created_at timestamptz not null default now(),
    unique (staff_id, grade_level)
);
create index idx_teacher_assignments_staff on teacher_assignments(staff_id);
create index idx_teacher_assignments_school_grade on teacher_assignments(school_id, grade_level);

alter table teacher_assignments enable row level security;

create policy "teacher_assignments_admin_manage" on teacher_assignments
for all using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director'))
) with check (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director'))
);

create policy "teacher_assignments_own_read" on teacher_assignments
for select using (
    staff_id in (select staff_id from users_profiles where auth_id = auth.uid() and staff_id is not null)
);

grant select on teacher_assignments to authenticated;
grant all privileges on teacher_assignments to service_role;

-- SECURITY DEFINER para poder consultarse desde dentro de otras policies
-- sin recursión (mismo patrón que student_school_id() de la migración 018).
create or replace function teacher_is_assigned_to_grade(p_school_id uuid, p_grade_level text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from teacher_assignments ta
        join users_profiles up on up.staff_id = ta.staff_id
        where up.auth_id = auth.uid()
          and ta.school_id = p_school_id
          and ta.grade_level = p_grade_level
    )
$$;

-- ── students: 'teacher' solo ve estudiantes de sus grados asignados,
--    y pierde el acceso de escritura por completo ─────────────────────────
drop policy if exists "students_read" on students;
create policy "students_read" on students
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'finance', 'reception')
    )
    or id in (
        select sg.student_id
        from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
    or (
        grade_level is not null
        and school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and teacher_is_assigned_to_grade(school_id, grade_level)
    )
);

drop policy if exists "students_staff_write" on students;
create policy "students_staff_write" on students
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'finance', 'reception')
    )
);

-- ── attendance: 'teacher' solo marca/ve asistencia de sus grados ────────
drop policy if exists "attendance_staff_all" on attendance;
create policy "attendance_staff_all" on attendance
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and exists (
            select 1 from students s
            where s.id = attendance.student_id
              and s.grade_level is not null
              and teacher_is_assigned_to_grade(s.school_id, s.grade_level)
        )
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and exists (
            select 1 from students s
            where s.id = attendance.student_id
              and s.grade_level is not null
              and teacher_is_assigned_to_grade(s.school_id, s.grade_level)
        )
    )
);

-- ── class_updates: 'teacher' solo administra lo de sus grados ───────────
drop policy if exists "class_updates_staff_all" on class_updates;
create policy "class_updates_staff_all" on class_updates
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and (
            (grade_level is not null and teacher_is_assigned_to_grade(school_id, grade_level))
            or (student_id is not null and exists (
                select 1 from students s
                where s.id = class_updates.student_id
                  and s.grade_level is not null
                  and teacher_is_assigned_to_grade(s.school_id, s.grade_level)
            ))
        )
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and (
            (grade_level is not null and teacher_is_assigned_to_grade(school_id, grade_level))
            or (student_id is not null and exists (
                select 1 from students s
                where s.id = class_updates.student_id
                  and s.grade_level is not null
                  and teacher_is_assigned_to_grade(s.school_id, s.grade_level)
            ))
        )
    )
);
