-- =========================================================================
-- MentorIApp — Franjas horarias por nivel
--
-- Problema real encontrado al ir a cargar los horarios 2026-2027 del
-- colegio piloto: `class_periods` era una sola lista plana por colegio,
-- pero el colegio usa DOS rejillas horarias distintas a la vez:
--
--   Primaria   : 7:40-8:30, 8:30-9:20, recreo, 10:20-11:10, 11:10-11:50,
--                11:50-12:30
--   Secundaria : 7:30-8:20, 8:20-9:10, 9:10-10:00, 10:00-10:50,
--                recreo 10:50-11:10, 11:10-12:10, 12:10-1:00
--
-- Sin forma de distinguirlas, la pantalla de horarios mostraba las franjas
-- de primaria al abrir un curso de secundaria (y al revés).
--
-- Solución: una columna `level` opcional en class_periods.
--   - `null`  => la franja aplica a TODOS los niveles (comportamiento
--                anterior; por eso la columna es nullable y no rompe a
--                ningún colegio que use una sola rejilla).
--   - valor   => la franja aplica solo a ese nivel.
--
-- Los valores permitidos son los mismos de `grade_levels.category`, para
-- no inventar un segundo vocabulario de niveles en el proyecto.
-- =========================================================================

alter table class_periods
    add column if not exists level text;

-- Idempotente: la migración puede re-correrse sin fallar por el constraint.
alter table class_periods
    drop constraint if exists class_periods_level_check;

alter table class_periods
    add constraint class_periods_level_check
    check (level is null or level in ('parvulo', 'inicial', 'primaria', 'secundaria'));

comment on column class_periods.level is
    'Nivel al que aplica la franja (mismos valores que grade_levels.category). '
    'NULL = aplica a todos los niveles.';

-- La pantalla de horarios consulta por colegio + nivel, ordenando por
-- sort_order; este índice cubre ese acceso.
create index if not exists idx_class_periods_school_level
    on class_periods(school_id, level, sort_order);
