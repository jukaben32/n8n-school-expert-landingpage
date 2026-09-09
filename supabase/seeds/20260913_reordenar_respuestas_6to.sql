-- =========================================================================
-- 6to. Primaria: repartir la respuesta correcta entre las 4 posiciones
-- =========================================================================
-- EL PROBLEMA (real, no teorico): las 36 preguntas de las 9 lecciones tenian
-- la respuesta correcta SIEMPRE en la primera posicion. Un estudiante sacaba
-- 100% tocando el primer boton cuatro veces, sin ver el video. El reproductor
-- no baraja las opciones: las pinta en el orden de `sort_order`.
--
-- POR QUE SE PUEDE REORDENAR SIN TOCAR LOS VIDEOS: se reviso guion por guion
-- que ningun MP4 de 6to lee ni muestra las opciones del cuestionario -- los
-- videos terminan diciendo "ahora contesta el cuestionario" y nada mas. (Las
-- lecciones de 1ro SI las leen en voz alta, por eso alli el orden del video y
-- el de la app tienen que coincidir y se editan juntos.)
--
-- QUE HACE Y QUE NO:
--   * Solo mueve `sort_order`. NO borra ni recrea preguntas, NO toca
--     `is_correct`, NO toca `lessons`.
--   * Comprobado antes de aplicar: 0 `quiz_attempts` y 0 `quiz_answers`, asi
--     que no habia ni una respuesta de estudiante que pudiera descolocarse.
--   * El orden es el MISMO que quedo en `produccion/lecciones/6to-*.json`,
--     comparado opcion por opcion despues de aplicar (36/36, 0 diferencias),
--     para que volver a correr `lib/cargar-sql.mjs` no lo deshaga.
--
-- EL REPARTO es un cuadrado latino: 9 preguntas en cada una de las 4
-- posiciones, y dentro de CADA leccion las 4 preguntas caen en posiciones
-- distintas -- asi no es adivinable ni el conjunto ni una leccion suelta.
--
-- Aplicado a produccion el 2026-09-13 y verificado: 9/9/9/9, y ninguna
-- pregunta quedo con opciones repetidas, perdidas o sin correcta.
--
-- PARA REVERTIR (deja todas las correctas otra vez en la 1a posicion, que era
-- el estado defectuoso -- solo tendria sentido si algo saliera muy mal):
--   update quiz_options o set sort_order = case when o.is_correct then 0
--     else o.sort_order + 1 end ... -- mejor: volver a correr el SQL que
--   genera `produccion/lib/cargar-sql.mjs` desde una version anterior de los
--   guiones (git), que rehace el cuestionario entero.
-- =========================================================================

