-- =========================================================================
-- Seguimiento automático de acceso al Portal Familiar
--
-- Objetivo: reenviar enlaces de contraseña a tutores que ya tienen acceso
-- creado, pero todavía no han iniciado sesión. No crea usuarios ni perfiles;
-- solo registra intentos y detiene el seguimiento al regularizarse.
--
-- Hora: 11:00 UTC = 7:00 am en República Dominicana (UTC-4 todo el año).
-- =========================================================================

create table if not exists public.guardian_access_reminders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  guardian_id uuid not null references public.guardians(id),
  reminder_count integer not null default 0 check (reminder_count >= 0),
  last_sent_at timestamptz,
  stopped_at timestamptz,
  stop_reason text check (stop_reason in ('regularizado','max_intentos','auth_no_existe','correo_no_coincide')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guardian_id)
);

create index if not exists idx_guardian_access_reminders_school
  on public.guardian_access_reminders (school_id);

create index if not exists idx_guardian_access_reminders_pending
  on public.guardian_access_reminders (school_id, last_sent_at)
  where stopped_at is null;

alter table public.guardian_access_reminders enable row level security;

create extension if not exists pg_net with schema extensions;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'No se pudo habilitar pg_cron (%). Habilítalo en Supabase y vuelve a aplicar esta migración.', sqlerrm;
  end;
end $$;

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
    url     := base_url || '/api/cron/guardian-access-reminders',
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

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('guardian-access-reminders-diario')
      where exists (select 1 from cron.job where jobname = 'guardian-access-reminders-diario');
    perform cron.schedule(
      'guardian-access-reminders-diario',
      '0 11 * * *',
      $cron$ select private.disparar_guardian_access_reminders(); $cron$
    );
  else
    raise notice 'pg_cron no está habilitado: los recordatorios de acceso familiar NO quedaron programados.';
  end if;
end $$;
