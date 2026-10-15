-- Envío de los accesos a Excellent (Amco) a las familias: 16-oct-2026, 8:00 am
-- hora RD (UTC-4 todo el año, sin horario de verano) = 12:00 UTC.
--
-- Mismo mecanismo que la conciliación con Alegra: pg_cron -> pg_net -> Route
-- Handler. Reutiliza el secreto `alegra_cron_secret` de private.app_settings
-- (es el mismo valor que la variable CRON_SECRET de Vercel; ver
-- docs/ACTIVAR_CONCILIACION_ALEGRA.md).
--
-- Se programa en TRES horarios (12:00, 12:10 y 12:20 UTC) porque Resend limita
-- la velocidad y una sola corrida atiende un máximo de familias. No hay riesgo
-- de duplicar: la ruta reserva cada familia en `amco_access_dispatches` antes
-- de enviar, y las siguientes corridas solo toman lo que quedó pendiente.

create or replace function private.disparar_amco_excellent()
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
  secreto  := private.get_app_setting('alegra_cron_secret');

  if base_url is null or base_url = '' or secreto is null or secreto = '' then
    raise notice 'Envío Amco sin configurar: falta app_site_url o alegra_cron_secret en private.app_settings.';
    return;
  end if;

  perform net.http_post(
    url     := base_url || '/api/cron/amco-excellent?batch=1',
    body    := '{}'::jsonb,                       -- jsonb, NUNCA ::text
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || secreto
               ),
    timeout_milliseconds := 290000
  );
end;
$$;

revoke execute on function private.disparar_amco_excellent() from public, anon, authenticated;
grant execute on function private.disparar_amco_excellent() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('amco-excellent-lote1')
      where exists (select 1 from cron.job where jobname = 'amco-excellent-lote1');
    perform cron.schedule(
      'amco-excellent-lote1',
      '0,10,20 12 16 10 *',
      $cron$ select private.disparar_amco_excellent(); $cron$
    );
  else
    raise notice 'pg_cron no está habilitado: el envío de Amco NO quedó programado.';
  end if;
end $$;
