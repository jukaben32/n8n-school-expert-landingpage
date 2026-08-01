-- =========================================================================
-- MENTORIAPP — Migración: canal 'voice' en ai_conversations
--
-- Agrega el asistente de voz en vivo (llamada WebRTC en tiempo real vía
-- OpenAI Realtime API, distinto de la nota de voz grabada que ya existe)
-- al Portal Familiar. Reutiliza la misma tabla ai_conversations que ya
-- usan los canales 'widget'/'whatsapp' ("un solo cerebro, dos salidas",
-- ver AGENTS.md) -- cada turno de la llamada (lo que dice el padre, lo que
-- responde el asistente) se guarda aquí igual que en el chat de texto.
--
-- No hace falta política de RLS nueva: la política de lectura existente
-- (`ai_conversations_guardian_read`) ya cubre cualquier fila de la
-- familia sin importar el canal, y las escrituras siguen yendo siempre
-- por `service_role` desde el servidor (nunca desde el cliente).
-- =========================================================================

alter table ai_conversations drop constraint if exists ai_conversations_channel_check;
alter table ai_conversations add constraint ai_conversations_channel_check
    check (channel in ('widget', 'whatsapp', 'voice'));
