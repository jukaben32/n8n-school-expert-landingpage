-- =========================================================================
-- MentorIApp — Migración 027: consultas del sitio público (leads de familias)
--
-- El sitio público del colegio (/colegio/[subdomain]) mostraba datos de
-- contacto pero no tenía ninguna forma de que una familia interesada
-- dejara sus datos -- a diferencia del proyecto de referencia
-- (real-estate-multi-ai-agent-saas), cuyo formulario de contacto en el
-- sitio público sí genera un lead real. Esto NO es lo mismo que la tabla
-- `leads` existente (esa es la lista de VENTAS de la plataforma -- colegios
-- interesados en MentorIApp, para /dashboard/plataforma/leads); esta es
-- la lista de FAMILIAS interesadas en UN colegio ya afiliado, capturada
-- desde su propio sitio público.
--
-- Se inserta siempre con el cliente admin (misma lógica que el webhook de
-- WhatsApp): el visitante del sitio público no tiene sesión de Supabase,
-- así que no hace falta (ni conviene) una policy de insert para `anon`.
-- =========================================================================

create table if not exists website_inquiries (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    name text not null,
    phone text,
    email text,
    message text,
    status text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'descartado')),
    created_at timestamptz not null default now()
);
create index if not exists idx_website_inquiries_school on website_inquiries(school_id, created_at desc);

alter table website_inquiries enable row level security;

-- Contiene datos personales de familias que ni siquiera son usuarias
-- todavía -- a diferencia de website_services/team/testimonials/faqs, NO
-- lleva policy de lectura pública ni grant a anon.
drop policy if exists "website_inquiries_super_admin_all" on website_inquiries;
create policy "website_inquiries_super_admin_all" on website_inquiries
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists "website_inquiries_staff_manage" on website_inquiries;
create policy "website_inquiries_staff_manage" on website_inquiries
  for all
  using (school_id in (select school_id from users_profiles where auth_id = auth.uid() and role in ('school_admin', 'director')))
  with check (school_id in (select school_id from users_profiles where auth_id = auth.uid() and role in ('school_admin', 'director')));

grant select, insert, update, delete on website_inquiries to authenticated;
grant all privileges on website_inquiries to service_role;
