-- =========================================================================
-- SCHOOLOS — Migración 007: Estructura académica base
--
-- `enrollments.grade_level_id` existía desde la migración 001 pero como
-- columna "huérfana" (sin tabla ni FK real) -- el comentario original decía
-- "Foreign keys pendientes para fase académica". Nunca se creó esa fase.
-- Sin esto, el módulo de Academia (lecciones por grado/materia) no tiene
-- dónde apoyarse. Se crea aquí: años escolares, grados y materias.
-- =========================================================================

create table school_years (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    name text not null,                 -- ej. '2026-2027'
    start_date date not null,
    end_date date not null,
    is_current boolean not null default false,
    created_at timestamptz not null default now()
);

create table grade_levels (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    name text not null,                 -- ej. '1er Grado'
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

create table subjects (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    name text not null,                 -- ej. 'Matemática'
    created_at timestamptz not null default now()
);

-- Ahora sí, la FK real que faltaba desde el principio.
alter table enrollments
    add constraint enrollments_grade_level_id_fkey
    foreign key (grade_level_id) references grade_levels(id);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table school_years  enable row level security;
alter table grade_levels  enable row level security;
alter table subjects      enable row level security;

drop policy if exists "school_years_school_read" on school_years;
create policy "school_years_school_read" on school_years
for select using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid())
);

drop policy if exists "school_years_staff_manage" on school_years;
create policy "school_years_staff_manage" on school_years
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);

drop policy if exists "grade_levels_school_read" on grade_levels;
create policy "grade_levels_school_read" on grade_levels
for select using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid())
);

drop policy if exists "grade_levels_staff_manage" on grade_levels;
create policy "grade_levels_staff_manage" on grade_levels
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);

drop policy if exists "subjects_school_read" on subjects;
create policy "subjects_school_read" on subjects
for select using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid())
);

drop policy if exists "subjects_staff_manage" on subjects;
create policy "subjects_staff_manage" on subjects
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);
