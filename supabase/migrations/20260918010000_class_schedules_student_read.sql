-- =========================================================================
-- Horarios: el estudiante puede leer el horario de SU curso.
--
-- class_schedules ya tenía lectura para staff y para guardian
-- (class_schedules_guardian_read, migración 20260821010000), pero nunca
-- para el rol student (login propio desde 20260905000000_acceso_estudiantes)
-- -- sin esta policy, `select` sobre class_schedules devuelve 0 filas para
-- un estudiante: no es un error, se ve como "no hay horario" (mismo
-- patrón de fallo silencioso ya documentado varias veces en AGENTS.md).
--
-- `security definer`, mismo patrón que student_can_see_lesson() (migración
-- 20260909000000_academia_curso_texto.sql): resuelve el curso del alumno
-- sin volver a pasar por las policies de `students`, evitando el tipo de
-- recursión de RLS ya visto dos veces en este proyecto.
-- =========================================================================

create or replace function student_can_see_schedule(p_school_id uuid, p_grade_level text)
returns boolean
language sql security definer stable set search_path = public as $$
    select p_grade_level is not null
       and exists (
            select 1 from students s
            where s.id = current_student_id()
              and s.deleted_at is null
              and s.school_id = p_school_id
              and s.grade_level = p_grade_level
       )
$$;

revoke execute on function student_can_see_schedule(uuid, text) from public;
grant execute on function student_can_see_schedule(uuid, text) to authenticated, service_role;

drop policy if exists "class_schedules_student_read" on class_schedules;
create policy "class_schedules_student_read" on class_schedules
for select using (student_can_see_schedule(school_id, grade_level));
