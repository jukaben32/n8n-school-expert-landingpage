-- =========================================================================
-- SCHOOLOS — Migración 023: documento de preguntas frecuentes por colegio
--
-- Complementa el asistente de IA de Portal Familiar: además de los datos
-- que ya lee de la base de datos (facturas, asistencia, hijos), muchas de
-- las preguntas más comunes de los padres no "viven" en ninguna tabla
-- (horarios, política de uniforme, menú de cafetería, reglas generales).
-- Este campo le da a cada colegio un lugar donde escribir esas respuestas
-- una sola vez, en texto libre, y que el asistente las use como contexto
-- adicional en cada conversación.
-- =========================================================================

alter table schools add column if not exists faq_document text;

comment on column schools.faq_document is
  'Texto libre con preguntas frecuentes y políticas del colegio (horarios, uniforme, cafetería, etc.) que el asistente de IA usa como contexto adicional, junto con los datos reales de cada familia.';
