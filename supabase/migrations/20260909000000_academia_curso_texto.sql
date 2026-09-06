-- =========================================================================
-- Academia — alinear las lecciones con el MISMO sistema de curso que usa
-- el resto de la app (students.grade_level, texto libre).
--
-- POR QUÉ (bug real, no mejora cosmética):
-- La migración 008 dirigió cada lección con `lessons.grade_level_id` ->
-- `grade_levels`, y para saber el curso del alumno consultaba la tabla
-- `enrollments`. Pero NINGUNA parte de la aplicación inserta jamás una
-- fila en `enrollments` (verificado en todo `web/src` y en las 60+
-- migraciones: solo hay lecturas y la exportación de datos). Con esa
-- tabla vacía, la policy `lessons_student_read` no devuelve ni una fila:
-- Academia le muestra "Todavía no hay lecciones publicadas para tu grado"
-- a TODOS los estudiantes, sin importar cuántas lecciones se publiquen.
--
-- Es el mismo bug que ya tuvo el asistente de IA: `gatherFamilyContext()`
-- leía `enrollments` y siempre respondía "sin matrícula registrada"; se
-- corrigió leyendo `students.enrollment_status`. Academia se quedó con la
-- versión vieja.
--
-- QUÉ SE TOCA Y QUÉ NO (protocolo de menor radio de impacto):
--   * Se AGREGA la columna `lessons.grade_level` (texto) y policies NUEVAS.
--   * NO se borra `grade_level_id`, ni `grade_levels`, ni `enrollments`,
--     ni las policies viejas: `lessons_student_read`/`lessons_guardian_read`
--     se quedan tal cual. Como las policies permisivas se combinan con OR,
--     esto solo AGREGA una vía de acceso -- ninguna lección que hoy se vea
--     deja de verse. La ficha del estudiante y la exportación de datos
--     siguen leyendo `enrollments` sin cambio alguno.
--   * `lessons_staff_all` (quién crea/edita lecciones) no se toca.
--
-- Patrón copiado de Encuestas (20260905000000_acceso_estudiantes.sql), que
-- es el módulo de estudiante más reciente y ya resolvió esto bien:
-- `current_student_id()` + comparar contra `students.grade_level`.
-- =========================================================================

-- ── 1. El curso de la lección, en el mismo formato que students.grade_level
alter table lessons add column if not exists grade_level text;

-- `grade_level_id` era `not null`. Se relaja para que una lección nueva no
-- dependa del catálogo muerto. Las filas viejas conservan su valor.
alter table lessons alter column grade_level_id drop not null;

-- Una lección tiene que estar dirigida a algo, por una vía o por la otra.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'lessons'::regclass and conname = 'lessons_destino_check'
    ) then
        alter table lessons add constraint lessons_destino_check
            check (grade_level is not null or grade_level_id is not null);
    end if;
end $$;

create index if not exists idx_lessons_curso
    on lessons (school_id, grade_level)
    where deleted_at is null and grade_level is not null;

-- ── 2. ¿Este estudiante puede ver esta lección? ──────────────────────────
-- `security definer` a propósito: resuelve el curso del alumno SIN volver a
-- pasar por las policies de `students`. Es justo el patrón que evitó la
-- recursión infinita de RLS documentada dos veces en este proyecto
-- (users_profiles en la 009, students<->student_guardians en la 018).
create or replace function student_can_see_lesson(
    p_school_id uuid,
    p_grade_level text,
    p_is_published boolean
) returns boolean
language sql security definer stable set search_path = public as $$
    select coalesce(p_is_published, false)
       and p_grade_level is not null
       and exists (
            select 1 from students s
            where s.id = current_student_id()
              and s.deleted_at is null
              and s.school_id = p_school_id
              and s.grade_level = p_grade_level
       )
$$;

-- El tutor ve las lecciones publicadas del curso de sus hijos.
-- `guardian_id is not null` en vez de `role = 'guardian'`: un profesor que
-- además es padre en el colegio usa UNA sola cuenta -- exigir el rol
-- lo dejaría fuera, que es exactamente el bug de doble rol corregido en
-- 20260821060000_fix_dual_role_rls.sql para otras 24 policies.
create or replace function guardian_can_see_lesson(
    p_school_id uuid,
    p_grade_level text,
    p_is_published boolean
) returns boolean
language sql security definer stable set search_path = public as $$
    select coalesce(p_is_published, false)
       and p_grade_level is not null
       and exists (
            select 1
            from users_profiles up
            join student_guardians sg on sg.guardian_id = up.guardian_id
            join students s on s.id = sg.student_id
            where up.auth_id = auth.uid()
              and up.guardian_id is not null
              and s.deleted_at is null
              and s.school_id = p_school_id
              and s.grade_level = p_grade_level
       )
$$;

revoke execute on function student_can_see_lesson(uuid, text, boolean) from public;
revoke execute on function guardian_can_see_lesson(uuid, text, boolean) from public;
grant execute on function student_can_see_lesson(uuid, text, boolean) to authenticated, service_role;
grant execute on function guardian_can_see_lesson(uuid, text, boolean) to authenticated, service_role;

-- ── 3. Policies nuevas (se SUMAN a las viejas, no las reemplazan) ────────
drop policy if exists "lessons_student_read_curso" on lessons;
create policy "lessons_student_read_curso" on lessons
for select using (student_can_see_lesson(school_id, grade_level, is_published));

drop policy if exists "lessons_guardian_read_curso" on lessons;
create policy "lessons_guardian_read_curso" on lessons
for select using (guardian_can_see_lesson(school_id, grade_level, is_published));

comment on column lessons.grade_level is
    'Curso destino en texto libre, igual que students.grade_level (ej. "1ro. Secundaria"). Es la vía viva; grade_level_id/grade_levels quedan por compatibilidad.';
