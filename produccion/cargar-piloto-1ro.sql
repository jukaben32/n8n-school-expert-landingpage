-- ⚠ sin enlace: 1ro-primaria-lengua-u00-01
-- ⚠ sin enlace: 1ro-primaria-lengua-u00-02
-- ⚠ sin enlace: 1ro-primaria-matematica-u00-01
-- ⚠ sin enlace: 1ro-primaria-naturales-u01-01
-- ⚠ sin enlace: 1ro-primaria-naturales-u02-01
-- ⚠ sin enlace: 1ro-primaria-sociales-u02-01
-- ⚠ sin enlace: 1ro-primaria-sociales-u03-01
-- ⚠ sin enlace: 6to-primaria-ciencias-01
-- ⚠ sin enlace: 6to-primaria-ciencias-02
-- ⚠ sin enlace: 6to-primaria-ciencias-03
-- ⚠ sin enlace: 6to-primaria-lengua-01
-- ⚠ sin enlace: 6to-primaria-lengua-02
-- ⚠ sin enlace: 6to-primaria-lengua-03
-- ⚠ sin enlace: 6to-primaria-matematica-01
-- ⚠ sin enlace: 6to-primaria-matematica-02
-- ⚠ sin enlace: 6to-primaria-matematica-03
-- Carga de video-lecciones en Academia (5 lecciones)
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
  d jsonb := $json$[{"materia":"Lengua Española","curso":"1ro. Primaria","titulo":"Mi tarjeta con mi nombre","descripcion":"Para qué sirve una tarjeta de identidad y por qué el nombre lleva mayúscula.","video":"https://youtu.be/XPgPWA2dM7c","orden":20,"preguntas":[{"p":"¿Cuál de estos dos nombres está bien escrito?","o":[{"t":"luis","img":"1ro-primaria-lengua-u01-01/opcion-1-1.png"},{"t":"Luis","img":"1ro-primaria-lengua-u01-01/opcion-1-2.png"}],"c":1},{"p":"¿Para qué sirve una tarjeta de identidad?","o":[{"t":"Para decir quién soy","img":"1ro-primaria-lengua-u01-01/opcion-2-1.png"},{"t":"Para jugar","img":"1ro-primaria-lengua-u01-01/opcion-2-2.png"}],"c":0},{"p":"Hay dos niñas que se llaman Ana. ¿Qué nos dice cuál es cuál?","o":[{"t":"Su apellido","img":"1ro-primaria-lengua-u01-01/opcion-3-1.png"},{"t":"Su ropa","img":"1ro-primaria-lengua-u01-01/opcion-3-2.png"}],"c":0}]},{"materia":"Matemática","curso":"1ro. Primaria","titulo":"Los números del 0 al 9","descripcion":"Cada número tiene su nombre, su símbolo y su cantidad. Y el cero también cuenta.","video":"https://youtu.be/gakgK0dbogk","orden":30,"preguntas":[{"p":"¿Qué número va después del 8?","o":[{"t":"6","img":"1ro-primaria-matematica-u01-01/opcion-1-1.png"},{"t":"9","img":"1ro-primaria-matematica-u01-01/opcion-1-2.png"}],"c":1},{"p":"Te comiste todos los mangos. ¿Cuántos quedan?","o":[{"t":"0","img":"1ro-primaria-matematica-u01-01/opcion-2-1.png"},{"t":"1","img":"1ro-primaria-matematica-u01-01/opcion-2-2.png"}],"c":0},{"p":"¿Cuál grupo tiene MÁS pelotas?","o":[{"t":"El de 5","img":"1ro-primaria-matematica-u01-01/opcion-3-1.png"},{"t":"El de 2","img":"1ro-primaria-matematica-u01-01/opcion-3-2.png"}],"c":0}]},{"materia":"Matemática","curso":"1ro. Primaria","titulo":"Primero, segundo, tercero","descripcion":"Los números ordinales: el lugar que ocupa cada uno en una fila.","video":"https://youtu.be/mWjGw3gdNWo","orden":40,"preguntas":[{"p":"Contando desde la izquierda 🍎🥭🍌, ¿cuál fruta va de segunda?","o":[{"t":"La manzana","img":"1ro-primaria-matematica-u01-02/opcion-1-1.png"},{"t":"El mango","img":"1ro-primaria-matematica-u01-02/opcion-1-2.png"},{"t":"El guineo","img":"1ro-primaria-matematica-u01-02/opcion-1-3.png"}],"c":1},{"p":"En una carrera, ¿quién gana?","o":[{"t":"El primero","img":"1ro-primaria-matematica-u01-02/opcion-2-1.png"},{"t":"El último","img":"1ro-primaria-matematica-u01-02/opcion-2-2.png"}],"c":0},{"p":"El que hace 10 en la fila se llama...","o":[{"t":"Segundo","img":"1ro-primaria-matematica-u01-02/opcion-3-1.png"},{"t":"Décimo","img":"1ro-primaria-matematica-u01-02/opcion-3-2.png"}],"c":1}]},{"materia":"Ciencias Naturales","curso":"1ro. Primaria","titulo":"Las plantas también están vivas","descripcion":"Las partes de una mata y lo que necesita para vivir: agua, sol y aire.","video":"https://youtu.be/jxBshTN0WvU","orden":50,"preguntas":[{"p":"¿Qué parte de la mata chupa el agua de la tierra?","o":[{"t":"La flor","img":"1ro-primaria-naturales-u01-02/opcion-1-1.png"},{"t":"La raíz","img":"1ro-primaria-naturales-u01-02/opcion-1-2.png"},{"t":"Las hojas","img":"1ro-primaria-naturales-u01-02/opcion-1-3.png"}],"c":1},{"p":"¿Qué necesita una mata para vivir?","o":[{"t":"Agua y sol","img":"1ro-primaria-naturales-u01-02/opcion-2-1.png"},{"t":"Juguetes","img":"1ro-primaria-naturales-u01-02/opcion-2-2.png"}],"c":0},{"p":"¿De dónde nace una mata nueva?","o":[{"t":"Una piedra","img":"1ro-primaria-naturales-u01-02/opcion-3-1.png"},{"t":"Un clavo","img":"1ro-primaria-naturales-u01-02/opcion-3-2.png"},{"t":"Una semilla","img":"1ro-primaria-naturales-u01-02/opcion-3-3.png"}],"c":2}]},{"materia":"Ciencias Sociales","curso":"1ro. Primaria","titulo":"Yo soy único","descripcion":"Mi nombre completo, cómo soy y lo que me gusta: eso me hace único.","video":"https://youtu.be/ejm1xAgz5o8","orden":60,"preguntas":[{"p":"Los apellidos, ¿de dónde vienen?","o":[{"t":"De mi familia","img":"1ro-primaria-sociales-u01-01/opcion-1-1.png"},{"t":"De mi escuela","img":"1ro-primaria-sociales-u01-01/opcion-1-2.png"}],"c":0},{"p":"Dos hermanos gemelos, ¿son iguales en todo?","o":[{"t":"Sí, en todo","img":"1ro-primaria-sociales-u01-01/opcion-2-1.png"},{"t":"No, cada uno es único","img":"1ro-primaria-sociales-u01-01/opcion-2-2.png"}],"c":1},{"p":"¿Quién es más importante?","o":[{"t":"El niño alto","img":"1ro-primaria-sociales-u01-01/opcion-3-1.png"},{"t":"La niña bajita","img":"1ro-primaria-sociales-u01-01/opcion-3-2.png"},{"t":"Los dos por igual","img":"1ro-primaria-sociales-u01-01/opcion-3-3.png"}],"c":2}]}]$json$;
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
        insert into quiz_options (question_id, label, is_correct, sort_order, image_path)
        values (v_pregunta, o->>'t', j = (q->>'c')::int, j, o->>'img');
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
         where q.lesson_id = l.id and o.is_correct) as correctas,
       (select count(o.image_path) from quiz_options o
          join quiz_questions q on q.id = o.question_id
         where q.lesson_id = l.id) as opciones_con_dibujo
from lessons l join subjects s on s.id = l.subject_id
order by l.sort_order;
