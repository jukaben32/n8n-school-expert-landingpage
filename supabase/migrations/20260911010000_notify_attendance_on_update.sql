-- =========================================================================
-- MentorIApp — El aviso de ausencia también sale cuando la falta se marca
-- al CORREGIR la lista, no solo al crearla
--
-- Hallazgo real (2026-09-08, revisando por qué no llegaban avisos): el
-- trigger era `after insert` y nada más. La profesora guarda la lista
-- completa y después corrige a alguien de 'presente' a 'ausente' -- ese
-- segundo guardado es un UPDATE (AttendanceForm hace upsert con
-- `on conflict do update`), así que NO disparaba ningún aviso. De las 33
-- faltas de los dos días anteriores, 9 se quedaron sin llegar siquiera a
-- la Edge Function por este motivo.
--
-- La regla de "solo se avisa por faltas del día en curso" NO cambia: vive
-- dentro de notify_attendance_webhook() (migración 20260907000000) y sigue
-- protegiendo la carga de listas atrasadas -- cargar un mes de faltas
-- viejas sigue sin molestar a ningún tutor.
--
-- OJO con la cláusula WHEN, no es decorativa:
--   * `new.status is distinct from old.status` -- la propia Edge Function
--     escribe notified_at/notification_channel/ai_message_sent sobre esta
--     misma fila al terminar. Sin esta condición, ese UPDATE volvería a
--     disparar el trigger, que llamaría otra vez a la función... en bucle
--     infinito, mandándole correos sin parar al tutor.
--   * `new.notified_at is null` -- si ya se avisó de esa falta, corregir y
--     volver a marcar ausente no manda un segundo aviso.
--
-- Se agrega como un trigger APARTE en vez de modificar el de insert: menor
-- radio de impacto y se revierte con un solo `drop trigger`.
-- =========================================================================

drop trigger if exists trigger_notify_attendance_update on attendance;

create trigger trigger_notify_attendance_update
after update on attendance
for each row
when (
  new.status is distinct from old.status
  and new.status in ('ausente', 'tardanza')
  and new.notified_at is null
)
execute function notify_attendance_webhook();
