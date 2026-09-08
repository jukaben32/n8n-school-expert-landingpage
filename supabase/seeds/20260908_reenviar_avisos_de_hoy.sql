-- =========================================================================
-- Reenvía el aviso de ausencia de las faltas de HOY que quedaron sin
-- notificar mientras el remitente de Resend estaba mal (403, ver AGENTS.md
-- "El aviso de ausencia NUNCA había llegado a un padre").
--
-- Correrlo en el SQL Editor de Supabase. Se puede correr varias veces sin
-- riesgo: solo toma las que siguen con notified_at nulo, así que una que ya
-- se avisó no se vuelve a avisar.
--
-- Hace EXACTAMENTE la misma llamada que notify_attendance_webhook() y no
-- escribe ni una fila de `attendance`: la Edge Function escribe ella misma
-- notified_at/notification_channel al terminar.
--
-- Solo toma las faltas de hoy (mismo criterio de siempre: nunca se avisa de
-- listas atrasadas) y solo aquellas con un tutor que tenga correo cargado.
-- Devuelve la lista de a quién se le avisó.
-- =========================================================================

select s.first_name || ' ' || s.last_name as estudiante,
       a.status,
       g.email as se_avisa_a,
       net.http_post(
         url := private.get_app_setting('edge_function_url') || '/notify-attendance',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-webhook-secret', coalesce(private.get_app_setting('webhook_secret'), '')
         ),
         body := jsonb_build_object(
           'type', 'INSERT', 'table', 'attendance', 'schema', 'public',
           'record', row_to_json(a)::jsonb, 'old_record', null
         )
       )::text as encolado
from attendance a
join students s on s.id = a.student_id
join lateral (
  select g.email
  from student_guardians sg
  join guardians g on g.id = sg.guardian_id
  where sg.student_id = a.student_id
    and sg.pickup_auth is true
    and g.email is not null
  order by g.is_primary desc nulls last
  limit 1
) g on true
where a.date = (now() at time zone 'America/Santo_Domingo')::date
  and a.status in ('ausente', 'tardanza')
  and a.notified_at is null;

-- Para comprobar el resultado unos segundos después:
--   select s.first_name, a.status, a.notified_at, a.notification_channel
--   from attendance a join students s on s.id = a.student_id
--   where a.date = (now() at time zone 'America/Santo_Domingo')::date
--     and a.status in ('ausente','tardanza');
