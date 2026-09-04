-- =========================================================================
-- MentorIApp — "Todas (General)" al pasar lista: arreglo del "Error al guardar"
--
-- Reporte real del colegio (2026-09-04): a la profesora de Párvulo y a la de
-- Pre Kinder les daba "Error al guardar. Por favor intenta de nuevo." al
-- pasar lista. Reproducido en producción: el guardado falla con
--
--   ERROR 42P10: there is no unique or exclusion constraint matching the
--   ON CONFLICT specification
--
-- Causa: la migración 20260902000000 cubrió el caso "General" (subject_id
-- null) con un ÍNDICE PARCIAL -- `unique (student_id, date) where subject_id
-- is null`. Pero Postgres solo puede usar un índice parcial como árbitro de
-- un ON CONFLICT si la sentencia repite el WHERE del índice, y PostgREST
-- (supabase-js `.upsert({ onConflict: 'student_id,date' })`) genera el
-- ON CONFLICT sin WHERE. El índice existía, pero era inalcanzable.
--
-- Por qué no se vio antes: "Todas (General)" es la opción por DEFECTO, y es
-- justo la que usan Párvulo/Pre Kinder/Primaria, donde no hay rotación de
-- materias. Los profesores de secundaria eligen una materia real y caen en
-- el otro camino, que sí funcionaba -- por eso las 55 filas guardadas hoy
-- tienen todas una materia concreta y ninguna es "General".
--
-- Arreglo: en vez de un índice parcial aparte, se le dice a la restricción
-- única de siempre que trate los NULL como iguales (NULLS NOT DISTINCT,
-- disponible desde Postgres 15 -- aquí corre 17.6). Así una sola
-- restricción cubre los dos casos, y el formulario puede usar siempre
-- `onConflict: 'student_id,date,subject_id'`.
--
-- Verificado antes de aplicar: no existe ninguna pareja (student_id, date)
-- duplicada con subject_id null, así que la restricción entra sin conflicto.
-- =========================================================================

alter table attendance
    drop constraint if exists attendance_student_date_subject_key;

alter table attendance
    add constraint attendance_student_date_subject_key
    unique nulls not distinct (student_id, date, subject_id);

-- Ya no hace falta: la restricción de arriba cubre el caso "General", y
-- este índice parcial nunca pudo servir de árbitro para el ON CONFLICT.
drop index if exists idx_attendance_general_unique;

comment on constraint attendance_student_date_subject_key on attendance is
    'Un registro de asistencia por alumno, por día y por materia. NULLS NOT '
    'DISTINCT a propósito: subject_id null es el pase de lista "General" '
    '(Párvulo/Kinder/Primaria, sin rotación de materias), y sin esto '
    'Postgres trataría cada null como distinto -- se duplicarían las filas y '
    'el upsert del formulario no encontraría a qué restricción apuntar.';
