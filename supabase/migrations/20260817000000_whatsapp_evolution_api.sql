-- =========================================================================
-- MentorIApp — Migración 025: WhatsApp real vía Evolution API
--
-- La migración 024 dejó `whatsapp_connections` como una cáscara (un
-- formulario que solo guardaba texto, sin backend real). Esta la completa:
-- agrega las columnas que el flujo real de Evolution API necesita.
--
-- Decisión confirmada con el usuario (2026-08-17): se usa Evolution API
-- (un servidor/VPS compartido con el proyecto de referencia real-estate,
-- cada app con su propio prefijo de instancia) en vez de Twilio, que era
-- la decisión anterior documentada en AGENTS.md — se actualiza ese
-- documento en el mismo cambio.
-- =========================================================================

alter table whatsapp_connections
  add column if not exists instance_token text,
  add column if not exists is_enabled boolean not null default true;

comment on column whatsapp_connections.instance_token is
  'Credencial de la instancia en Evolution API (por conexión) — separada del EVOLUTION_API_KEY global, que solo crea/borra instancias.';

comment on column whatsapp_connections.is_enabled is
  'Si está apagado, el webhook de WhatsApp recibe el mensaje pero no responde automáticamente.';
