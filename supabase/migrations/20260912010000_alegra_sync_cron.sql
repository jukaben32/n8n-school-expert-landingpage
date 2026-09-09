-- =========================================================================
-- Conciliación Alegra: la corrida diaria (7:00 pm, lunes a viernes)
--
-- Quién dispara: pg_cron dentro de la propia base, llamando por HTTP con
-- pg_net al Route Handler `/api/cron/alegra` de la app. Se eligió esto en
-- vez de Vercel Cron por dos razones concretas:
--   * Vercel Cron en el plan Hobby solo permite UNA corrida al día y a una
--     hora aproximada, sin días de la semana -- no puede ser "7pm de lunes
--     a viernes".
--   * pg_net + private.app_settings ya es el patrón que este proyecto usa
--     para el correo de leads y el aviso de asistencia; no introduce una
--     pieza nueva que mantener.
--
-- ⚠️ TRAMPA YA CONOCIDA DE ESTE REPO, respetada aquí: `net.http_post()`
-- espera `body` como **jsonb**, no text. Pasarlo con `::text` hace fallar
-- la llamada con "function net.http_post(...) does not exist" (42883).
-- Costó dos bugs reales (correo de leads, migración 013/017; y el trigger
-- de asistencia, que además revertía el INSERT entero, migración 019).
--
-- Hora: 23:00 UTC = 7:00 pm en República Dominicana (UTC-4 todo el año,
-- el país no cambia de hora). `1-5` es lunes a viernes.
--
-- Idempotente: se puede volver a aplicar sin efecto.
-- =========================================================================

create extension if not exists pg_net with schema extensions;

-- pg_cron puede no estar habilitado en el proyecto. Si no lo está, esta
-- migración no debe reventar: deja el resto aplicado y avisa qué falta.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'No se pudo habilitar pg_cron (%). Habilítalo en el Dashboard de Supabase → Database → Extensions y vuelve a aplicar esta migración.', sqlerrm;
  end;
end $$;

-- URL pública de la app (no es un secreto; ya documentada en AGENTS.md).
insert into private.app_settings (key, value)
values ('app_site_url', 'https://www.educacionmanantial.com')
on conflict (key) do nothing;

-- El secreto compartido NO se escribe aquí a propósito -- no debe vivir en
-- el repositorio. Se carga una sola vez, a mano, con el MISMO valor que la
-- variable de entorno CRON_SECRET de Vercel:
--
--   insert into private.app_settings (key, value)
--   values ('alegra_cron_secret', 'EL-MISMO-VALOR-QUE-CRON_SECRET')
--   on conflict (key) do update set value = excluded.value;

create or replace function private.disparar_alegra_sync()
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

  -- Sin secreto no se llama a nadie. Mejor una corrida que no ocurre y se
  -- nota en la alerta de "última actualización", que una llamada sin
  -- autorización que la app va a rechazar con 401 todos los días.
  if base_url is null or base_url = '' or secreto is null or secreto = '' then
    raise notice 'Conciliación Alegra sin configurar: falta app_site_url o alegra_cron_secret en private.app_settings.';
    return;
  end if;

  perform net.http_post(
    url     := base_url || '/api/cron/alegra',
    body    := '{}'::jsonb,                       -- jsonb, NUNCA ::text
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || secreto
               ),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function private.disparar_alegra_sync() from public, anon, authenticated;
grant execute on function private.disparar_alegra_sync() to service_role;

-- Programación: 7:00 pm hora RD, de lunes a viernes.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('alegra-sync-diario')
      where exists (select 1 from cron.job where jobname = 'alegra-sync-diario');
    perform cron.schedule(
      'alegra-sync-diario',
      '0 23 * * 1-5',
      $cron$ select private.disparar_alegra_sync(); $cron$
    );
  else
    raise notice 'pg_cron no está habilitado: la conciliación diaria NO quedó programada. Habilita la extensión y vuelve a aplicar esta migración.';
  end if;
end $$;
