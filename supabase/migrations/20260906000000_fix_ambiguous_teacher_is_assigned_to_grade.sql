-- =========================================================================
-- MentorIApp — Corrige llamada ambigua a teacher_is_assigned_to_grade()
--
-- Reporte real del colegio (2026-09-03): ningún profesor pudo pasar lista
-- en todo el día -- 0 registros de asistencia, cuando en cualquier otro
-- día ya había filas desde las 7:50-8:30am.
--
-- Causa: desde la migración 20260823010000 existe una sobrecarga nueva de
-- teacher_is_assigned_to_grade(uuid, text, text default 'regular') junto
-- a la original de 2 argumentos (migración 20260817100000). Con las dos
-- coexistiendo, Postgres ya no puede resolver una llamada de 2 argumentos
-- -- ni siquiera con los tipos exactos -- y falla con:
--
--   ERROR: function teacher_is_assigned_to_grade(uuid, text) is not unique
--
-- La política "students_read" (migración 20260821060000) y
-- "class_schedules_staff_read" ya se habían corregido a 3 argumentos
-- explícitos por este mismo motivo -- pero las policies de asistencia
-- (attendance_staff_all, creada en 20260817100000) y actualizaciones
-- (class_updates_staff_all, misma migración) nunca se tocaron después de
-- que la sobrecarga apareciera, así que quedaron rotas para CUALQUIER
-- profesor que intentara leer o escribir esas dos tablas.
--
-- Fix: mismo patrón ya usado en las otras dos -- 3 argumentos explícitos
-- con 'regular' (el valor que ya traía el default). No cambia a quién
-- deja pasar la policy, solo desambigua la llamada.
-- =========================================================================

alter policy "attendance_staff_all" on attendance
using (
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
              and teacher_is_assigned_to_grade(s.school_id, s.grade_level, 'regular')
        )
    )
)
with check (
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
              and teacher_is_assigned_to_grade(s.school_id, s.grade_level, 'regular')
        )
    )
);

alter policy "class_updates_staff_all" on class_updates
using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and (
            (grade_level is not null and teacher_is_assigned_to_grade(school_id, grade_level, 'regular'))
            or (student_id is not null and exists (
                select 1 from students s
                where s.id = class_updates.student_id
                  and s.grade_level is not null
                  and teacher_is_assigned_to_grade(s.school_id, s.grade_level, 'regular')
            ))
        )
    )
)
with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and (
            (grade_level is not null and teacher_is_assigned_to_grade(school_id, grade_level, 'regular'))
            or (student_id is not null and exists (
                select 1 from students s
                where s.id = class_updates.student_id
                  and s.grade_level is not null
                  and teacher_is_assigned_to_grade(s.school_id, s.grade_level, 'regular')
            ))
        )
    )
);
