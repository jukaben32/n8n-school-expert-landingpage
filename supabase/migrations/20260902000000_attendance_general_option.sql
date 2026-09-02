-- =========================================================================
-- MentorIApp — Migración 037: opción "Todas (General)" al pasar lista
--
-- Pedido real del colegio (2026-09-02): el selector de materia de
-- Registrar Asistencia obliga a elegir una materia real antes de guardar.
-- Para primaria/parvulo/kinder -- donde no hay rotación de materias por
-- profesor -- lo natural es un pase de lista general, y solo si hace falta
-- filtrar/registrar por materia específica (secundaria). Se agrega "Todas
-- (General)" como opción, seleccionada por defecto.
--
-- "General" ya existía como concepto en el esquema (subject_id nullable,
-- migración 20260901000000) pero solo para los registros históricos
-- previos a esa migración -- el formulario nunca permitía crear uno nuevo
-- a propósito. El unique(student_id, date, subject_id) original no
-- alcanza para esto: Postgres trata cada NULL como distinto entre sí, así
-- que sin esto, pasar lista general dos veces el mismo día crearía dos
-- filas en vez de actualizar la misma (el mismo tipo de bug que motivó la
-- migración 20260901000000, ahora para el caso general).
-- =========================================================================

create unique index if not exists idx_attendance_general_unique
    on attendance (student_id, date)
    where subject_id is null;

comment on index idx_attendance_general_unique is
    'Un solo registro de asistencia "General" (subject_id null) por alumno '
    'por día -- el unique(student_id, date, subject_id) normal no cubre '
    'este caso porque Postgres no considera dos NULL iguales entre sí.';
