-- Acota la escritura de Academia (lessons, quiz_questions, quiz_options) al
-- profesor asignado a ese grado -- mismo patron ya usado en Horarios, Notas
-- y Asistencia (teacher_is_assigned_to_grade con 3 argumentos, categoria
-- 'regular'). Antes, cualquier profesor podia crear/editar/borrar lecciones
-- y cuestionarios de CUALQUIER curso y materia del colegio -- una sola
-- policy ALL sin filtro. Ver AGENTS.md, "PENDIENTE PRIORITARIO -- Academia
-- no acota al profesor por curso ni materia" (2026-09-06).
--
-- La LECTURA sigue amplia: cualquier profesor sigue viendo el catalogo
-- completo del colegio (para reutilizar contenido de otros). Solo la
-- ESCRITURA (insert/update/delete) se acota por asignacion.
--
-- Idempotente -- drop policy if exists antes de cada create.
--
-- Nota: lessons y quiz_questions ya fueron corregidas en un intento previo
-- (pegado directo en el SQL Editor de Supabase); esta migracion las
-- reaplica sin cambios para que el repo quede sincronizado con lo que ya
-- hay en produccion. Solo quiz_options es nueva -- la version anterior
-- referenciaba una columna inexistente (quiz_question_id en vez de
-- question_id) y nunca llego a aplicarse.

-- ========== lessons ==========

drop policy if exists "lessons_staff_all" on lessons;
drop policy if exists "lessons_staff_read" on lessons;
drop policy if exists "lessons_staff_write" on lessons;
drop policy if exists "lessons_staff_update" on lessons;
drop policy if exists "lessons_staff_delete" on lessons;

create policy "lessons_staff_read" on lessons
for select to authenticated
using (
  school_id = auth_profile_school_id()
  and (
    auth_profile_role() = any (array['super_admin','school_admin','director'])
    or auth_profile_role() = 'teacher'
  )
);

create policy "lessons_staff_write" on lessons
for insert to authenticated
with check (
  school_id = auth_profile_school_id()
  and (
    auth_profile_role() = any (array['super_admin','school_admin','director'])
    or (
      auth_profile_role() = 'teacher'
      and grade_level is not null
      and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
    )
  )
);

create policy "lessons_staff_update" on lessons
for update to authenticated
using (
  school_id = auth_profile_school_id()
  and (
    auth_profile_role() = any (array['super_admin','school_admin','director'])
    or (
      auth_profile_role() = 'teacher'
      and grade_level is not null
      and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
    )
  )
)
with check (
  school_id = auth_profile_school_id()
  and (
    auth_profile_role() = any (array['super_admin','school_admin','director'])
    or (
      auth_profile_role() = 'teacher'
      and grade_level is not null
      and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
    )
  )
);

create policy "lessons_staff_delete" on lessons
for delete to authenticated
using (
  school_id = auth_profile_school_id()
  and (
    auth_profile_role() = any (array['super_admin','school_admin','director'])
    or (
      auth_profile_role() = 'teacher'
      and grade_level is not null
      and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
    )
  )
);

-- ========== quiz_questions ==========

drop policy if exists "quiz_questions_staff_all" on quiz_questions;
drop policy if exists "quiz_questions_staff_read" on quiz_questions;
drop policy if exists "quiz_questions_staff_write" on quiz_questions;
drop policy if exists "quiz_questions_staff_update" on quiz_questions;
drop policy if exists "quiz_questions_staff_delete" on quiz_questions;

create policy "quiz_questions_staff_read" on quiz_questions
for select to authenticated
using (
  lesson_id in (select id from lessons where school_id = auth_profile_school_id())
  and (
    auth_profile_role() = any (array['super_admin','school_admin','director'])
    or auth_profile_role() = 'teacher'
  )
);

create policy "quiz_questions_staff_write" on quiz_questions
for insert to authenticated
with check (
  lesson_id in (
    select id from lessons
    where school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
      )
    )
  )
);

create policy "quiz_questions_staff_update" on quiz_questions
for update to authenticated
using (
  lesson_id in (
    select id from lessons
    where school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
      )
    )
  )
)
with check (
  lesson_id in (
    select id from lessons
    where school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
      )
    )
  )
);

create policy "quiz_questions_staff_delete" on quiz_questions
for delete to authenticated
using (
  lesson_id in (
    select id from lessons
    where school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), grade_level, 'regular')
      )
    )
  )
);

-- ========== quiz_options ==========
-- question_id -> quiz_questions.id -> quiz_questions.lesson_id -> lessons.id
-- (un nivel mas de indireccion que quiz_questions, mismo criterio de fondo)

drop policy if exists "quiz_options_staff_manage" on quiz_options;
drop policy if exists "quiz_options_staff_read" on quiz_options;
drop policy if exists "quiz_options_staff_write" on quiz_options;
drop policy if exists "quiz_options_staff_update" on quiz_options;
drop policy if exists "quiz_options_staff_delete" on quiz_options;

create policy "quiz_options_staff_read" on quiz_options
for select to authenticated
using (
  question_id in (
    select qq.id from quiz_questions qq
    join lessons l on l.id = qq.lesson_id
    where l.school_id = auth_profile_school_id()
  )
  and (
    auth_profile_role() = any (array['super_admin','school_admin','director'])
    or auth_profile_role() = 'teacher'
  )
);

create policy "quiz_options_staff_write" on quiz_options
for insert to authenticated
with check (
  question_id in (
    select qq.id from quiz_questions qq
    join lessons l on l.id = qq.lesson_id
    where l.school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and l.grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), l.grade_level, 'regular')
      )
    )
  )
);

create policy "quiz_options_staff_update" on quiz_options
for update to authenticated
using (
  question_id in (
    select qq.id from quiz_questions qq
    join lessons l on l.id = qq.lesson_id
    where l.school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and l.grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), l.grade_level, 'regular')
      )
    )
  )
)
with check (
  question_id in (
    select qq.id from quiz_questions qq
    join lessons l on l.id = qq.lesson_id
    where l.school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and l.grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), l.grade_level, 'regular')
      )
    )
  )
);

create policy "quiz_options_staff_delete" on quiz_options
for delete to authenticated
using (
  question_id in (
    select qq.id from quiz_questions qq
    join lessons l on l.id = qq.lesson_id
    where l.school_id = auth_profile_school_id()
    and (
      auth_profile_role() = any (array['super_admin','school_admin','director'])
      or (
        auth_profile_role() = 'teacher'
        and l.grade_level is not null
        and teacher_is_assigned_to_grade(auth_profile_school_id(), l.grade_level, 'regular')
      )
    )
  )
);
