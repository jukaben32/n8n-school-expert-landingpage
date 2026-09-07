/**
 * Genera el SQL que carga las lecciones producidas en Academia.
 *
 * Formato compacto: los datos van como un literal JSON y un solo bucle los
 * recorre, en vez de repetir un INSERT por cada opción de cada pregunta.
 * Baja de ~600 líneas a ~40, que es la diferencia entre pegable y no.
 *
 * SIN `begin`/`commit` explícitos a propósito: el SQL Editor de Supabase
 * maneja su propia transacción, y un BEGIN anidado hace que el bloque corra,
 * diga "Success" y no persista NADA. Pasó de verdad.
 *
 * Uso:  node lib/cargar-sql.mjs enlaces.json > cargar-lecciones.sql
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const enlaces = JSON.parse(await readFile(process.argv[2], 'utf8'))
const archivos = (await readdir(path.join(RAIZ, 'lecciones'))).filter((f) => f.endsWith('.json')).sort()

const datos = []
let orden = 0
for (const archivo of archivos) {
  const g = JSON.parse(await readFile(path.join(RAIZ, 'lecciones', archivo), 'utf8'))
  const url = enlaces[g.id]
  if (!url) { console.error(`-- ⚠ sin enlace: ${g.id}`); continue }
  datos.push({
    materia: g.materia, curso: g.curso, titulo: g.titulo, descripcion: g.descripcion,
    video: url, orden: (orden += 10),
    preguntas: g.cuestionario.map((p) => ({ p: p.pregunta, o: p.opciones, c: p.correcta })),
  })
}

console.log(`-- Carga de video-lecciones en Academia (${datos.length} lecciones)
-- Generado por produccion/lib/cargar-sql.mjs
--
-- Idempotente: si la lección ya existe (mismo título y curso) actualiza el
-- video y rehace su cuestionario, en vez de duplicarla.
--
-- OJO: sin BEGIN/COMMIT a propósito. El SQL Editor de Supabase maneja su
-- propia transacción; un BEGIN anidado deja el bloque sin efecto y aun así
-- responde "Success".

do $$
declare
  d jsonb := $json$${JSON.stringify(datos)}$json$;
  l jsonb; q jsonb; o jsonb;
  v_colegio uuid; v_autor uuid; v_materia uuid; v_leccion uuid; v_pregunta uuid;
  i int; j int;
begin
  select id into v_colegio from schools where name ilike '%Gran Manantial%' limit 1;
  if v_colegio is null then raise exception 'no se encontró el colegio'; end if;
  select id into v_autor from users_profiles
   where school_id = v_colegio and role in ('director','school_admin','super_admin') limit 1;

  for l in select * from jsonb_array_elements(d) loop
    select id into v_materia from subjects
     where school_id = v_colegio and name = l->>'materia' limit 1;
    if v_materia is null then
      insert into subjects (school_id, name) values (v_colegio, l->>'materia') returning id into v_materia;
    end if;

    select id into v_leccion from lessons
     where school_id = v_colegio and title = l->>'titulo' and grade_level = l->>'curso' limit 1;

    if v_leccion is null then
      insert into lessons (school_id, subject_id, grade_level, title, description,
                           video_url, video_provider, sort_order, is_published, created_by)
      values (v_colegio, v_materia, l->>'curso', l->>'titulo', l->>'descripcion',
              l->>'video', 'youtube', (l->>'orden')::int, true, v_autor)
      returning id into v_leccion;
    else
      update lessons set video_url = l->>'video', description = l->>'descripcion',
                         subject_id = v_materia, sort_order = (l->>'orden')::int,
                         is_published = true, updated_at = now()
       where id = v_leccion;
      delete from quiz_questions where lesson_id = v_leccion;
    end if;

    i := 0;
    for q in select * from jsonb_array_elements(l->'preguntas') loop
      insert into quiz_questions (lesson_id, prompt, sort_order, points)
      values (v_leccion, q->>'p', i, 10) returning id into v_pregunta;
      j := 0;
      for o in select * from jsonb_array_elements(q->'o') loop
        insert into quiz_options (question_id, label, is_correct, sort_order)
        values (v_pregunta, o #>> '{}', j = (q->>'c')::int, j);
        j := j + 1;
      end loop;
      i := i + 1;
    end loop;
  end loop;

  raise notice 'Listas % lecciones', jsonb_array_length(d);
end $$;

-- Comprobación
select l.title, s.name as materia, l.grade_level, l.is_published,
       (select count(*) from quiz_questions q where q.lesson_id = l.id) as preguntas,
       (select count(*) from quiz_options o
          join quiz_questions q on q.id = o.question_id
         where q.lesson_id = l.id and o.is_correct) as correctas
from lessons l join subjects s on s.id = l.subject_id
order by l.sort_order;`)
