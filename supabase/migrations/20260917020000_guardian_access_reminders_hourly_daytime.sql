-- =========================================================================
-- Recordatorios de acceso familiar: tandas horarias durante el dia
--
-- Mantiene tandas pequenas de 5 para evitar timeouts, pero ejecuta el cron
-- de 7:00 am a 6:00 pm hora RD (11:00-22:00 UTC). Maximo: 60 correos/dia.
-- =========================================================================

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where command ilike '%disparar_guardian_access_reminders%'
  order by jobid
  limit 1;

  if exists (select 1 from cron.job where jobname = 'guardian-access-reminders-horario-diurno') then
    perform cron.unschedule('guardian-access-reminders-horario-diurno');
  end if;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'guardian-access-reminders-horario-diurno',
    '0 11-22 * * *',
    $cron$ select private.disparar_guardian_access_reminders(); $cron$
  );
end $$;