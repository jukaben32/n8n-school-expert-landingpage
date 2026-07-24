-- =========================================================================
-- SCHOOLOS — Migración 011: ficha profesional del personal (Personal /
-- Docentes) + endurece el acceso de lectura a staff
-- =========================================================================

alter table staff add column education_level text
    check (education_level in ('tecnico','bachiller','licenciatura','maestria','doctorado'));
alter table staff add column degree_title text;       -- ej. 'Licenciada en Educación Inicial'
alter table staff add column alma_mater text;          -- institución de egreso
alter table staff add column graduation_year int;
alter table staff add column specialty text;           -- área o materia de especialidad
alter table staff add column certifications text;       -- certificaciones adicionales, texto libre
alter table staff add column bio text;

-- `staff_read` (migración 20260703) dejaba leer la tabla completa a
-- teacher/finance/reception. Con datos profesionales/personales de cada
-- empleado ahí dentro, eso es demasiado amplio -- se restringe a
-- dirección/administración, igual que la gestión.
drop policy if exists "staff_read" on staff;
create policy "staff_read" on staff
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director')
    )
);
