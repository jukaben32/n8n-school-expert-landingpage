-- =========================================================================
-- MentorIApp — Migración 036: clasificación de Comunicados por materia
--
-- A diferencia de Mensajes directos (migración 035), acá la categoría es
-- solo una CLASIFICACIÓN de salida, no una restricción de lectura: un
-- padre sigue viendo todos los comunicados dirigidos a él sin importar la
-- materia (el pedido del usuario es que los avisos del equipo de Inglés
-- "tengan una clasificación separada", no que se oculten). Por eso no se
-- toca ninguna policy de lectura de guardian.
--
-- Quién puede PUBLICAR en cada categoría se valida en código de aplicación
-- (createMessageAction), mismo patrón que ya usa el cruce contra
-- teacher_assignments para el grado/sección -- el insert va con el
-- cliente admin, así que la regla real vive ahí, no en una policy de RLS.
-- =========================================================================

alter table messages add column if not exists category text not null default 'regular'
    check (category in ('regular', 'ingles', 'deporte'));
