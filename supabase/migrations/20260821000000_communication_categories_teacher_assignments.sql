-- =========================================================================
-- MentorIApp — Migración 034: categoría de comunicación en teacher_assignments
--
-- El colegio tiene una alianza con Amco para el área de Inglés (coordinadora
-- + 5 docentes por ciclo) y un solo docente de Educación Física para todo
-- el colegio. El pedido del usuario (2026-08-20): los mensajes de padres y
-- los comunicados deben llegar solo al equipo correspondiente según la
-- materia (Inglés/Deporte/Regular), y quien coordine un departamento de una
-- sola persona para todo el colegio (ej. el docente de Deporte) debe verlo
-- completo, no solo "su grado".
--
-- Se reutiliza teacher_assignments (staff_id <-> grade_level) en vez de
-- crear un concepto nuevo: gana una columna `category`, y `grade_level`
-- pasa a ser nullable -- una fila con grade_level = null significa "todos
-- los grados del colegio para esta categoría" (para un docente único de
-- todo el colegio en su materia). No hace falta tocar permissions.ts ni
-- el rol de acceso: Inglés/Deporte siguen entrando como 'teacher' (o el
-- rol que corresponda), la separación es 100% vía esta tabla + RLS, igual
-- que ya pasa hoy con el grado para asistencia/actualizaciones.
--
-- La Coordinadora de Inglés no necesita una fila especial acá -- en la
-- tarea anterior (Secretaría/Coordinación) se definió que su rol de acceso
-- es 'director' (acceso total, ella "debe tener acceso igual a la
-- Directora"), así que ya entra por la rama de roles de acceso completo en
-- las policies de abajo sin depender de teacher_assignments.
-- =========================================================================

alter table teacher_assignments alter column grade_level drop not null;

alter table teacher_assignments add column if not exists category text not null default 'regular'
    check (category in ('regular', 'ingles', 'deporte'));

-- El unique(staff_id, grade_level) original (migración 033) ya no alcanza
-- -- necesitamos incluir la categoría, y permitir null en grade_level (fila
-- "todo el colegio"). Se busca y elimina el constraint único existente por
-- introspección en vez de asumir su nombre generado automáticamente, para
-- que esta migración sea segura de re-ejecutar y no dependa de cómo
-- Postgres lo haya nombrado.
do $$
declare
    c record;
begin
    for c in
        select conname from pg_constraint
        where conrelid = 'teacher_assignments'::regclass
          and contype = 'u'
    loop
        execute format('alter table teacher_assignments drop constraint %I', c.conname);
    end loop;
end $$;

drop index if exists idx_teacher_assignments_unique_scoped;
create unique index idx_teacher_assignments_unique_scoped
    on teacher_assignments (staff_id, category, coalesce(grade_level, '*'));

-- Retrocompatible: las llamadas existentes desde students/attendance/
-- class_updates (2 argumentos) siguen filtrando category='regular' por el
-- default, sin ningún cambio de comportamiento. Ahora también hace match
-- si la fila es "todo el colegio" (grade_level is null).
create or replace function teacher_is_assigned_to_grade(p_school_id uuid, p_grade_level text, p_category text default 'regular')
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
          and ta.category = p_category
          and (ta.grade_level = p_grade_level or ta.grade_level is null)
    )
$$;

-- Nueva: ¿el staff autenticado puede ver la conversación/comunicado de esta
-- familia en esta categoría? Existe algún estudiante de esa familia cuyo
-- grade_level calza con una asignación del staff en esa categoría (o el
-- staff tiene la fila "todo el colegio" para esa categoría).
create or replace function staff_can_see_family_category(p_school_id uuid, p_family_id uuid, p_category text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from students s
        where s.family_id = p_family_id
          and s.school_id = p_school_id
          and s.deleted_at is null
          and s.grade_level is not null
          and teacher_is_assigned_to_grade(p_school_id, s.grade_level, p_category)
    )
$$;
