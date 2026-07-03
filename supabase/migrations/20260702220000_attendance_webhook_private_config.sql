-- =========================================================================
-- SCHOOLOS - Configuracion privada para webhook de asistencia
-- =========================================================================
-- Evitamos usar parametros ALTER DATABASE porque el rol de despliegue remoto
-- puede no tener permiso para definir custom GUCs. Esta tabla vive fuera del
-- schema public, no se expone por la Data API y solo la lee la funcion trigger.
-- =========================================================================

create schema if not exists private;

create table if not exists private.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.app_settings to service_role;

create or replace function private.get_app_setting(setting_key text)
returns text
language sql
security definer
set search_path = private, pg_temp
as $$
  select value
  from private.app_settings
  where key = setting_key
  limit 1;
$$;

revoke execute on function private.get_app_setting(text) from public, anon, authenticated;
grant execute on function private.get_app_setting(text) to service_role;

-- Reemplaza el trigger para leer URL/secret desde private.app_settings.
create or replace function public.notify_attendance_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private, pg_temp
as $$
declare
  payload jsonb;
  edge_function_url text;
  webhook_secret text;
begin
  -- Solo notificar ausencias y tardanzas (no presentes ni justificados).
  if new.status not in ('ausente', 'tardanza') then
    return new;
  end if;

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'attendance',
    'schema', 'public',
    'record', row_to_json(new)::jsonb,
    'old_record', null
  );

  edge_function_url := private.get_app_setting('edge_function_url');

  if edge_function_url is null or edge_function_url = '' then
    raise warning 'edge_function_url no configurado. Saltando notificacion.';
    return new;
  end if;

  webhook_secret := private.get_app_setting('webhook_secret');

  perform net.http_post(
    url := edge_function_url || '/notify-attendance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(webhook_secret, '')
    ),
    body := payload::text
  );

  return new;
end;
$$;

revoke execute on function public.notify_attendance_webhook() from public, anon, authenticated;