do $$
declare
  d jsonb := $json$[{"titulo": "El ciclo del agua", "pregunta": "¿Qué hace que el agua del mar se evapore?", "opciones": ["El calor del sol", "El viento frío", "La lluvia", "Los peces"], "correcta": 0}, {"titulo": "El ciclo del agua", "pregunta": "¿Cómo se llama la etapa en que el vapor se enfría y forma nubes?", "opciones": ["Evaporación", "Condensación", "Precipitación", "Infiltración"], "correcta": 1}, {"titulo": "El ciclo del agua", "pregunta": "¿Por qué llueve?", "opciones": ["El sol empuja las nubes", "El mar sube al cielo de golpe", "Las gotitas de la nube se juntan y pesan demasiado", "Las nubes se rompen con el viento"], "correcta": 2}, {"titulo": "El ciclo del agua", "pregunta": "¿Por qué decimos que es un CICLO?", "opciones": ["Porque dura un año exacto", "Porque solo ocurre en invierno", "Porque solo pasa en el mar", "Porque se repite sin principio ni final"], "correcta": 3}, {"titulo": "El sistema digestivo", "pregunta": "¿Dónde empieza la digestión?", "opciones": ["En el estómago", "En la boca", "En el intestino delgado", "En el esófago"], "correcta": 1}, {"titulo": "El sistema digestivo", "pregunta": "¿En qué órgano pasan los nutrientes a la sangre?", "opciones": ["En el estómago", "En la boca", "En el intestino delgado", "En el intestino grueso"], "correcta": 2}, {"titulo": "El sistema digestivo", "pregunta": "¿Cómo baja la comida por el esófago?", "opciones": ["Cae por su propio peso", "La empuja el aire que respiramos", "La arrastra la saliva", "El esófago la empuja con ondas de músculo"], "correcta": 3}, {"titulo": "El sistema digestivo", "pregunta": "¿Qué hace principalmente el intestino grueso?", "opciones": ["Recupera el agua y expulsa lo que no sirve", "Muele la comida", "Produce saliva", "Pasa los nutrientes a la sangre"], "correcta": 0}, {"titulo": "Cadenas alimenticias", "pregunta": "¿Por qué las plantas son las productoras?", "opciones": ["Porque son las más grandes", "Porque se comen a los insectos", "Porque fabrican su propio alimento con la luz del sol", "Porque viven más años"], "correcta": 2}, {"titulo": "Cadenas alimenticias", "pregunta": "Un conejo que come hierba es un...", "opciones": ["Productor", "Descomponedor", "Consumidor secundario", "Consumidor primario (herbívoro)"], "correcta": 3}, {"titulo": "Cadenas alimenticias", "pregunta": "¿Qué hacen los descomponedores?", "opciones": ["Deshacen lo que muere y devuelven nutrientes a la tierra", "Cazan a los herbívoros", "Fabrican alimento con el sol", "Se comen a los carnívoros"], "correcta": 0}, {"titulo": "Cadenas alimenticias", "pregunta": "Si desaparecen las plantas de un ecosistema, ¿qué pasa?", "opciones": ["Solo se afectan las plantas", "Se afecta toda la cadena, empezando por los herbívoros", "Los carnívoros no se enteran", "Aumentan los herbívoros"], "correcta": 1}, {"titulo": "Sujeto y predicado", "pregunta": "En \"María estudia todas las tardes\", ¿cuál es el sujeto?", "opciones": ["estudia", "todas las tardes", "estudia todas las tardes", "María"], "correcta": 3}, {"titulo": "Sujeto y predicado", "pregunta": "¿Qué pregunta ayuda a encontrar el sujeto?", "opciones": ["¿Quién? al verbo", "¿Cuándo? al verbo", "¿Dónde? al verbo", "¿Cuánto? al verbo"], "correcta": 0}, {"titulo": "Sujeto y predicado", "pregunta": "En \"Por la mañana cantaban los pájaros\", ¿cuál es el sujeto?", "opciones": ["Por la mañana", "los pájaros", "cantaban", "la mañana"], "correcta": 1}, {"titulo": "Sujeto y predicado", "pregunta": "En \"Salimos corriendo del aula\", el sujeto es...", "opciones": ["corriendo", "del aula", "Tácito: nosotros", "No tiene sujeto"], "correcta": 2}, {"titulo": "Agudas, llanas y esdrújulas", "pregunta": "La palabra \"pájaro\" es...", "opciones": ["Esdrújula", "Llana", "Aguda", "Ninguna de las anteriores"], "correcta": 0}, {"titulo": "Agudas, llanas y esdrújulas", "pregunta": "¿Cuándo lleva tilde una palabra aguda?", "opciones": ["Cuando NO termina en n, s o vocal", "Cuando termina en n, s o vocal", "Siempre", "Nunca"], "correcta": 1}, {"titulo": "Agudas, llanas y esdrújulas", "pregunta": "Las palabras esdrújulas llevan tilde...", "opciones": ["Solo si terminan en vocal", "Solo si terminan en consonante", "Siempre", "Casi nunca"], "correcta": 2}, {"titulo": "Agudas, llanas y esdrújulas", "pregunta": "En \"ventana\", ¿dónde cae la fuerza de la voz?", "opciones": ["En VEN: es aguda", "En NA: es aguda", "En VEN: es esdrújula", "En TA (penúltima): es llana"], "correcta": 3}, {"titulo": "La idea principal de un párrafo", "pregunta": "¿Cuántas ideas principales tiene un párrafo bien escrito?", "opciones": ["Dos o tres", "Una sola", "Una por cada oración", "Ninguna"], "correcta": 1}, {"titulo": "La idea principal de un párrafo", "pregunta": "¿Dónde puede estar la idea principal?", "opciones": ["Solo al principio", "Solo al final", "Al principio, en el medio o al final", "Solo en la segunda oración"], "correcta": 2}, {"titulo": "La idea principal de un párrafo", "pregunta": "¿Para qué sirven las oraciones de detalle?", "opciones": ["Para rellenar el párrafo", "Para cambiar el tema", "Para repetir la idea principal", "Para explicar, ejemplificar o probar la idea principal"], "correcta": 3}, {"titulo": "La idea principal de un párrafo", "pregunta": "¿Cuál es una buena prueba para saber si hallaste la idea principal?", "opciones": ["Si la quitas, el párrafo pierde el sentido", "Es la oración más larga", "Es la oración más corta", "Siempre es la primera"], "correcta": 0}, {"titulo": "Fracciones equivalentes", "pregunta": "¿Cuál de estas fracciones es equivalente a 1/2?", "opciones": ["1/3", "2/5", "3/6", "3/4"], "correcta": 2}, {"titulo": "Fracciones equivalentes", "pregunta": "Partimos un pan en 8 pedazos iguales y nos comimos 4. ¿Qué fracción del pan nos comimos?", "opciones": ["Una cuarta parte", "Tres cuartos", "Una octava parte", "La mitad"], "correcta": 3}, {"titulo": "Fracciones equivalentes", "pregunta": "Para crear una fracción equivalente, ¿qué hay que hacer?", "opciones": ["Multiplicar arriba y abajo por el mismo número", "Multiplicar solo el número de arriba", "Sumar 1 arriba y 1 abajo", "Multiplicar solo el número de abajo"], "correcta": 0}, {"titulo": "Fracciones equivalentes", "pregunta": "Si simplificamos 6/12 hasta la fracción más sencilla, ¿qué obtenemos?", "opciones": ["2/4", "1/2", "3/6", "6/12"], "correcta": 1}, {"titulo": "Comparar fracciones", "pregunta": "¿Cuál es mayor: 5/8 o 3/8?", "opciones": ["3/8", "Son iguales", "No se puede saber", "5/8"], "correcta": 3}, {"titulo": "Comparar fracciones", "pregunta": "¿Cuál es mayor: 1/4 o 1/9?", "opciones": ["1/4", "1/9", "Son iguales", "Depende del pan"], "correcta": 0}, {"titulo": "Comparar fracciones", "pregunta": "Para comparar 2/5 con 1/2, ¿qué conviene hacer primero?", "opciones": ["Sumar los cuatro números", "Llevarlas al mismo denominador", "Comparar solo los de arriba", "Comparar solo los de abajo"], "correcta": 1}, {"titulo": "Comparar fracciones", "pregunta": "Si dos fracciones tienen el mismo numerador, ¿cuál es mayor?", "opciones": ["La que tiene el denominador más grande", "Siempre la primera", "La que tiene el denominador más pequeño", "Siempre son iguales"], "correcta": 2}, {"titulo": "Qué es un porcentaje", "pregunta": "¿Qué significa 30%?", "opciones": ["30 de cada 100", "30 de cada 10", "300 de cada 100", "3 de cada 100"], "correcta": 0}, {"titulo": "Qué es un porcentaje", "pregunta": "¿Cuánto es el 10% de RD$800?", "opciones": ["RD$8", "RD$80", "RD$800", "RD$180"], "correcta": 1}, {"titulo": "Qué es un porcentaje", "pregunta": "El 50% de una cantidad es lo mismo que...", "opciones": ["La cuarta parte", "El doble", "La mitad", "La quinta parte"], "correcta": 2}, {"titulo": "Qué es un porcentaje", "pregunta": "Un pantalón cuesta RD$1,000 y tiene 20% de descuento. ¿Cuánto pagas?", "opciones": ["RD$200", "RD$980", "RD$1,200", "RD$800"], "correcta": 3}]$json$;
  p jsonb; o jsonb; v_pregunta uuid; j int; n int := 0;
begin
  for p in select * from jsonb_array_elements(d) loop
    select q.id into v_pregunta
      from quiz_questions q join lessons l on l.id = q.lesson_id
     where l.title = p->>'titulo' and q.prompt = p->>'pregunta'
       and l.grade_level = '6to. Primaria'
     limit 1;
    if v_pregunta is null then
      raise exception 'no se encontro la pregunta: % / %', p->>'titulo', p->>'pregunta';
    end if;
    j := 0;
    for o in select * from jsonb_array_elements(p->'opciones') loop
      update quiz_options set sort_order = j
       where question_id = v_pregunta and label = o #>> '{}';
      if not found then
        raise exception 'no se encontro la opcion: %', o #>> '{}';
      end if;
      j := j + 1; n := n + 1;
    end loop;
  end loop;
  raise notice 'reordenadas % opciones', n;
end $$;

select o.sort_order as posicion, count(*) as respuestas_correctas
  from quiz_options o
  join quiz_questions q on q.id = o.question_id
  join lessons l on l.id = q.lesson_id
 where o.is_correct and l.grade_level = '6to. Primaria'
 group by 1 order by 1;
