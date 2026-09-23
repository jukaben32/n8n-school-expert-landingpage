-- =========================================================================
-- MentorIApp — Políticas internas firmadas por el personal (2026-09-23)
--
-- Pedido del colegio: la "Política de Confidencialidad, Protección del
-- Menor y Ética Laboral" (alcance: TODO el personal) se firmaba en papel.
-- Ahora cada empleado la lee y la firma desde su cuenta, y Dirección ve
-- quién firmó y quién no. Mismo principio que Autorizaciones (tutores):
-- identidad por login + reautenticación con contraseña al firmar + nombre
-- escrito + el texto exacto CONGELADO en la firma.
--
-- Es contenido INTERNO: ni tutores ni estudiantes tienen ninguna policy de
-- lectura sobre estas tablas, y no se mezcla con schools.faq_document (que
-- sí lee el asistente de IA de las familias).
--
-- Una política publicada no se edita: si el texto cambia, se crea una
-- nueva y se desactiva la anterior -- así cada firma apunta a un texto que
-- nunca cambió debajo de ella (además del snapshot en la propia firma).
-- =========================================================================

create table if not exists staff_policies (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    title text not null check (length(trim(title)) > 0),
    body text not null check (length(trim(body)) > 0),
    is_active boolean not null default true,
    created_by uuid references users_profiles(id),
    created_at timestamptz not null default now()
);
create index if not exists idx_staff_policies_school on staff_policies(school_id, created_at desc);

alter table staff_policies enable row level security;

-- Todo el personal del colegio lee las políticas de su colegio.
drop policy if exists "staff_policies_staff_read" on staff_policies;
create policy "staff_policies_staff_read" on staff_policies
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('super_admin', 'school_admin', 'director', 'teacher', 'finance', 'reception')
    )
);

-- Solo dirección crea / activa-desactiva.
drop policy if exists "staff_policies_manage" on staff_policies;
create policy "staff_policies_manage" on staff_policies
for all using (
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

drop policy if exists "staff_policies_super_admin" on staff_policies;
create policy "staff_policies_super_admin" on staff_policies
for all using (is_super_admin()) with check (is_super_admin());

grant select, insert, update on staff_policies to authenticated;
grant all privileges on staff_policies to service_role;

-- Nombre, cédula, cargo y el texto de la política "congelados" al firmar --
-- es la constancia, no debe cambiar si alguien edita su ficha o la política.
create table if not exists staff_policy_signatures (
    id uuid primary key default gen_random_uuid(),
    policy_id uuid not null references staff_policies(id) on delete cascade,
    school_id uuid not null references schools(id) on delete cascade,
    staff_id uuid not null references staff(id),
    profile_id uuid not null references users_profiles(id),
    signer_full_name text not null check (length(trim(signer_full_name)) > 0),
    signer_national_id text not null check (length(trim(signer_national_id)) > 0),
    signer_position text not null check (length(trim(signer_position)) > 0),
    policy_title_snapshot text not null,
    policy_body_snapshot text not null,
    signed_at timestamptz not null default now(),
    unique (policy_id, staff_id)
);
create index if not exists idx_staff_policy_signatures_policy on staff_policy_signatures(policy_id);

alter table staff_policy_signatures enable row level security;

-- Cada empleado ve su propia firma.
drop policy if exists "staff_policy_signatures_own_read" on staff_policy_signatures;
create policy "staff_policy_signatures_own_read" on staff_policy_signatures
for select using (
    profile_id in (select id from users_profiles where auth_id = auth.uid())
);

-- Dirección ve todas las firmas de su colegio (el roster).
drop policy if exists "staff_policy_signatures_manager_read" on staff_policy_signatures;
create policy "staff_policy_signatures_manager_read" on staff_policy_signatures
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

-- Firmar: solo por uno mismo (su propio perfil y su propia ficha de
-- personal), solo una política ACTIVA de su propio colegio. Nadie puede
-- firmar en nombre de otro. No hay policy de update ni delete: una firma
-- no se edita ni se borra.
drop policy if exists "staff_policy_signatures_own_insert" on staff_policy_signatures;
create policy "staff_policy_signatures_own_insert" on staff_policy_signatures
for insert with check (
    exists (
        select 1 from users_profiles up
        where up.auth_id = auth.uid()
          and up.id = staff_policy_signatures.profile_id
          and up.staff_id = staff_policy_signatures.staff_id
          and up.school_id = staff_policy_signatures.school_id
          and up.role in ('super_admin', 'school_admin', 'director', 'teacher', 'finance', 'reception')
    )
    and exists (
        select 1 from staff_policies sp
        where sp.id = staff_policy_signatures.policy_id
          and sp.school_id = staff_policy_signatures.school_id
          and sp.is_active
    )
);

drop policy if exists "staff_policy_signatures_super_admin_read" on staff_policy_signatures;
create policy "staff_policy_signatures_super_admin_read" on staff_policy_signatures
for select using (is_super_admin());

grant select, insert on staff_policy_signatures to authenticated;
grant all privileges on staff_policy_signatures to service_role;
