-- Carga de video-lecciones en Academia
-- Generado por produccion/lib/cargar-sql.mjs
--
-- Idempotente: si la lección ya existe (mismo título y curso) se actualiza
-- el video en vez de duplicarla, y su cuestionario se rehace desde cero.
-- Las preguntas se borran en cascada (quiz_questions -> quiz_options).
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


  -- Ciencias Naturales · El ciclo del agua
  select id into v_materia from subjects where school_id = v_colegio and name = 'Ciencias Naturales' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Ciencias Naturales') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'El ciclo del agua' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'El ciclo del agua', 'El agua que bebes hoy ya estuvo aquí antes. Muchas veces.',
            'https://youtu.be/z9F-wATMSV8', 'youtube', 10, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/z9F-wATMSV8', description = 'El agua que bebes hoy ya estuvo aquí antes. Muchas veces.',
                       subject_id = v_materia, sort_order = 10, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Qué hace que el agua del mar se evapore?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'El calor del sol', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'El viento frío', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La lluvia', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Los peces', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cómo se llama la etapa en que el vapor se enfría y forma nubes?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Condensación', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Evaporación', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Precipitación', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Infiltración', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Por qué llueve?', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Las gotitas de la nube se juntan y pesan demasiado', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'El sol empuja las nubes', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'El mar sube al cielo de golpe', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Las nubes se rompen con el viento', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Por qué decimos que es un CICLO?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque se repite sin principio ni final', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque dura un año exacto', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque solo ocurre en invierno', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque solo pasa en el mar', false, 3);

  -- Ciencias Naturales · El sistema digestivo
  select id into v_materia from subjects where school_id = v_colegio and name = 'Ciencias Naturales' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Ciencias Naturales') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'El sistema digestivo' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'El sistema digestivo', 'El viaje que hace la comida desde que la muerdes.',
            'https://youtu.be/8wHZNOpqJ6w', 'youtube', 20, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/8wHZNOpqJ6w', description = 'El viaje que hace la comida desde que la muerdes.',
                       subject_id = v_materia, sort_order = 20, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Dónde empieza la digestión?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En la boca', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En el estómago', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En el intestino delgado', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En el esófago', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿En qué órgano pasan los nutrientes a la sangre?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En el intestino delgado', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En el estómago', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En la boca', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En el intestino grueso', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cómo baja la comida por el esófago?', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'El esófago la empuja con ondas de músculo', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Cae por su propio peso', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La empuja el aire que respiramos', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La arrastra la saliva', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Qué hace principalmente el intestino grueso?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Recupera el agua y expulsa lo que no sirve', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Muele la comida', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Produce saliva', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Pasa los nutrientes a la sangre', false, 3);

  -- Ciencias Naturales · Cadenas alimenticias
  select id into v_materia from subjects where school_id = v_colegio and name = 'Ciencias Naturales' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Ciencias Naturales') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'Cadenas alimenticias' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'Cadenas alimenticias', 'Quién se come a quién, y por qué el sol está en el principio de todo.',
            'https://youtu.be/TsHCWLPWpqs', 'youtube', 30, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/TsHCWLPWpqs', description = 'Quién se come a quién, y por qué el sol está en el principio de todo.',
                       subject_id = v_materia, sort_order = 30, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Por qué las plantas son las productoras?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque fabrican su propio alimento con la luz del sol', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque son las más grandes', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque se comen a los insectos', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Porque viven más años', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Un conejo que come hierba es un...', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Consumidor primario (herbívoro)', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Productor', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Descomponedor', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Consumidor secundario', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Qué hacen los descomponedores?', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Deshacen lo que muere y devuelven nutrientes a la tierra', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Cazan a los herbívoros', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Fabrican alimento con el sol', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Se comen a los carnívoros', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Si desaparecen las plantas de un ecosistema, ¿qué pasa?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Se afecta toda la cadena, empezando por los herbívoros', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Solo se afectan las plantas', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Los carnívoros no se enteran', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Aumentan los herbívoros', false, 3);

  -- Lengua Española · Sujeto y predicado
  select id into v_materia from subjects where school_id = v_colegio and name = 'Lengua Española' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Lengua Española') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'Sujeto y predicado' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'Sujeto y predicado', 'De quién habla la oración, y qué dice de él.',
            'https://youtu.be/lNLdx5eNl3E', 'youtube', 40, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/lNLdx5eNl3E', description = 'De quién habla la oración, y qué dice de él.',
                       subject_id = v_materia, sort_order = 40, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'En "María estudia todas las tardes", ¿cuál es el sujeto?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'María', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'estudia', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'todas las tardes', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'estudia todas las tardes', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Qué pregunta ayuda a encontrar el sujeto?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '¿Quién? al verbo', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '¿Cuándo? al verbo', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '¿Dónde? al verbo', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '¿Cuánto? al verbo', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'En "Por la mañana cantaban los pájaros", ¿cuál es el sujeto?', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'los pájaros', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Por la mañana', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'cantaban', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'la mañana', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'En "Salimos corriendo del aula", el sujeto es...', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Tácito: nosotros', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'corriendo', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'del aula', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'No tiene sujeto', false, 3);

  -- Lengua Española · Agudas, llanas y esdrújulas
  select id into v_materia from subjects where school_id = v_colegio and name = 'Lengua Española' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Lengua Española') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'Agudas, llanas y esdrújulas' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'Agudas, llanas y esdrújulas', 'Dónde va la fuerza de la voz y cuándo se pone tilde.',
            'https://youtu.be/hyoEVhEZHHc', 'youtube', 50, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/hyoEVhEZHHc', description = 'Dónde va la fuerza de la voz y cuándo se pone tilde.',
                       subject_id = v_materia, sort_order = 50, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'La palabra "pájaro" es...', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Esdrújula', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Llana', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Aguda', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Ninguna de las anteriores', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cuándo lleva tilde una palabra aguda?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Cuando termina en n, s o vocal', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Cuando NO termina en n, s o vocal', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Siempre', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Nunca', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Las palabras esdrújulas llevan tilde...', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Siempre', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Solo si terminan en vocal', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Solo si terminan en consonante', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Casi nunca', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'En "ventana", ¿dónde cae la fuerza de la voz?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En TA (penúltima): es llana', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En VEN: es aguda', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En NA: es aguda', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'En VEN: es esdrújula', false, 3);

  -- Lengua Española · La idea principal de un párrafo
  select id into v_materia from subjects where school_id = v_colegio and name = 'Lengua Española' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Lengua Española') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'La idea principal de un párrafo' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'La idea principal de un párrafo', 'Cómo encontrar de qué trata de verdad lo que estás leyendo.',
            'https://youtu.be/MvtOIdwaWQg', 'youtube', 60, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/MvtOIdwaWQg', description = 'Cómo encontrar de qué trata de verdad lo que estás leyendo.',
                       subject_id = v_materia, sort_order = 60, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cuántas ideas principales tiene un párrafo bien escrito?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Una sola', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Dos o tres', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Una por cada oración', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Ninguna', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Dónde puede estar la idea principal?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Al principio, en el medio o al final', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Solo al principio', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Solo al final', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Solo en la segunda oración', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Para qué sirven las oraciones de detalle?', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Para explicar, ejemplificar o probar la idea principal', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Para rellenar el párrafo', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Para cambiar el tema', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Para repetir la idea principal', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cuál es una buena prueba para saber si hallaste la idea principal?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Si la quitas, el párrafo pierde el sentido', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Es la oración más larga', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Es la oración más corta', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Siempre es la primera', false, 3);

  -- Matemática · Fracciones equivalentes
  select id into v_materia from subjects where school_id = v_colegio and name = 'Matemática' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Matemática') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'Fracciones equivalentes' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'Fracciones equivalentes', 'Dos fracciones que se ven distintas y valen lo mismo. Con panes, mangos y pesos.',
            'https://youtu.be/j5zENAV1bL4', 'youtube', 70, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/j5zENAV1bL4', description = 'Dos fracciones que se ven distintas y valen lo mismo. Con panes, mangos y pesos.',
                       subject_id = v_materia, sort_order = 70, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cuál de estas fracciones es equivalente a 1/2?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '3/6', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '1/3', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '2/5', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '3/4', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Partimos un pan en 8 pedazos iguales y nos comimos 4. ¿Qué fracción del pan nos comimos?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La mitad', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Una cuarta parte', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Tres cuartos', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Una octava parte', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Para crear una fracción equivalente, ¿qué hay que hacer?', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Multiplicar arriba y abajo por el mismo número', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Multiplicar solo el número de arriba', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Sumar 1 arriba y 1 abajo', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Multiplicar solo el número de abajo', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Si simplificamos 6/12 hasta la fracción más sencilla, ¿qué obtenemos?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '1/2', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '2/4', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '3/6', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '6/12', false, 3);

  -- Matemática · Comparar fracciones
  select id into v_materia from subjects where school_id = v_colegio and name = 'Matemática' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Matemática') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'Comparar fracciones' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'Comparar fracciones', 'Cómo saber cuál fracción es mayor, sin adivinar.',
            'https://youtu.be/4Ewus7zKWIk', 'youtube', 80, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/4Ewus7zKWIk', description = 'Cómo saber cuál fracción es mayor, sin adivinar.',
                       subject_id = v_materia, sort_order = 80, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cuál es mayor: 5/8 o 3/8?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '5/8', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '3/8', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Son iguales', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'No se puede saber', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cuál es mayor: 1/4 o 1/9?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '1/4', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '1/9', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Son iguales', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Depende del pan', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Para comparar 2/5 con 1/2, ¿qué conviene hacer primero?', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Llevarlas al mismo denominador', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Sumar los cuatro números', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Comparar solo los de arriba', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Comparar solo los de abajo', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Si dos fracciones tienen el mismo numerador, ¿cuál es mayor?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La que tiene el denominador más pequeño', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La que tiene el denominador más grande', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Siempre la primera', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'Siempre son iguales', false, 3);

  -- Matemática · Qué es un porcentaje
  select id into v_materia from subjects where school_id = v_colegio and name = 'Matemática' limit 1;
  if v_materia is null then
    insert into subjects (school_id, name) values (v_colegio, 'Matemática') returning id into v_materia;
  end if;

  select id into v_leccion from lessons
    where school_id = v_colegio and title = 'Qué es un porcentaje' and grade_level = '6to. Primaria' limit 1;

  if v_leccion is null then
    insert into lessons (school_id, subject_id, grade_level, title, description,
                         video_url, video_provider, sort_order, is_published, created_by)
    values (v_colegio, v_materia, '6to. Primaria', 'Qué es un porcentaje', 'Por ciento significa de cada cien. Con descuentos del colmado.',
            'https://youtu.be/k6otluPCk2M', 'youtube', 90, true, v_autor)
    returning id into v_leccion;
  else
    update lessons set video_url = 'https://youtu.be/k6otluPCk2M', description = 'Por ciento significa de cada cien. Con descuentos del colmado.',
                       subject_id = v_materia, sort_order = 90, is_published = true,
                       updated_at = now()
      where id = v_leccion;
    delete from quiz_questions where lesson_id = v_leccion;
  end if;

  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Qué significa 30%?', 0, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '30 de cada 100', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '30 de cada 10', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '300 de cada 100', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, '3 de cada 100', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, '¿Cuánto es el 10% de RD$800?', 1, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$80', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$8', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$800', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$180', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'El 50% de una cantidad es lo mismo que...', 2, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La mitad', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La cuarta parte', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'El doble', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'La quinta parte', false, 3);
  insert into quiz_questions (lesson_id, prompt, sort_order, points)
    values (v_leccion, 'Un pantalón cuesta RD$1,000 y tiene 20% de descuento. ¿Cuánto pagas?', 3, 10) returning id into v_pregunta;
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$800', true, 0);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$200', false, 1);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$980', false, 2);
  insert into quiz_options (question_id, label, is_correct, sort_order)
    values (v_pregunta, 'RD$1,200', false, 3);

end $$;

-- Comprobación
select l.title, s.name as materia, l.grade_level, l.is_published,
       (select count(*) from quiz_questions q where q.lesson_id = l.id) as preguntas
from lessons l join subjects s on s.id = l.subject_id
order by l.sort_order;
