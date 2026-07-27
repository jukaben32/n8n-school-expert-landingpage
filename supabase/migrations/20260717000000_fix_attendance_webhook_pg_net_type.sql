-- =========================================================================
-- SCHOOLOS — Migración 019: corrige `::text` en notify_attendance_webhook()
--
-- Mismo bug que ya se corrigió en el trigger de leads (migración
-- 20260715000000): net.http_post() declara su parámetro `body` como
-- `jsonb`, no `text`. Postgres no tiene cast implícito de text a jsonb
-- para resolver argumentos de función, así que la llamada nunca
-- resuelve: "function net.http_post(...) does not exist" (42883).
--
-- Confirmado con evidencia real (no supuesto): 3 inserts de prueba en
-- `attendance` con status='ausente'/'tardanza' (revertidos con
-- ROLLBACK) fallaron con ese error antes del fix -- y como el trigger
-- es AFTER INSERT sin manejo de excepción, el error revertía el
-- INSERT completo. No era "la notificación falla en silencio": era
-- imposible registrar una ausencia o tardanza en el sistema, punto.
--
-- NOTA: la función handle_new_lead() (leads) NO se re-declara aquí --
-- ya se corrigió como migración propiamente en 20260715000000, sin
-- desincronización entre este repo y la base de datos real.
-- =========================================================================

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
    body := payload
    -- (sin ::text -- pg_net espera jsonb en `body`, no texto)
  );

  return new;
end;
$$;

revoke execute on function public.notify_attendance_webhook() from public, anon, authenticated;
