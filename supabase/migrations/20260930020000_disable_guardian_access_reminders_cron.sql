-- =========================================================================
-- Desactivar recordatorios automaticos de acceso al Portal Familiar
--
-- Durante la transicion al acceso por celular + codigo de WhatsApp, no
-- queremos que la base siga enviando correos automaticos cada hora a los
-- tutores que nunca han entrado al portal.
--
-- Esto NO borra la tabla historica guardian_access_reminders ni la ruta de
-- soporte. Solo elimina los trabajos programados en pg_cron.
-- =========================================================================

do $$
declare
  job record;
begin
  if to_regnamespace('cron') is null then
    raise notice 'Schema cron no existe: no hay recordatorios automaticos que desprogramar.';
    return;
  end if;

  for job in
    select jobid, jobname
    from cron.job
    where jobname in (
      'guardian-access-reminders-diario',
      'guardian-access-reminders-horario-diurno'
    )
    or command ilike '%disparar_guardian_access_reminders%'
    order by jobid
  loop
    perform cron.unschedule(job.jobid);
    raise notice 'Cron de recordatorio familiar desactivado: % (%)', job.jobname, job.jobid;
  end loop;
end $$;
