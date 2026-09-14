-- =========================================================================
-- Recordatorios de acceso familiar: bajar tanda a 5
--
-- La tanda de 20 siguió provocando Gateway Timeout en producción. Supabase
-- Auth envía los correos uno por uno y puede tardar más que la ventana HTTP
-- disponible. Bajamos a 5 para priorizar confiabilidad y evitar duplicados.
-- =========================================================================

create or replace function private.disparar_guardian_access_reminders()
returns void
language plpgsql
security definer
set search_path = private, extensions, public, pg_temp
as $$
declare
  base_url text;
  secreto text;
begin
  base_url := private.get_app_setting('app_site_url');
  secreto  := coalesce(private.get_app_setting('cron_secret'), private.get_app_setting('alegra_cron_secret'));

  if base_url is null or base_url = '' or secreto is null or secreto = '' then
    raise notice 'Recordatorios de acceso familiar sin configurar: falta app_site_url o cron_secret/alegra_cron_secret en private.app_settings.';
    return;
  end if;

  perform net.http_post(
    url     := base_url || '/api/cron/guardian-access-reminders?limit=5',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || secreto
               ),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function private.disparar_guardian_access_reminders() from public, anon, authenticated;
grant execute on function private.disparar_guardian_access_reminders() to service_role;
