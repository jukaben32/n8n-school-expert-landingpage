-- =========================================================================
-- Corrección de datos (NO es migración de esquema) — 2026-09-06
--
-- Dos irregularidades encontradas al revisar por qué el desplegable de
-- cursos de "Nueva lección" mostraba 18 opciones para 16 cursos reales.
-- Ambas comparten la misma causa de fondo: `students.grade_level` y
-- `teacher_assignments.grade_level` son texto libre que se comparan
-- CARÁCTER POR CARÁCTER dentro de las policies de RLS, así que una
-- variante de escritura no da error -- deja a alguien sin ver nada.
--
-- Se corre a mano en el SQL Editor de Supabase: el clasificador de
-- seguridad del harness bloquea las escrituras a producción desde una
-- sesión de Claude Code (mismo bloqueo ya documentado para la carga de
-- horarios del 2026-08-23).
--
-- ── ESTADO MEDIDO ANTES DE APLICAR (simulando la sesión de cada docente
--    igual que PostgREST: set local role authenticated + claim sub) ──────
--    Yuleymis Lugo ............  0 estudiantes visibles  ← ROTA
--    Yendry Paulino Bastardo ... 34
--    Nercy Rodríguez ........... 55
--    Marianelis Rivera ......... 60
-- =========================================================================

begin;

-- ── A) Dos estudiantes con el curso mal escrito ──────────────────────────
-- Samir (Pre-primario, 1 alumno) vs Pre Primario (22). Ahleys (4to de
-- secundaria, 1) vs 4to. Secundaria (14). Mientras estuvieron así, esos
-- dos eran invisibles para su profesora en Asistencia, no recibían los
-- comunicados de su curso y no habrían visto ninguna lección de Academia.
-- El `and grade_level = ...` hace el update idempotente: si ya se corrigió,
-- no afecta ninguna fila.
update students set grade_level = 'Pre Primario',
       first_name = trim(first_name), last_name = trim(last_name)
 where id = '252dfda2-8d2e-471a-8e14-053d5ac5551a' and grade_level = 'Pre-primario';

update students set grade_level = '4to. Secundaria',
       first_name = trim(first_name), last_name = trim(last_name)
 where id = '9dc54d95-06e0-41bc-a85c-caf4c45a9e77' and grade_level = '4to de secundaria';

-- ── B) Yuleymis Lugo no veía a NINGÚN estudiante ─────────────────────────
-- Su única asignación era el texto "Primer Ciclo Primaria (1,2,3) Inglés",
-- que no calza con el grade_level de ningún estudiante. Se le dan sus tres
-- cursos reales del 1er ciclo de primaria, en categoría `regular` porque
-- es la que exigen las policies de students/attendance/class_updates/
-- class_schedules (todas llaman teacher_is_assigned_to_grade(...,'regular')).
--
-- OJO -- LA TRAMPA: pasar a las docentes de Inglés a category='ingles'
-- parece lo correcto por la estructura de Amco, pero les QUITARÍA
-- Asistencia. La categoría `ingles` sirve para enrutar Mensajes, no para
-- ver estudiantes. Si algún día se agrega, que sea SUMANDO filas, nunca
-- convirtiendo las `regular`.
--
-- El insert va ANTES del delete para que Yuleymis nunca quede sin ninguna
-- asignación, ni por un instante dentro de la transacción.
insert into teacher_assignments (school_id, staff_id, grade_level, category) values
 ('0001da6e-2fe8-4dc9-97bf-8eadb7ee944e','8943000e-41d5-447a-9480-427cb5e23c94','1ro. Primaria','regular'),
 ('0001da6e-2fe8-4dc9-97bf-8eadb7ee944e','8943000e-41d5-447a-9480-427cb5e23c94','2do. Primaria','regular'),
 ('0001da6e-2fe8-4dc9-97bf-8eadb7ee944e','8943000e-41d5-447a-9480-427cb5e23c94','3ro. Primaria','regular')
on conflict do nothing;

-- ── C) Las 3 filas con el ciclo escrito a mano ───────────────────────────
-- No calzan con ningún estudiante. Eran el pendiente que dejó anotado la
-- carga de horarios del 2026-08-23 ("category sigue en 'regular' para todo,
-- con el ciclo escrito a mano dentro del texto del grado").
delete from teacher_assignments
 where id in ('0ff6f323-183c-423b-9ed5-7c5e356d928d',   -- Marianelis Rivera (conserva 4to/5to/6to Primaria)
              'd80fbd63-2592-4e9b-9ec1-1b412481a2dd',   -- Yendry Paulino (registro DUPLICADO, borrado el 2026-08-23)
              'db2ba0c4-767c-41f3-8be1-2413632a3f3b');  -- Yuleymis Lugo (reemplazada por el insert de arriba)

commit;

-- =========================================================================
-- CÓMO REVERTIR (estado exacto de antes, tomado de la base el 2026-09-06)
-- =========================================================================
-- begin;
-- update students set grade_level = 'Pre-primario'
--  where id = '252dfda2-8d2e-471a-8e14-053d5ac5551a';
-- update students set grade_level = '4to de secundaria'
--  where id = '9dc54d95-06e0-41bc-a85c-caf4c45a9e77';
-- -- (los nombres llevaban espacios sobrantes: 'Ahleys Yasuris ' / 'Sanchez ')
--
-- delete from teacher_assignments
--  where staff_id = '8943000e-41d5-447a-9480-427cb5e23c94'
--    and category = 'regular'
--    and grade_level in ('1ro. Primaria','2do. Primaria','3ro. Primaria');
--
-- insert into teacher_assignments (id, school_id, staff_id, grade_level, category) values
--  ('0ff6f323-183c-423b-9ed5-7c5e356d928d','0001da6e-2fe8-4dc9-97bf-8eadb7ee944e','47e2602b-0544-4d73-85c9-9482b8db5c18','2do. Ciclo Primaria(4,5,6) Inglés','regular'),
--  ('d80fbd63-2592-4e9b-9ec1-1b412481a2dd','0001da6e-2fe8-4dc9-97bf-8eadb7ee944e','d90cbeea-ddb0-4faf-ada7-b69dda873497','Segundo Ciclo Secundaria (4,5,6)  Inglés','regular'),
--  ('db2ba0c4-767c-41f3-8be1-2413632a3f3b','0001da6e-2fe8-4dc9-97bf-8eadb7ee944e','8943000e-41d5-447a-9480-427cb5e23c94','Primer Ciclo Primaria (1,2,3) Inglés','regular');
-- commit;
-- =========================================================================
