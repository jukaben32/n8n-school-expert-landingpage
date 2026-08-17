-- =========================================================================
-- MentorIApp — Migración 026: constructor de sitio web completo
--
-- Migración 024 dejó `schools.settings.website` con 5 campos (hero_title,
-- hero_subtitle, cta_label, primary_color, accent_color) — suficiente para
-- una landing mínima, pero muy por debajo del constructor completo del
-- proyecto de referencia (real-estate-multi-ai-agent-saas): plantillas,
-- servicios, equipo, testimonios, FAQs públicas, redes sociales, stats.
--
-- Decisión: los campos de una sola fila (hero, about, contacto, redes,
-- tema/plantilla/fuente) siguen viviendo en `schools.settings.website`
-- (JSON) — ya es el patrón establecido aquí, no se introduce una tabla
-- `websites` paralela solo para mantener paridad con la referencia.
-- Las LISTAS (servicios, equipo, testimonios, FAQs del sitio, no
-- confundir con `schools.faq_document` que alimenta al asistente de IA)
-- sí necesitan tablas reales -- son N filas con orden e ID estable.
--
-- Se omite el equivalente de `website_specialties` (aliados/prestamistas
-- en el proyecto de referencia) -- es un concepto específico de
-- inmobiliaria sin equivalente natural en un colegio.
-- =========================================================================

create table website_services (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    icon text not null default 'sparkles',
    name text not null,
    description text,
    duration text,
    price text,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);
create index idx_website_services_school on website_services(school_id);

create table website_team_members (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    name text not null,
    role text not null,
    bio text,
    photo_url text,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);
create index idx_website_team_members_school on website_team_members(school_id);

create table website_testimonials (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    quote text not null,
    author_name text not null,
    author_role text,
    rating integer not null default 5 check (rating between 1 and 5),
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);
create index idx_website_testimonials_school on website_testimonials(school_id);

-- FAQs públicas del sitio (Q&A mostrado a visitantes) -- distinto de
-- schools.faq_document (texto libre que alimenta el contexto del
-- asistente de IA en answerFamilyQuestion.ts). Ambos pueden decir lo
-- mismo, mantenerlos sincronizados a mano es aceptable por ahora.
create table website_faqs (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    question text not null,
    answer text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);
create index idx_website_faqs_school on website_faqs(school_id);

-- Mismo patrón de RLS en las 4: super_admin todo, school_admin/director
-- del propio colegio pueden administrar, cualquiera puede leer (el sitio
-- público no tiene sesión).
do $$
declare
  t text;
begin
  foreach t in array array['website_services', 'website_team_members', 'website_testimonials', 'website_faqs']
  loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "%1$s_super_admin_all" on %1$I', t);
    execute format(
      'create policy "%1$s_super_admin_all" on %1$I for all using (is_super_admin()) with check (is_super_admin())',
      t
    );

    execute format('drop policy if exists "%1$s_staff_manage" on %1$I', t);
    execute format(
      'create policy "%1$s_staff_manage" on %1$I for all ' ||
      'using (school_id in (select school_id from users_profiles where auth_id = auth.uid() and role in (''school_admin'', ''director''))) ' ||
      'with check (school_id in (select school_id from users_profiles where auth_id = auth.uid() and role in (''school_admin'', ''director'')))',
      t
    );

    execute format('drop policy if exists "%1$s_public_read" on %1$I', t);
    execute format('create policy "%1$s_public_read" on %1$I for select using (true)', t);

    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant select on %I to anon', t);
    execute format('grant all privileges on %I to service_role', t);
  end loop;
end $$;

-- Expone las listas nuevas junto al resto de `schools_public` para que
-- /colegio/[subdomain] las lea en una sola consulta consistente con el
-- resto del sitio público (mismo patrón ya usado para website_settings).
grant select on website_services, website_team_members, website_testimonials, website_faqs to anon, authenticated;
