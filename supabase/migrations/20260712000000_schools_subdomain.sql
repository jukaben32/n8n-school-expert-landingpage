-- =========================================================================
-- SCHOOLOS — Migración 014: agrega schools.subdomain (nunca existió)
--
-- El código de Plataforma (NewSchoolForm, la lista de colegios) siempre
-- asumió que `schools` tenía una columna `subdomain`, pero revisando el
-- historial completo de git, esa columna JAMÁS se creó en ninguna
-- migración -- ni siquiera en la 001 original. El error quedó oculto
-- porque el código anterior tragaba silenciosamente cualquier error de
-- la consulta y lo mostraba igual que "sin colegios".
-- =========================================================================

alter table schools add column if not exists subdomain text unique;

create extension if not exists unaccent;

-- Colegios que ya existían sin subdomain (como el tuyo) reciben uno
-- generado a partir de su nombre, para no dejarlos en null.
update schools
set subdomain = lower(
    regexp_replace(
        regexp_replace(unaccent(name), '[^a-zA-Z0-9]+', '-', 'g'),
        '(^-|-$)', '', 'g'
    )
)
where subdomain is null;
