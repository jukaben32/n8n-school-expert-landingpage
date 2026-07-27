-- =========================================================================
-- SCHOOLOS — Migración 018: rompe la recursión infinita de RLS entre
-- students <-> student_guardians (bug crítico: bloqueaba crear estudiantes)
--
-- Diagnosticado con evidencia real (llamada REST directa a
-- POST /rest/v1/students con JWT de una usuaria real de producción):
-- HTTP 500, código Postgres 42P17 "infinite recursion detected in
-- policy for relation students".
--
-- El ciclo: "students_read" (migración 001) consulta student_guardians
-- para el caso "soy guardian de este estudiante". Las políticas de
-- student_guardians (migración 014) consultan de vuelta a students
-- ("student_id in (select id from students where school_id in (...))").
-- students -> student_guardians -> students = recursión infinita.
--
-- Mismo patrón de solución que la migración 009 (recursión de
-- users_profiles): una función SECURITY DEFINER que resuelve el
-- school_id de un estudiante sin volver a pasar por las policies de
-- students, rompiendo el ciclo.
-- =========================================================================

create or replace function student_school_id(p_student_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
    select school_id from students where id = p_student_id limit 1
$$;

drop policy if exists "student_guardians_staff_all" on student_guardians;
create policy "student_guardians_staff_all" on student_guardians
for all using (
    student_school_id(student_id) in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','reception')
    )
);

drop policy if exists "student_guardians_read" on student_guardians;
create policy "student_guardians_read" on student_guardians
for select using (
    student_school_id(student_id) in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','finance','reception')
    )
);

-- ── Backfill: estudiantes que quedaron sin vínculo a su tutor por este
--    bug (confirmado en producción: 3 estudiantes de la familia
--    "Del Rosario Casilla" -- ya reparados a mano el mismo día que se
--    encontró el bug, este backfill es solo un cierre de seguridad
--    por si queda algún otro caso sin detectar) ──────────────────────────
insert into student_guardians (student_id, guardian_id, relationship, is_primary)
select s.id, g.id, coalesce(g.relationship, 'tutor_legal'), true
from students s
join families f on f.id = s.family_id
join guardians g on g.family_id = f.id and g.is_primary = true
where not exists (
    select 1 from student_guardians sg where sg.student_id = s.id
)
on conflict do nothing;
