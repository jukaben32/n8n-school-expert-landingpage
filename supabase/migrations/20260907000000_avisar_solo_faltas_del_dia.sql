-- =========================================================================
-- MentorIApp — El aviso de ausencia solo sale si la falta es de HOY
--
-- Motivo (2026-09-04): el colegio quiere cargar la asistencia atrasada
-- (ayer, y varios días de agosto que quedaron sin registrar). Tal como
-- estaba, este trigger disparaba un aviso al tutor por CADA fila de
-- ausencia/tardanza insertada, sin mirar la fecha del registro. Cargar un
-- mes de faltas viejas habría enviado una avalancha de avisos a los padres
-- por ausencias de hace semanas -- y el texto del mensaje decía además "el
-- día de hoy" (corregido aparte, en la Edge Function notify-attendance).
--
-- La regla correcta, y permanente: un aviso automático solo tiene sentido
-- el mismo día de la falta. Para cualquier registro con fecha anterior
-- (carga atrasada, corrección de un error, un profesor poniéndose al día)
-- la fila se guarda igual, pero sin molestar al tutor.
--
-- La zona horaria es la misma que usa la aplicación (America/Santo_Domingo,
-- UTC-4 todo el año) -- ver web/src/lib/schoolDate.ts. Usar la fecha en UTC
-- marcaría como "de mañana" todo lo registrado después de las 8pm.
--
-- El resto de la función queda idéntico a la versión anterior.
-- =========================================================================

create or replace function notify_attendance_webhook()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'private', 'pg_temp'
as $function$
declare
  payload jsonb;
  edge_function_url text;
  webhook_secret text;
begin
  if new.status not in ('ausente', 'tardanza') then
    return new;
  end if;

  -- Solo se avisa por faltas del día en curso (hora del colegio).
  if new.date is distinct from (now() at time zone 'America/Santo_Domingo')::date then
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
$function$;

comment on function notify_attendance_webhook() is
    'Avisa al tutor de una ausencia/tardanza vía la Edge Function '
    'notify-attendance. Solo dispara si la falta es del día en curso '
    '(hora del colegio): las cargas de asistencia atrasada se guardan '
    'sin notificar a nadie.';
