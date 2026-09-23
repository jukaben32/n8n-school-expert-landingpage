-- =========================================================================
-- MentorIApp — Solicitudes de empleo desde la página web del colegio (2026-09-23)
--
-- Reemplaza la "Solicitud de Empleo - Personal Docente y Administrativo" en
-- papel: cualquiera la llena en /colegio/[subdomain]/empleo, adjunta su CV,
-- y dirección la revisa en /dashboard/personal/solicitudes.
--
-- A diferencia de staff_registrations (personal que YA trabaja aquí), esto
-- son postulantes: nunca crean una ficha de `staff` por sí solos.
--
-- Escritura pública SIN policy para anon: el envío pasa por una Server
-- Action con service_role, que valida el colegio y los archivos. Así nadie
-- puede insertar filas a mano con la key pública ni leer las de otros.
-- Lectura y actualización: solo dirección (mismo alcance que el módulo
-- 'personal' en permissions.ts).
-- =========================================================================

create table if not exists job_applications (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    -- 1. Datos personales
    full_name text not null check (length(trim(full_name)) > 0),
    national_id text,
    birth_date date,
    nationality text,
    address text,
    sector text,
    mobile_phone text not null check (length(trim(mobile_phone)) > 0),
    home_phone text,
    email text,
    marital_status text,
    -- 2. Posición
    position text not null check (position in ('docente', 'auxiliar', 'administrativo', 'otro')),
    position_other text,
    levels text[] not null default '{}',
    specialty text,
    schedule text[] not null default '{}',
    -- 3. Contactos de emergencia: [{name, relationship, phone, occupation}]
    emergency_contacts jsonb not null default '[]'::jsonb,
    -- 4. Vinculación institucional
    has_relative_here boolean not null default false,
    relative_name text,
    relative_relationship text,
    relative_area text,
    referral_source text,
    referral_detail text,
    -- 5. Formación: [{level, title, institution, year}]
    education jsonb not null default '[]'::jsonb,
    teaching_license text check (teaching_license in ('si', 'no', 'en_tramite')),
    -- 6. Experiencia: [{institution, role, from, to, exit_reason, reference_phone}]
    experience jsonb not null default '[]'::jsonb,
    -- 7. Declaración
    declaration_accepted boolean not null check (declaration_accepted),
    signer_name text not null,
    cv_path text,
    certificates_path text,
    -- Revisión
    status text not null default 'nueva' check (status in ('nueva', 'revisada', 'entrevista', 'descartada', 'contratada')),
    review_notes text,
    reviewed_by uuid references users_profiles(id),
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists idx_job_applications_school on job_applications(school_id, created_at desc);

alter table job_applications enable row level security;

drop policy if exists "job_applications_manager_read" on job_applications;
create policy "job_applications_manager_read" on job_applications
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "job_applications_manager_update" on job_applications;
create policy "job_applications_manager_update" on job_applications
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "job_applications_super_admin" on job_applications;
create policy "job_applications_super_admin" on job_applications
for select using (is_super_admin());

revoke all on job_applications from anon;
grant select, update on job_applications to authenticated;
grant all privileges on job_applications to service_role;

-- CV y certificados: bucket PRIVADO, sin políticas de storage.objects para
-- anon/authenticated. La subida es con un enlace firmado de un solo uso que
-- emite la Server Action (así un CV de varios MB no choca con el límite de
-- 1MB de las Server Actions); la lectura, signed URL de 5 minutos.
insert into storage.buckets (id, name, public)
values ('solicitudes-empleo', 'solicitudes-empleo', false)
on conflict (id) do nothing;
