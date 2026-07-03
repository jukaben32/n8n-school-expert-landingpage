-- =========================================================================
-- SCHOOLOS — Migración 003: Database Webhook para notify-attendance
-- =========================================================================
--
-- Esta migración crea una función de trigger que llama a la Edge Function
-- `notify-attendance` cada vez que se inserta un registro de ausencia
-- o tardanza en la tabla `attendance`.
--
-- NOTA: En Supabase, los Database Webhooks también se pueden configurar
-- desde el Dashboard → Database → Webhooks. Esta migración lo hace
-- de forma programática para que sea reproducible.
-- =========================================================================

-- Habilita llamadas HTTP desde Postgres usando la extension oficial de Supabase.
create extension if not exists pg_net with schema extensions;

-- Función que invoca la Edge Function via HTTP
-- (Requiere la extensión pg_net, que Supabase habilita por defecto)
create or replace function notify_attendance_webhook()
returns trigger
language plpgsql
security definer
as $$
declare
  payload jsonb;
  edge_function_url text;
  webhook_secret text;
begin
  -- Solo notificar ausencias y tardanzas (no presentes ni justificados)
  if NEW.status not in ('ausente', 'tardanza') then
    return NEW;
  end if;

  -- Construir el payload del webhook (mismo formato que Supabase Database Webhooks)
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'attendance',
    'schema', 'public',
    'record', row_to_json(NEW)::jsonb,
    'old_record', null
  );

  -- URL de la Edge Function (ajustar con el PROJECT_REF real)
  -- Formato: https://<PROJECT_REF>.supabase.co/functions/v1/notify-attendance
  edge_function_url := current_setting('app.edge_function_url', true);

  if edge_function_url is null then
    raise warning 'app.edge_function_url no configurado. Saltando notificación.';
    return NEW;
  end if;

  webhook_secret := current_setting('app.webhook_secret', true);

  -- Llamada HTTP asíncrona a la Edge Function (no bloquea el INSERT)
  perform net.http_post(
    url := edge_function_url || '/notify-attendance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(webhook_secret, '')
    ),
    body := payload::text
  );

  return NEW;
end;
$$;

-- Trigger que se dispara AFTER INSERT en la tabla attendance
drop trigger if exists trigger_notify_attendance on attendance;
create trigger trigger_notify_attendance
  after insert on attendance
  for each row
  execute function notify_attendance_webhook();

-- =========================================================================
-- Configuración de los parámetros de la aplicación
-- =========================================================================
-- Ejecuta estos comandos manualmente en tu proyecto Supabase con los valores reales:
--
-- alter database postgres set app.edge_function_url = 'https://TUREF.supabase.co/functions/v1';
-- alter database postgres set app.webhook_secret = 'TU_WEBHOOK_SECRET';
--
-- Después de cambiarlos, recarga la configuración:
-- select pg_reload_conf();
-- =========================================================================
