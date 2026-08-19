-- =========================================================================
-- MentorIApp — Migración 024: groundwork de WhatsApp + sitio web del colegio
--
-- Objetivo:
-- - Preparar el dashboard para un canal WhatsApp conectado directo a
--   Evolution API, sin n8n.
-- - Seguir usando el JSON existente de `schools.settings` para las
--   preferencias del sitio público del colegio, exponiendo solo una
--   proyección segura en `schools_public`.
--
-- No se cambia ninguna funcionalidad existente: es una base aditiva.
-- =========================================================================

create table if not exists whatsapp_connections (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    provider text not null default 'evolution_api',
    label text not null default 'WhatsApp principal',
    assistant_name text not null default 'Asistente de IA',
    phone_number text,
    instance_name text,
    api_base_url text,
    webhook_path text not null default '/api/whatsapp/webhook',
    status text not null default 'disconnected'
        check (status in ('disconnected', 'connecting', 'connected', 'error')),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table whatsapp_connections is
  'Configuración del canal WhatsApp por colegio. Pensado para Evolution API sobre el VPS, sin n8n.';

comment on column whatsapp_connections.provider is
  'Proveedor del canal. Hoy se fija en Evolution API.';

comment on column whatsapp_connections.assistant_name is
  'Nombre del agente que responderá por WhatsApp.';

comment on column whatsapp_connections.api_base_url is
  'URL base de la instancia de Evolution API en el VPS.';

comment on column whatsapp_connections.webhook_path is
  'Ruta pública que Evolution API usará para notificar mensajes entrantes.';

create unique index if not exists whatsapp_connections_school_id_key
  on whatsapp_connections (school_id);

alter table whatsapp_connections enable row level security;

drop policy if exists "whatsapp_connections_super_admin_all" on whatsapp_connections;
create policy "whatsapp_connections_super_admin_all" on whatsapp_connections
for all
using (is_super_admin())
with check (is_super_admin());

drop policy if exists "whatsapp_connections_staff_select" on whatsapp_connections;
create policy "whatsapp_connections_staff_select" on whatsapp_connections
for select
using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('school_admin', 'director')
    )
);

drop policy if exists "whatsapp_connections_staff_insert" on whatsapp_connections;
create policy "whatsapp_connections_staff_insert" on whatsapp_connections
for insert
with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('school_admin', 'director')
    )
);

drop policy if exists "whatsapp_connections_staff_update" on whatsapp_connections;
create policy "whatsapp_connections_staff_update" on whatsapp_connections
for update
using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('school_admin', 'director')
    )
)
with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('school_admin', 'director')
    )
);

drop policy if exists "whatsapp_connections_staff_delete" on whatsapp_connections;
create policy "whatsapp_connections_staff_delete" on whatsapp_connections
for delete
using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('school_admin', 'director')
    )
);

grant select, insert, update, delete on whatsapp_connections to authenticated;
grant all privileges on whatsapp_connections to service_role;

create or replace function whatsapp_connections_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists whatsapp_connections_set_updated_at on whatsapp_connections;
create trigger whatsapp_connections_set_updated_at
before update on whatsapp_connections
for each row execute function whatsapp_connections_set_updated_at();

-- NOTA (2026-08-19): la redefinición de `schools_public` que originalmente
-- vivía aquí se quitó -- en producción, la vista ya avanzó más allá de esta
-- versión (una sesión anterior aplicó directo, fuera de orden, las columnas
-- de WhatsApp que trae la migración 20260817050000_schools_public_whatsapp.sql).
-- CREATE OR REPLACE VIEW no puede quitar columnas, así que intentar
-- redefinirla aquí con menos columnas que las que ya existen en vivo
-- rompía todo el lote de `supabase db push`. La migración
-- 20260817050000, más adelante en este mismo lote, ya deja la vista en su
-- forma final correcta -- no hace falta duplicarlo aquí.
