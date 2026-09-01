-- =========================================================================
-- MentorIApp — Migración 035: asistencia por materia (secundaria)
--
-- Problema real reportado por el colegio (2026-09-01): en secundaria hay
-- profesores que dan varias materias, y la misma materia a distintos
-- grupos. El pase de lista debe llevarse por curso Y por materia, no solo
-- por día. Hoy `attendance` tiene unique(student_id, date) -- un solo
-- registro de asistencia por alumno por día, sin importar cuántas clases
-- tuvo. En la práctica, el segundo profesor que pasa lista el mismo día
-- pisa (sobrescribe) el registro del primero, vía el upsert con
-- onConflict: 'student_id,date' que hace AttendanceForm.
--
-- Se agrega `subject_id` (reutiliza el catálogo `subjects` ya existente,
-- el mismo que usan class_schedules/Academia/notas -- ver migración 007) y
-- se amplía el unique a (student_id, date, subject_id): ahora puede haber
-- un registro por alumno, por día, por materia.
--
-- subject_id es nullable a propósito: los registros históricos ya
-- guardados (modelo antiguo, un solo pase de lista diario sin materia) se
-- quedan con subject_id = null en vez de inventarles una materia falsa.
-- No se crea una fila "Asistencia General" en `subjects` porque esa tabla
-- se muestra tal cual en selectores de Academia (crear lección) y Notas
-- (boletín) -- ensuciaría esos catálogos con una "materia" que no es una
-- materia real. La UI etiqueta subject_id = null como "General" solo
-- para mostrar, sin tocar `subjects`. Los registros nuevos, en cambio,
-- siempre traen subject_id real: el formulario de registrar asistencia
-- exige elegir una materia antes de guardar.
-- =========================================================================

alter table attendance
    add column if not exists subject_id uuid references subjects(id) on delete set null;

create index if not exists idx_attendance_subject on attendance(subject_id);

-- El unique(student_id, date) original (migración 002) ya no alcanza --
-- necesitamos incluir la materia. Se busca y elimina el constraint único
-- existente por introspección en vez de asumir su nombre generado
-- automáticamente, mismo patrón ya usado en teacher_assignments
-- (migración 034), para que esta migración sea segura de re-ejecutar.
do $$
declare
    c record;
begin
    for c in
        select conname from pg_constraint
        where conrelid = 'attendance'::regclass
          and contype = 'u'
    loop
        execute format('alter table attendance drop constraint %I', c.conname);
    end loop;
end $$;

alter table attendance
    add constraint attendance_student_date_subject_key
    unique (student_id, date, subject_id);

comment on column attendance.subject_id is
    'Materia de la clase en la que se pasó lista. NULL solo en registros '
    'históricos previos a esta migración (modelo de un pase de lista diario '
    'sin materia) -- todo registro nuevo debe traer una materia real.';
