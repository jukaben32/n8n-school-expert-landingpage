-- =========================================================================
-- MentorIApp — Database Webhook para notify-ai-conversation
-- =========================================================================
--
-- Qué resuelve: hoy nadie del colegio se entera cuando una familia le
-- escribe al Asistente de IA del Portal Familiar, a menos que entre
-- manualmente a /dashboard/asistente-ia -- confirmado revisando
-- conversaciones reales (2026-09-22): casos como "mi hijo faltó por cita
-- médica" o "la asistencia no se actualiza" solo se resolvían si alguien
-- se acordaba de revisar el panel.
--
-- Mismo patrón que notify_attendance_webhook
-- (20260702220000_attendance_webhook_private_config.sql): trigger AFTER
-- INSERT que llama a una Edge Function vía pg_net, leyendo URL/secret de
-- private.app_settings (edge_function_url / webhook_secret, ya
-- configurados en producción para el webhook de asistencia -- se reusan
-- tal cual).
--
-- Debounce: NO se llama a la Edge Function en cada mensaje. Solo cuando es
-- el PRIMER mensaje ('role'='user') de esa familia en las últimas 24h
-- (ventana móvil) -- mismo criterio que ya usa
-- web/src/lib/ai/answerFamilyQuestion.ts (checkDailyLimit) para no atarlo
-- a "día calendario" ni a la zona horaria del colegio. Así una
-- conversación de varios mensajes seguidos (ej. la familia Carreño Diaz,
-- 4 mensajes en una noche) genera un solo correo, no cuatro.
-- =========================================================================

create or replace function public.notify_ai_conversation_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private, pg_temp
as $$
declare
  payload jsonb;
  edge_function_url text;
  webhook_secret text;
  ya_avisado_hoy boolean;
begin
  -- Solo mensajes del padre/tutor, nunca las respuestas del asistente.
  if new.role <> 'user' then
    return new;
  end if;

  select exists(
    select 1 from ai_conversations
    where family_id = new.family_id
      and role = 'user'
      and id <> new.id
      and created_at >= now() - interval '24 hours'
  ) into ya_avisado_hoy;

  if ya_avisado_hoy then
    return new;
  end if;

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'ai_conversations',
    'schema', 'public',
    'record', row_to_json(new)::jsonb,
    'old_record', null
  );

  edge_function_url := private.get_app_setting('edge_function_url');

  if edge_function_url is null or edge_function_url = '' then
    raise warning 'edge_function_url no configurado. Saltando notificacion de conversacion de IA.';
    return new;
  end if;

  webhook_secret := private.get_app_setting('webhook_secret');

  perform net.http_post(
    url := edge_function_url || '/notify-ai-conversation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(webhook_secret, '')
    ),
    body := payload::text
  );

  return new;
end;
$$;

revoke execute on function public.notify_ai_conversation_webhook() from public, anon, authenticated;

drop trigger if exists trigger_notify_ai_conversation on ai_conversations;
create trigger trigger_notify_ai_conversation
  after insert on ai_conversations
  for each row
  execute function public.notify_ai_conversation_webhook();
