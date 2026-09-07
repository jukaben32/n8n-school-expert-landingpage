-- Carga de video-lecciones en Academia (9 lecciones)
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
  d jsonb := $json$[{"materia":"Ciencias Naturales","curso":"6to. Primaria","titulo":"El ciclo del agua","descripcion":"El agua que bebes hoy ya estuvo aquí antes. Muchas veces.","video":"https://youtu.be/z9F-wATMSV8","orden":10,"preguntas":[{"p":"¿Qué hace que el agua del mar se evapore?","o":["El calor del sol","El viento frío","La lluvia","Los peces"],"c":0},{"p":"¿Cómo se llama la etapa en que el vapor se enfría y forma nubes?","o":["Condensación","Evaporación","Precipitación","Infiltración"],"c":0},{"p":"¿Por qué llueve?","o":["Las gotitas de la nube se juntan y pesan demasiado","El sol empuja las nubes","El mar sube al cielo de golpe","Las nubes se rompen con el viento"],"c":0},{"p":"¿Por qué decimos que es un CICLO?","o":["Porque se repite sin principio ni final","Porque dura un año exacto","Porque solo ocurre en invierno","Porque solo pasa en el mar"],"c":0}]},{"materia":"Ciencias Naturales","curso":"6to. Primaria","titulo":"El sistema digestivo","descripcion":"El viaje que hace la comida desde que la muerdes.","video":"https://youtu.be/8wHZNOpqJ6w","orden":20,"preguntas":[{"p":"¿Dónde empieza la digestión?","o":["En la boca","En el estómago","En el intestino delgado","En el esófago"],"c":0},{"p":"¿En qué órgano pasan los nutrientes a la sangre?","o":["En el intestino delgado","En el estómago","En la boca","En el intestino grueso"],"c":0},{"p":"¿Cómo baja la comida por el esófago?","o":["El esófago la empuja con ondas de músculo","Cae por su propio peso","La empuja el aire que respiramos","La arrastra la saliva"],"c":0},{"p":"¿Qué hace principalmente el intestino grueso?","o":["Recupera el agua y expulsa lo que no sirve","Muele la comida","Produce saliva","Pasa los nutrientes a la sangre"],"c":0}]},{"materia":"Ciencias Naturales","curso":"6to. Primaria","titulo":"Cadenas alimenticias","descripcion":"Quién se come a quién, y por qué el sol está en el principio de todo.","video":"https://youtu.be/TsHCWLPWpqs","orden":30,"preguntas":[{"p":"¿Por qué las plantas son las productoras?","o":["Porque fabrican su propio alimento con la luz del sol","Porque son las más grandes","Porque se comen a los insectos","Porque viven más años"],"c":0},{"p":"Un conejo que come hierba es un...","o":["Consumidor primario (herbívoro)","Productor","Descomponedor","Consumidor secundario"],"c":0},{"p":"¿Qué hacen los descomponedores?","o":["Deshacen lo que muere y devuelven nutrientes a la tierra","Cazan a los herbívoros","Fabrican alimento con el sol","Se comen a los carnívoros"],"c":0},{"p":"Si desaparecen las plantas de un ecosistema, ¿qué pasa?","o":["Se afecta toda la cadena, empezando por los herbívoros","Solo se afectan las plantas","Los carnívoros no se enteran","Aumentan los herbívoros"],"c":0}]},{"materia":"Lengua Española","curso":"6to. Primaria","titulo":"Sujeto y predicado","descripcion":"De quién habla la oración, y qué dice de él.","video":"https://youtu.be/lNLdx5eNl3E","orden":40,"preguntas":[{"p":"En \"María estudia todas las tardes\", ¿cuál es el sujeto?","o":["María","estudia","todas las tardes","estudia todas las tardes"],"c":0},{"p":"¿Qué pregunta ayuda a encontrar el sujeto?","o":["¿Quién? al verbo","¿Cuándo? al verbo","¿Dónde? al verbo","¿Cuánto? al verbo"],"c":0},{"p":"En \"Por la mañana cantaban los pájaros\", ¿cuál es el sujeto?","o":["los pájaros","Por la mañana","cantaban","la mañana"],"c":0},{"p":"En \"Salimos corriendo del aula\", el sujeto es...","o":["Tácito: nosotros","corriendo","del aula","No tiene sujeto"],"c":0}]},{"materia":"Lengua Española","curso":"6to. Primaria","titulo":"Agudas, llanas y esdrújulas","descripcion":"Dónde va la fuerza de la voz y cuándo se pone tilde.","video":"https://youtu.be/hyoEVhEZHHc","orden":50,"preguntas":[{"p":"La palabra \"pájaro\" es...","o":["Esdrújula","Llana","Aguda","Ninguna de las anteriores"],"c":0},{"p":"¿Cuándo lleva tilde una palabra aguda?","o":["Cuando termina en n, s o vocal","Cuando NO termina en n, s o vocal","Siempre","Nunca"],"c":0},{"p":"Las palabras esdrújulas llevan tilde...","o":["Siempre","Solo si terminan en vocal","Solo si terminan en consonante","Casi nunca"],"c":0},{"p":"En \"ventana\", ¿dónde cae la fuerza de la voz?","o":["En TA (penúltima): es llana","En VEN: es aguda","En NA: es aguda","En VEN: es esdrújula"],"c":0}]},{"materia":"Lengua Española","curso":"6to. Primaria","titulo":"La idea principal de un párrafo","descripcion":"Cómo encontrar de qué trata de verdad lo que estás leyendo.","video":"https://youtu.be/MvtOIdwaWQg","orden":60,"preguntas":[{"p":"¿Cuántas ideas principales tiene un párrafo bien escrito?","o":["Una sola","Dos o tres","Una por cada oración","Ninguna"],"c":0},{"p":"¿Dónde puede estar la idea principal?","o":["Al principio, en el medio o al final","Solo al principio","Solo al final","Solo en la segunda oración"],"c":0},{"p":"¿Para qué sirven las oraciones de detalle?","o":["Para explicar, ejemplificar o probar la idea principal","Para rellenar el párrafo","Para cambiar el tema","Para repetir la idea principal"],"c":0},{"p":"¿Cuál es una buena prueba para saber si hallaste la idea principal?","o":["Si la quitas, el párrafo pierde el sentido","Es la oración más larga","Es la oración más corta","Siempre es la primera"],"c":0}]},{"materia":"Matemática","curso":"6to. Primaria","titulo":"Fracciones equivalentes","descripcion":"Dos fracciones que se ven distintas y valen lo mismo. Con panes, mangos y pesos.","video":"https://youtu.be/j5zENAV1bL4","orden":70,"preguntas":[{"p":"¿Cuál de estas fracciones es equivalente a 1/2?","o":["3/6","1/3","2/5","3/4"],"c":0},{"p":"Partimos un pan en 8 pedazos iguales y nos comimos 4. ¿Qué fracción del pan nos comimos?","o":["La mitad","Una cuarta parte","Tres cuartos","Una octava parte"],"c":0},{"p":"Para crear una fracción equivalente, ¿qué hay que hacer?","o":["Multiplicar arriba y abajo por el mismo número","Multiplicar solo el número de arriba","Sumar 1 arriba y 1 abajo","Multiplicar solo el número de abajo"],"c":0},{"p":"Si simplificamos 6/12 hasta la fracción más sencilla, ¿qué obtenemos?","o":["1/2","2/4","3/6","6/12"],"c":0}]},{"materia":"Matemática","curso":"6to. Primaria","titulo":"Comparar fracciones","descripcion":"Cómo saber cuál fracción es mayor, sin adivinar.","video":"https://youtu.be/4Ewus7zKWIk","orden":80,"preguntas":[{"p":"¿Cuál es mayor: 5/8 o 3/8?","o":["5/8","3/8","Son iguales","No se puede saber"],"c":0},{"p":"¿Cuál es mayor: 1/4 o 1/9?","o":["1/4","1/9","Son iguales","Depende del pan"],"c":0},{"p":"Para comparar 2/5 con 1/2, ¿qué conviene hacer primero?","o":["Llevarlas al mismo denominador","Sumar los cuatro números","Comparar solo los de arriba","Comparar solo los de abajo"],"c":0},{"p":"Si dos fracciones tienen el mismo numerador, ¿cuál es mayor?","o":["La que tiene el denominador más pequeño","La que tiene el denominador más grande","Siempre la primera","Siempre son iguales"],"c":0}]},{"materia":"Matemática","curso":"6to. Primaria","titulo":"Qué es un porcentaje","descripcion":"Por ciento significa de cada cien. Con descuentos del colmado.","video":"https://youtu.be/k6otluPCk2M","orden":90,"preguntas":[{"p":"¿Qué significa 30%?","o":["30 de cada 100","30 de cada 10","300 de cada 100","3 de cada 100"],"c":0},{"p":"¿Cuánto es el 10% de RD$800?","o":["RD$80","RD$8","RD$800","RD$180"],"c":0},{"p":"El 50% de una cantidad es lo mismo que...","o":["La mitad","La cuarta parte","El doble","La quinta parte"],"c":0},{"p":"Un pantalón cuesta RD$1,000 y tiene 20% de descuento. ¿Cuánto pagas?","o":["RD$800","RD$200","RD$980","RD$1,200"],"c":0}]}]$json$;
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
order by l.sort_order;
