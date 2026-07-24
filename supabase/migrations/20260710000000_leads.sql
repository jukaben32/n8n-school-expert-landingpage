-- =========================================================================
-- SCHOOLOS — Migración 012: leads de la landing pública
--
-- La landing oficial de SchoolOS incluye un formulario "Solicitar demo".
-- A diferencia de la landing vieja (index.html en la raíz del repo, cuyo
-- formulario solo validaba localmente y no guardaba nada), este sí
-- persiste los leads para que el súper administrador les dé seguimiento
-- real desde /dashboard/plataforma/leads.
-- =========================================================================

create table leads (
    id uuid primary key default gen_random_uuid(),
    school_name text not null,
    contact_name text not null,
    role_title text,
    email text not null,
    phone text,
    student_count text,
    interest text,
    message text,
    status text not null default 'nuevo' check (status in ('nuevo','contactado','descartado','convertido')),
    created_at timestamptz not null default now()
);

alter table leads enable row level security;

-- El formulario de la landing lo llena gente SIN sesión iniciada -- se
-- necesita el grant de tabla además de la policy, porque el rol `anon`
-- no tiene privilegios por defecto sobre tablas nuevas.
grant insert on leads to anon, authenticated;

drop policy if exists "leads_public_insert" on leads;
create policy "leads_public_insert" on leads
for insert to anon, authenticated
with check (true);

-- Solo el súper administrador (visión de toda la plataforma) puede leer
-- y dar seguimiento a los leads -- no son de un colegio en particular.
drop policy if exists "leads_super_admin_manage" on leads;
create policy "leads_super_admin_manage" on leads
for all using (is_super_admin());
