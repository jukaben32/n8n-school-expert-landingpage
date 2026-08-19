-- =========================================================================
-- MentorIApp — Migración 032: actualizaciones con foto (estilo Seesaw)
--
-- "Así estuvo tu hijo/a hoy" -- una foto corta con descripción, dirigida
-- a UN estudiante puntual (ej. "Juanito pintando") o a un grado/sección
-- completo (ej. "excursión de Kinder A"). Reusa `students.grade_level`
-- (texto libre) para el targeting por grado, mismo campo que ya usa
-- Comunicados desde la migración 030.
--
-- Fotos en bucket PRIVADO (no público como website-photos) -- son fotos
-- de menores, solo deben verlas el colegio y la familia dueña, nunca
-- cualquier visitante del sitio público. Se accede vía createSignedUrl,
-- mismo patrón que las fichas escaneadas de estudiantes_escaneos.
-- =========================================================================

create table if not exists class_updates (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    author_profile_id uuid not null references users_profiles(id),
    student_id uuid references students(id) on delete cascade,
    grade_level text,
    caption text,
    photo_path text not null,
    created_at timestamptz not null default now(),
    deleted_at timestamptz,
    check (
        (student_id is not null and grade_level is null)
        or (student_id is null and grade_level is not null)
    )
);
create index if not exists idx_class_updates_school on class_updates(school_id, created_at desc) where deleted_at is null;
create index if not exists idx_class_updates_student on class_updates(student_id) where deleted_at is null;

alter table class_updates enable row level security;

drop policy if exists "class_updates_staff_all" on class_updates;
create policy "class_updates_staff_all" on class_updates
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
);

drop policy if exists "class_updates_guardian_read" on class_updates;
create policy "class_updates_guardian_read" on class_updates
for select using (
    deleted_at is null
    and (
        student_id in (
            select sg.student_id from student_guardians sg
            join guardians g on g.id = sg.guardian_id
            join users_profiles up on up.guardian_id = g.id
            where up.auth_id = auth.uid() and up.role = 'guardian'
        )
        or (
            grade_level is not null
            and grade_level in (
                select s.grade_level from students s
                join student_guardians sg on sg.student_id = s.id
                join guardians g on g.id = sg.guardian_id
                join users_profiles up on up.guardian_id = g.id
                where up.auth_id = auth.uid() and up.role = 'guardian'
            )
        )
    )
);

grant select on class_updates to authenticated;
grant all privileges on class_updates to service_role;
