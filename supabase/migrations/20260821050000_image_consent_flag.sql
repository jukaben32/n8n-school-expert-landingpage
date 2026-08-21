-- =========================================================================
-- MentorIApp — Marca qué Autorización es la de "Uso de Imagen" (Ley 136-03)
--
-- Permite que Actualizaciones (las fotos cortas del día a día) alerte
-- automáticamente cuando un profesor va a publicar una foto de un
-- estudiante cuyo tutor NO autorizó el uso de imagen (o todavía no ha
-- respondido) -- ver AGENTS.md, sección "Alerta de uso de imagen".
-- =========================================================================

alter table authorization_requests
  add column if not exists is_image_consent boolean not null default false;
