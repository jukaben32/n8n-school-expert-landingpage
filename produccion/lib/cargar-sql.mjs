/**
 * Genera el SQL que carga las lecciones producidas en Academia.
 *
 * No escribe en producción: imprime el SQL para pegarlo en el SQL Editor de
 * Supabase. El clasificador de seguridad del harness bloquea las escrituras
 * a la base real desde una sesión de Claude Code -- mismo camino que ya se
 * usó para la carga de horarios y para el arreglo de cursos.
 *
 * Uso:  node lib/cargar-sql.mjs enlaces.json > cargar-lecciones.sql
 *
 * enlaces.json:  { "<id-de-la-leccion>": "https://youtu.be/XXXX", ... }
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

const enlaces = JSON.parse(await readFile(process.argv[2], 'utf8'))
const archivos = (await readdir(path.join(RAIZ, 'lecciones'))).filter((f) => f.endsWith('.json')).sort()

const partes = [`-- Carga de video-lecciones en Academia
-- Generado por produccion/lib/cargar-sql.mjs
--
-- Idempotente: si la lección ya existe (mismo título y curso) se actualiza
-- el video en vez de duplicarla, y su cuestionario se rehace desde cero.
-- Las preguntas se borran en cascada (quiz_questions -> quiz_options).
begin;

do $$
declare
  v_colegio uuid;
  v_materia uuid;
  v_leccion uuid;
  v_pregunta uuid;
  v_autor uuid;
begin
  select id into v_colegio from schools where name ilike '%Gran Manantial%' limit 1;
  if v_colegio is null then raise exception 'no se encontró el colegio'; end if;
  select id into v_autor from users_profiles
    where school_id = v_colegio and role in ('director','school_admin','super_admin') limit 1;
`]

let orden = 0
for (const archivo of archivos) {
  const g = JSON.parse(await readFile(path.join(RAIZ, 'lecciones', archivo), 'utf8'))
  const url = enlaces[g.id]
  if (!url) { console.error(`-- ⚠ sin enlace de video: ${g.id} (se omite)`); continue }
  orden += 10

  partes.push(`
  -- ${g.materia} · ${g.titulo}
  select id into v_materia from subjects where school_id = v_colegio and name = ${q(g.materia)} limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, ${q(g.materia)}) returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = ${q(g.titulo)} and grade_level = ${q(g.curso)} limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, ${q(g.curso)}, ${q(g.titulo)}, ${q(g.descripcion)},
            ${q(url)}, 'youtube', ${orden}, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = ${q(url)}, description = ${q(g.descripcion)},
                       subject_id = v_materia, sort_order = ${orden}, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;
`)

  g.cuestionario.forEach((p, i) => {
    partes.push(`  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, ${q(p.pregunta)}, ${i}, 10) returning id into v_pregunta;`)
    p.opciones.forEach((op, j) => {
      partes.push(`  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, ${q(op)}, ${j === p.correcta}, ${j});`)
    })
  })
}

partes.push(`
end $$;

commit;

-- Comprobación
select l.title, s.name as materia, l.grade_level, l.is_published,
       (select count(*) from quiz_questions q where q.lesson_id = l.id) as preguntas
from lessons l join subjects s on s.id = l.subject_id
order by l.sort_order;`)

console.log(partes.join('\n'))
