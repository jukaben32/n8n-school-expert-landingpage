-- Habilitar extensión para encriptación si se necesita después
create extension if not exists pgcrypto;

-- 1. Schools (Multi-tenant root)
create table schools (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    legal_name text,
    rnc text unique, -- RNC para DGII
    country text not null default 'DO',
    timezone text not null default 'America/Santo_Domingo',
    locale text not null default 'es-DO',
    address text,
    phone text,
    email text,
    logo_url text,
    settings jsonb not null default '{}',
    plan text not null default 'trial',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index idx_schools_rnc on schools(rnc) where deleted_at is null;

-- 2. Families
create table families (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    name text not null,
    primary_contact uuid,
    billing_email text,
    billing_phone text,
    payment_plan text default 'monthly',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index idx_families_school on families(school_id) where deleted_at is null;

-- 3. Students
create table students (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    family_id uuid not null references families(id),
    student_code text unique,
    first_name text not null,
    last_name text not null,
    birth_date date not null,
    gender text check (gender in ('M','F','O')),
    blood_type text,
    allergies text[],
    medical_notes jsonb,
    photo_url text,
    emergency_contact jsonb,
    enrollment_status text default 'prospecto',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index idx_students_school on students(school_id) where deleted_at is null;
create index idx_students_family on students(family_id) where deleted_at is null;

-- 4. Guardians
create table guardians (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    family_id uuid not null references families(id),
    first_name text not null,
    last_name text not null,
    email text,
    phone text not null,
    phone_verified boolean not null default false,
    relationship text not null,
    occupation text,
    workplace text,
    is_primary boolean not null default false,
    pickup_authorized boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index idx_guardians_school on guardians(school_id) where deleted_at is null;
create index idx_guardians_family on guardians(family_id) where deleted_at is null;

-- 5. Student Guardians (N:M)
create table student_guardians (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id),
    guardian_id uuid not null references guardians(id),
    relationship text not null,
    is_primary boolean not null default false,
    pickup_auth boolean not null default true,
    created_at timestamptz not null default now(),
    unique(student_id, guardian_id)
);

-- 6. Enrollments
create table enrollments (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id),
    school_year_id uuid, -- Foreign keys pendientes para fase académica
    grade_level_id uuid,
    section_id uuid,
    enrollment_date date not null default current_date,
    status text not null check (status in ('prospecto','solicitud','evaluacion','admitido','inscrito','retirado')),
    withdrawal_date date,
    withdrawal_reason text,
    scholarship_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 7. Staff
create table staff (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    first_name text not null,
    last_name text not null,
    email text not null,
    phone text,
    role text not null check (role in ('director','coordinator','teacher','assistant','finance','reception','nurse','admin')),
    hire_date date not null default current_date,
    exit_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- 8. Users Profiles (Enlace con Auth de Supabase)
create table users_profiles (
    id uuid primary key default gen_random_uuid(),
    auth_id uuid not null unique,
    school_id uuid not null references schools(id),
    staff_id uuid references staff(id),
    guardian_id uuid references guardians(id),
    role text not null check (role in ('super_admin','school_admin','director','teacher','finance','reception','guardian','student')),
    preferences jsonb not null default '{}',
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 9. Roles & Permissions
create table roles (
    id serial primary key,
    name text not null unique,
    description text,
    is_system boolean not null default false
);

create table permissions (
    id serial primary key,
    role_id int not null references roles(id),
    module text not null,
    action text not null,
    scope text not null default 'own',
    unique(role_id, module, action, scope)
);

-- 10. Audit Logs
create table audit_logs (
    id bigserial primary key,
    school_id uuid not null references schools(id),
    user_id uuid,
    action text not null,
    table_name text not null,
    record_id uuid,
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    user_agent text,
    agent_run_id uuid,
    created_at timestamptz not null default now()
);

-- =========================================================================
-- RLS POLICIES BASE
-- =========================================================================

-- Habilitar RLS en tablas clave
alter table students enable row level security;
alter table guardians enable row level security;

-- Policy SELECT para students: El usuario debe pertenecer al mismo school_id 
-- y tener rol administrativo, O ser guardian del estudiante.
create policy "students_read" on students
for select using (
  school_id in (
    select school_id from users_profiles
    where auth_id = auth.uid()
    and role in ('super_admin','school_admin','director','teacher','finance','reception')
  )
  or id in (
    select sg.student_id
    from student_guardians sg
    join guardians g on g.id = sg.guardian_id
    join users_profiles up on up.guardian_id = g.id
    where up.auth_id = auth.uid() and up.role = 'guardian'
  )
);
