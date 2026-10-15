-- Correos de Amco (usuario de Excellent) por estudiante, 2026-2027 -- LOTE 1:
-- 3ro de Primaria a 6to de Secundaria (175 correos, enviados por la
-- Coordinación del Área de Inglés el 14-oct-2026). Lo que falta (1ro-2do de
-- Primaria e Inicial) llega en un segundo envío: se carga igual con batch = 2.
--
-- Requiere la migración 20261015000000_amco_student_accounts.sql.
--
-- Cómo funciona (todo en una transacción, reejecutable sin duplicar):
--   * Empareja cada fila con un estudiante del MISMO curso por nombre, sin
--     importar el orden ni tildes ni "de/del/la". Dos niveles:
--       nombre_exacto    -> mismas palabras
--       nombre_contenido -> las palabras de uno están dentro del otro (mín. 3)
--     Si hay más de un candidato, NO adivina: la fila queda 'sin_emparejar'.
--   * Las filas sin emparejar NO reciben ningún correo. El reporte final las
--     lista con candidatos sugeridos para que Secretaría las resuelva con:
--       update amco_student_accounts
--         set student_id = '<id del estudiante>', match_method = 'manual'
--       where lower(email) = '<correo>' and source_grade = '<curso>';
--
-- Datos de la lista que se deben confirmar con la Coordinación de Inglés
-- (la supervisora los envió así; no se corrigieron):
--   * "Jair Esther Soriano Romero" (jairs2) aparece en 1ro y en 3ro de
--     Secundaria con el mismo correo: solo se empareja la fila del curso donde
--     de verdad está el estudiante.
--   * "Yanela Alejandra Herrera Solano" aparece en 3ro Sec. (yanelah2) y en
--     6to Sec. con otro correo (luisah13), que parece de otra persona
--     ("Luisa H."): confirmar de quién es.
--   * "Roosenvelt Xaviell Marte Jhonson" (6to Primaria) vino SIN correo, y no
--     se carga hasta que Amco lo envíe.
--   * Hay nombres con faltas ("Gonzles", "Reyes bary", "Darlin Feliz" por
--     Darlyn): suelen quedar 'sin_emparejar' y se resuelven a mano.

begin;

create or replace function pg_temp.nw(t text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(w order by w), '{}'::text[])
  from (
    select distinct w
    from unnest(string_to_array(
      regexp_replace(
        translate(lower(coalesce(t, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'),
        '[^a-z ]', ' ', 'g'),
      ' ')) as w
    where w <> '' and w not in ('de', 'del', 'la', 'las', 'los', 'y')
  ) x
$$;

create temp table _amco_src (grade text, full_name text, email text) on commit drop;
insert into _amco_src (grade, full_name, email) values
  ('1ro. Secundaria', 'Cielo Johandy De la Cruz Martinez', 'cielod4@do.amcoedu.org'),
  ('1ro. Secundaria', 'Crisleydi Coca Alcantara', 'crisleydic3@do.amcoedu.org'),
  ('1ro. Secundaria', 'Dayson Miguel Severino Rodriguez', 'daysons1@do.amcoedu.org'),
  ('1ro. Secundaria', 'Elianny Elizabeth Ramirez Peña', 'eliannyr3@do.amcoedu.org'),
  ('1ro. Secundaria', 'Irismeily Torres Almonte', 'irismeilyt5@do.amcoedu.org'),
  ('1ro. Secundaria', 'Jaysee Vasquez Alvares', 'jayseev3@do.amcoedu.org'),
  ('1ro. Secundaria', 'Jhostin Gomez Zapata', 'jhosting1@do.amcoedu.org'),
  ('1ro. Secundaria', 'Johanny Castro Polo', 'johannyc6@do.amcoedu.org'),
  ('1ro. Secundaria', 'Jorge Luis De Leon Fulgencio', 'jorged1@do.amcoedu.org'),
  ('1ro. Secundaria', 'Johandry Arroyo Gomez', 'joandrya5@do.amcoedu.org'),
  ('1ro. Secundaria', 'Keishelle Elizabeth Peguero Hernandez', 'keishellep4@do.amcoedu.org'),
  ('1ro. Secundaria', 'Marcos David Mendez Castillo', 'marcosm13@do.amcoedu.org'),
  ('1ro. Secundaria', 'Rachelly Angelita Belen Rodriguez', 'rachellyb4@do.amcoedu.org'),
  ('1ro. Secundaria', 'Sheili Nicol Polanco Javier', 'sheilip3@do.amcoedu.org'),
  ('1ro. Secundaria', 'Valerie Judith Ramos De los Santos', 'valerier3@do.amcoedu.org'),
  ('1ro. Secundaria', 'Yeiden Nuñez Crispin', 'yeidenn5@do.amcoedu.org'),
  ('1ro. Secundaria', 'Jair Esther Soriano Romero', 'jairs2@do.amcoedu.org'),
  ('1ro. Secundaria', 'Dariyeili Mercedes Montes Casey', 'darisyeilimm1@do.amcoedu.org'),
  ('1ro. Secundaria', 'Ashley Andreina Reyes Ramirez', 'ashleyar2@do.amcoedu.org'),
  ('1ro. Secundaria', 'Jayden Andres Martinez Ortiz', 'jaydenam1@do.amcoedu.org'),
  ('1ro. Secundaria', 'Reichell Rodriguez', 'reichellr2@do.amcoedu.org'),
  ('2do. Secundaria', 'Abigail Benua Franco', 'abigailb8@do.amcoedu.org'),
  ('2do. Secundaria', 'Annier Scarlet Medrano', 'annierm1@do.amcoedu.org'),
  ('2do. Secundaria', 'Benjamin Leonardo Otaño Rodriguez', 'benjamino3@do.amcoedu.org'),
  ('2do. Secundaria', 'Chaimel Lisseth Arroyo Gomez', 'chaimela4@do.amcoedu.org'),
  ('2do. Secundaria', 'Diana Beltran Gonzles', 'dianab4@do.amcoedu.org'),
  ('2do. Secundaria', 'Elian Manuel Sanchez mateo', 'elians9@do.amcoedu.org'),
  ('2do. Secundaria', 'Esther Beatriz Cepeda Vargas', 'estherb2@do.amcoedu.org'),
  ('2do. Secundaria', 'Isaac David Lopez Zamora', 'isaacl8@do.amcoedu.org'),
  ('2do. Secundaria', 'Jadelin Isabel Carreño Diaz', 'jadelinc1@do.amcoedu.org'),
  ('2do. Secundaria', 'Jose Leyba Geraldo', 'josel7@do.amcoedu.org'),
  ('2do. Secundaria', 'Karolyn Matos Montero', 'karolynm5@do.amcoedu.org'),
  ('2do. Secundaria', 'Leidy Yogerny Hodge Soriano', 'leidyh2@do.amcoedu.org'),
  ('2do. Secundaria', 'Lianny Esther Maria Santana', 'lianym1@do.amcoedu.org'),
  ('2do. Secundaria', 'Manuel Alejandro Tavarez Rivera', 'manuelt1@do.amcoedu.org'),
  ('2do. Secundaria', 'Omarelin Mack king', 'omarelinm5@do.amcoedu.org'),
  ('2do. Secundaria', 'Roberto Sebastian Leonardo Agesta', 'robertol2@do.amcoedu.org'),
  ('2do. Secundaria', 'Roneliz Naturaleza Ramirez Agramonte', 'ronelizr1@do.amcoedu.org'),
  ('2do. Secundaria', 'Rubert Rondon Soriano', 'rubertr4@do.amcoedu.org'),
  ('2do. Secundaria', 'Sebastian Daniel Reyes bary', 'sebastianr33@do.amcoedu.org'),
  ('2do. Secundaria', 'Sharolyn Yeliss De La Cruz', 'sharolynd3@do.amcoedu.org'),
  ('2do. Secundaria', 'Siara Emilia Santana Martinez', 'siaras1@do.amcoedu.org'),
  ('2do. Secundaria', 'Keiri Franchesca Del Rosario Martes', 'keirid1@do.amcoedu.org'),
  ('2do. Secundaria', 'Elier Jose Contrera Sierra', 'elierjc1@do.amcoedu.org'),
  ('2do. Secundaria', 'Elian Alberto Lugo', 'ellianal1@do.amcoedu.org'),
  ('3ro. Secundaria', 'Angel Jose Maria Santana', 'angelm18@do.amcoedu.org'),
  ('3ro. Secundaria', 'Ahsly Roely Alcantara Rodriguez', 'ashlya3@do.amcoedu.org'),
  ('3ro. Secundaria', 'Aylin Esther Ogando Solano', 'aylino2@do.amcoedu.org'),
  ('3ro. Secundaria', 'Ellanyi Juan George', 'ellanyij4@do.amcoedu.org'),
  ('3ro. Secundaria', 'Franklin Noel Ortiz Pierre', 'franklino3@do.amcoedu.org'),
  ('3ro. Secundaria', 'Jeanderlin Miguel Echavarria Rosa', 'jeanderline2@do.amcoedu.org'),
  ('3ro. Secundaria', 'Jhom Deivy Santana Paniagua', 'jhomd1@do.amcoedu.org'),
  ('3ro. Secundaria', 'Osvaldo Andres Nuñez Rivera', 'osvaldon3@do.amcoedu.org'),
  ('3ro. Secundaria', 'Rosse Daivi Santana', 'rosses1@do.amcoedu.org'),
  ('3ro. Secundaria', 'Victor Enmanuel Sanchez', 'victors8@do.amcoedu.org'),
  ('3ro. Secundaria', 'Weiler Angeirel Guerrero Perez', 'weilerg1@do.amcoedu.org'),
  ('3ro. Secundaria', 'Yariel Felix King', 'yarielf1@do.amcoedu.org'),
  ('3ro. Secundaria', 'Yohandali Ysabel Benitez De los Santos', 'yohandalib1@do.amcoedu.org'),
  ('3ro. Secundaria', 'Jair Esther Soriano Romero', 'jairs2@do.amcoedu.org'),
  ('3ro. Secundaria', 'Jeisy Carolina Ramirez Medina', 'jeisycr1@do.amcoedu.org'),
  ('3ro. Secundaria', 'Yanela Alejandra Herrera Solano', 'yanelah2@do.amcoedu.org'),
  ('4to. Secundaria', 'Alan Alexander Madrigal Soriano', 'alanm6@do.amcoedu.org'),
  ('4to. Secundaria', 'Allison Daniela Reyes Bary', 'allisonr4@do.amcoedu.org'),
  ('4to. Secundaria', 'Alondra Griseel Baez Ortiz', 'alondrab2@do.amcoedu.org'),
  ('4to. Secundaria', 'Crismeiry Dahiana Ramírez Arroyo', 'crismeiryr6@do.amcoedu.org'),
  ('4to. Secundaria', 'Dana Gabriela Olivares Perez', 'danao3@do.amcoedu.org'),
  ('4to. Secundaria', 'Daniel Reyes Tavarez', 'danielr14@do.amcoedu.org'),
  ('4to. Secundaria', 'Dhanel Elian Leonardo Mercedes', 'dhanell3@do.amcoedu.org'),
  ('4to. Secundaria', 'Emmanuel Espiritu De los Santos', 'emmanuele3@do.amcoedu.org'),
  ('4to. Secundaria', 'Jarolin Jazmin Martinez Adames', 'jarolinm2@do.amcoedu.org'),
  ('4to. Secundaria', 'Jismari Eimily Marte Avila', 'jismarim4@do.amcoedu.org'),
  ('4to. Secundaria', 'Yesner Omar Mack King', 'yesnerm4@do.amcoedu.org'),
  ('4to. Secundaria', 'Ahleys Ysauris Sanchez', 'ahleysys1@do.amcoedu.org'),
  ('5to. Secundaria', 'Arianny Fernandez Rijo', 'ariannyf1@do.amcoedu.org'),
  ('5to. Secundaria', 'Darlin Feliz', 'darlynf1@do.amcoedu.org'),
  ('5to. Secundaria', 'Helen Margarita Urraca Soriano', 'helenu1@do.amcoedu.org'),
  ('5to. Secundaria', 'Breilyn Angelina Marino Cordero', 'breilynam1@do.amcoedu.org'),
  ('5to. Secundaria', 'Keyser Felipe Pacheco Bell', 'keyserfp1@do.amcoedu.org'),
  ('5to. Secundaria', 'Julianny Garcia Valdez', 'juliannyg1@do.amcoedu.org'),
  ('6to. Secundaria', 'Albeiro Ismael Mejia Martinez', 'albeirom2@do.amcoedu.org'),
  ('6to. Secundaria', 'Brandy Rayveli Garcia Cubilete', 'brandyg4@do.amcoedu.org'),
  ('6to. Secundaria', 'Chanel Lisbeth Arroyo Gomez', 'chanela5@do.amcoedu.org'),
  ('6to. Secundaria', 'Daury Feliz', 'dauryf4@do.amcoedu.org'),
  ('6to. Secundaria', 'Fernando Luis Natera Delgado', 'fernandon3@do.amcoedu.org'),
  ('6to. Secundaria', 'Haysha Linette Vanterpool Michel', 'hayshav2@do.amcoedu.org'),
  ('6to. Secundaria', 'Karla Ines Diaz Silverio', 'karlad7@do.amcoedu.org'),
  ('6to. Secundaria', 'Liam Carlos Mercedes Martinez', 'liamm35@do.amcoedu.org'),
  ('6to. Secundaria', 'Yanela Alejandra Herrera Solano', 'luisah13@do.amcoedu.org'),
  ('6to. Secundaria', 'Norbelis Zapata Soriano', 'norbelisz6@do.amcoedu.org'),
  ('6to. Secundaria', 'Onaimi Nayeli Nuñez Rivera', 'onaimin3@do.amcoedu.org'),
  ('6to. Secundaria', 'Samuel Nicanor Figuereo Acta', 'samuelf5@do.amcoedu.org'),
  ('6to. Secundaria', 'Yakeily Ozoria Figuereo', 'yakeilyo6@do.amcoedu.org'),
  ('6to. Secundaria', 'Yanedy Ruiz Gonzales', 'yanedyr6@do.amcoedu.org'),
  ('6to. Secundaria', 'Ashley Franchesca Soriano Giron', 'ashleyfs2@do.amcoedu.org'),
  ('3ro. Primaria', 'Abigaelle keisha Laguerre', 'abigaellekl5@do.amcoedu.org'),
  ('3ro. Primaria', 'Brittany Eugenia Santana Peguero', 'brittanyes3@do.amcoedu.org'),
  ('3ro. Primaria', 'Densy Alejandra Paulino Víctor', 'densyap4@do.amcoedu.org'),
  ('3ro. Primaria', 'Ellian Moisés Duran Ortiz', 'elianmd2@do.amcoedu.org'),
  ('3ro. Primaria', 'Facundo Joel Charo Pacheco', 'facundojc5@do.amcoedu.org'),
  ('3ro. Primaria', 'Kaylie Cesarina Patin Silvestre', 'kayliecp1@do.amcoedu.org'),
  ('3ro. Primaria', 'Leanny Antonia Henry Ramírez', 'leannyah2@do.amcoedu.org'),
  ('3ro. Primaria', 'Liam Eliezer Peña Tejeda', 'liamep3@do.amcoedu.org'),
  ('3ro. Primaria', 'Luis Manuel Jiménez Santana', 'luismj6@do.amcoedu.org'),
  ('3ro. Primaria', 'Roneldiz Enmanuel Ramírez Agramonte', 'roneldizer2@do.amcoedu.org'),
  ('3ro. Primaria', 'Sayhanni Darliza Richards Castro', 'sayhannidr2@do.amcoedu.org'),
  ('3ro. Primaria', 'Valentina Sofia Travieso Rangel', 'valentinast2@do.amcoedu.org'),
  ('3ro. Primaria', 'Wilery Elianna Foston Rosario', 'wieryef1@do.amcoedu.org'),
  ('3ro. Primaria', 'Wilmeiry Carmona Pozo', 'wilmeiryc4@do.amcoedu.org'),
  ('3ro. Primaria', 'Yadiel Enmanuel Ward', 'yadielew1@do.amcoedu.org'),
  ('3ro. Primaria', 'Adrielly Esther James De los Santos', 'adriellyej1@do.amcoedu.org'),
  ('3ro. Primaria', 'Christopher Adrian Reyes Fernandez', 'christopherar3@do.amcoedu.org'),
  ('3ro. Primaria', 'Heikel De la Cruz Javier', 'heikeld1@do.amcoedu.org'),
  ('3ro. Primaria', 'Henry Junior Jimenez Romero', 'henryjj2@do.amcoedu.org'),
  ('3ro. Primaria', 'Jaslyn Marie Mack', 'jaslynmm3@do.amcoedu.org'),
  ('3ro. Primaria', 'Jonathan Alejandro Castro James', 'jonathanac2@do.amcoedu.org'),
  ('3ro. Primaria', 'Luz Ani Ward Castro', 'luzaw2@do.amcoedu.org'),
  ('4to. Primaria', 'Charleny Grissel Abreu Roy', 'charlenya1@do.amcoedu.org'),
  ('4to. Primaria', 'Erneidy camila Feliciano veloz', 'erneidyf1@do.amcoedu.org'),
  ('4to. Primaria', 'swanny marianne Gutiérrez sabino', 'swannyg3@do.amcoedu.org'),
  ('4to. Primaria', 'Brianny Arlet Leonardo Rodriguez', 'briannyl3@do.amcoedu.org'),
  ('4to. Primaria', 'Ángel Linares Mejías', 'angell7@do.amcoedu.org'),
  ('4to. Primaria', 'Haniel Starling Medina Belen', 'hanielm4@do.amcoedu.org'),
  ('4to. Primaria', 'Breidy Mateo Nieve Puello', 'breidyn3@do.amcoedu.org'),
  ('4to. Primaria', 'Quency Olygario Emile', 'quencho1@do.amcoedu.org'),
  ('4to. Primaria', 'Juan Carlos ozuna cruz', 'juano3@do.amcoedu.org'),
  ('4to. Primaria', 'Jazlyn Michell Peña Sanchez', 'jazlynp3@do.amcoedu.org'),
  ('4to. Primaria', 'Damian lsaac Polanco Medina', 'damianp3@do.amcoedu.org'),
  ('4to. Primaria', 'Haziel Ernesto Astacio Barbosa', 'haziela3@do.amcoedu.org'),
  ('4to. Primaria', 'Guillermo Jose Valdez Denis', 'guillermov1@do.amcoedu.org'),
  ('4to. Primaria', 'Maibely Juliet Rivera Rivera', 'maibelyjr1@do.amcoedu.org'),
  ('4to. Primaria', 'Sarah Abigail Calis Gonzalez', 'sarahac5@do.amcoedu.org'),
  ('4to. Primaria', 'Alaia Kamila Montero Abreu', 'alaiakm1@do.amcoedu.org'),
  ('4to. Primaria', 'Aleybi Siloe Guaba de los Santos', 'aleybisg1@do.amcoedu.org'),
  ('4to. Primaria', 'Frainiel Lorenzo Ortiz', 'frainiell2@do.amcoedu.org'),
  ('4to. Primaria', 'Isaias de los santos Peña Romero', 'isaiasdp1@do.amcoedu.org'),
  ('4to. Primaria', 'Juaneily Juliet Diaz Farrell', 'juaneilybd1@do.amcoedu.org'),
  ('5to. Primaria', 'Julio Dairon Astacio Jiménez', 'julioa3@do.amcoedu.org'),
  ('5to. Primaria', 'Xiomeilys Baez Mejia', 'xiomeilysb5@do.amcoedu.org'),
  ('5to. Primaria', 'Yandal Osiris Cabrera Angoma', 'yandalc3@do.amcoedu.org'),
  ('5to. Primaria', 'Eliam Miguel Cueto Payaso', 'eliamc1@do.amcoedu.org'),
  ('5to. Primaria', 'lsaac Xavier Brown Nicolas', 'isaacb7@do.amcoedu.org'),
  ('5to. Primaria', 'Anderson Jose Felix King', 'andersonf2@do.amcoedu.org'),
  ('5to. Primaria', 'Ellian Juan George', 'elliang1@do.amcoedu.org'),
  ('5to. Primaria', 'Ronelvi Samuel Ramirez Agramonte', 'ronelvir1@do.amcoedu.org'),
  ('5to. Primaria', 'Reyshell Alia Rodriguez Garcia', 'reyshellr3@do.amcoedu.org'),
  ('5to. Primaria', 'Isabel Gabriela Valdez Denis', 'isabelv2@do.amcoedu.org'),
  ('5to. Primaria', 'Abrahan Isai Bello Berroa', 'abrahamb5@do.amcoedu.org'),
  ('5to. Primaria', 'Jahel Anibal Guerrero Paulino', 'jahelag1@do.amcoedu.org'),
  ('5to. Primaria', 'Pablo Yadiel Marte Jhonson', 'pabloyj1@do.amcoedu.org'),
  ('5to. Primaria', 'Ashira Esther James De los Santos', 'ashiraej1@do.amcoedu.org'),
  ('5to. Primaria', 'Luis David Jimenez Santana', 'luisdj5@do.amcoedu.org'),
  ('5to. Primaria', 'Nashly Divina Jimenez Mella', 'nashlydj1@do.amcoedu.org'),
  ('6to. Primaria', 'Yosayra Alcantara Roy', 'yosayraa1@do.amcoedu.org'),
  ('6to. Primaria', 'Xiara Camila Avelino Alberto', 'xiaraa2@do.amcoedu.org'),
  ('6to. Primaria', 'Dylan Beltre Custodio', 'dylanb6@do.amcoedu.org'),
  ('6to. Primaria', 'Josue Elias Carrion de la Cruz', 'josuec3@do.amcoedu.org'),
  ('6to. Primaria', 'Dawen Ezequiel Deffer', 'dawerd1@do.amcoedu.org'),
  ('6to. Primaria', 'Caylin Nayeli Diaz de la Cruz', 'caylind1@do.amcoedu.org'),
  ('6to. Primaria', 'Yariel Emilio Gil Solis', 'yarielg3@do.amcoedu.org'),
  ('6to. Primaria', 'Nashly Gonzales Olivarez', 'nashlyg3@do.amcoedu.org'),
  ('6to. Primaria', 'Yosmailyn Matos Montero', 'yosmailynm5@do.amcoedu.org'),
  ('6to. Primaria', 'Elaine Elizabeth Medina Guzman', 'elainem3@do.amcoedu.org'),
  ('6to. Primaria', 'Sebastian Misael Medina Piccirillo', 'sebastianm40@do.amcoedu.org'),
  ('6to. Primaria', 'Edian Carlos Mercedes Martinez', 'edianm1@do.amcoedu.org'),
  ('6to. Primaria', 'Dioneylis Shannel Orozco Martinez', 'dioneyliso4@do.amcoedu.org'),
  ('6to. Primaria', 'Esdras Leonardo Pinales Crispín', 'esdrasp2@do.amcoedu.org'),
  ('6to. Primaria', 'Erick David Reyes Contreras', 'ericr4@do.amcoedu.org'),
  ('6to. Primaria', 'Yosairis Rodriguez Varela', 'yosairisr2@do.amcoedu.org'),
  ('6to. Primaria', 'Jhotyn Rafael Sanchez Santana', 'jhostyns1@do.amcoedu.org'),
  ('6to. Primaria', 'Amy AIvanna Sorianna Guerrero', 'amys2@do.amcoedu.org'),
  ('6to. Primaria', 'Raynier Isac Valdez Dencon', 'raynierv3@do.amcoedu.org'),
  ('6to. Primaria', 'Ambar Rousauri Valdez Cordero', 'ambarrv1@do.amcoedu.org'),
  ('6to. Primaria', 'Leandry Snayder Santos Valdez', 'leandryss1@do.amcoedu.org'),
  ('6to. Primaria', 'Isaac Rodrigo Salas', 'isaacr6@do.amcoedu.org'),
  ('6to. Primaria', 'Rayniel Gustavo Reyes Donastorg', 'raynielgr3@do.amcoedu.org');

with school as (
  select id from schools where name = 'Centro Educativo Gran Manantial de Sabiduría'
),
cand as (
  select s.grade, s.full_name, s.email, st.id as student_id,
    case
      when pg_temp.nw(st.first_name || ' ' || st.last_name) = pg_temp.nw(s.full_name) then 1
      when least(cardinality(pg_temp.nw(st.first_name || ' ' || st.last_name)), cardinality(pg_temp.nw(s.full_name))) >= 3
       and (pg_temp.nw(s.full_name) <@ pg_temp.nw(st.first_name || ' ' || st.last_name)
         or pg_temp.nw(st.first_name || ' ' || st.last_name) <@ pg_temp.nw(s.full_name)) then 2
    end as tier
  from _amco_src s
  join school sc on true
  join students st
    on st.school_id = sc.id
   and st.deleted_at is null
   and lower(trim(st.grade_level)) = lower(trim(s.grade))
),
best as (
  select grade, full_name, email, min(tier) as tier
  from cand where tier is not null
  group by grade, full_name, email
),
pick as (
  select b.grade, b.full_name, b.email, b.tier,
         (select count(*) from cand c where c.grade = b.grade and c.full_name = b.full_name and c.email = b.email and c.tier = b.tier) as n,
         (select c.student_id from cand c where c.grade = b.grade and c.full_name = b.full_name and c.email = b.email and c.tier = b.tier limit 1) as student_id
  from best b
)
insert into amco_student_accounts (school_id, student_id, source_full_name, source_grade, email, match_method, batch)
select (select id from school), p.student_id, s.full_name, s.grade, s.email,
       case when p.n = 1 and p.tier = 1 then 'nombre_exacto'
            when p.n = 1 and p.tier = 2 then 'nombre_contenido'
            else 'sin_emparejar' end,
       1
from _amco_src s
left join pick p on p.grade = s.grade and p.full_name = s.full_name and p.email = s.email
-- un estudiante solo puede tener un correo por año: si dos filas apuntan al
-- mismo estudiante, la segunda no se inserta.
on conflict do nothing;

-- Las que apuntaban a un estudiante ya asignado quedaron fuera por el
-- conflicto; se reinsertan sin emparejar para que aparezcan en el reporte.
insert into amco_student_accounts (school_id, student_id, source_full_name, source_grade, email, match_method, batch)
select (select id from schools where name = 'Centro Educativo Gran Manantial de Sabiduría'),
       null, s.full_name, s.grade, s.email, 'sin_emparejar', 1
from _amco_src s
where not exists (
  select 1 from amco_student_accounts a
  where lower(a.email) = lower(s.email) and a.source_grade = s.grade and a.school_year = '2026-2027'
)
on conflict do nothing;

commit;

-- REPORTE (lo que muestra el SQL Editor):
--   1_resumen         conteos
--   2_sin_emparejar   filas que NO recibirán correo + candidatos sugeridos
--   3_sin_correo_amco estudiantes inscritos de estos cursos que no están en la lista
select '1_resumen' as seccion, a.match_method as detalle, count(*)::text as dato, null as extra
from amco_student_accounts a where a.school_year = '2026-2027' and a.batch = 1
group by a.match_method
union all
select '2_sin_emparejar', a.source_grade || ' · ' || a.source_full_name, a.email,
  (select string_agg(st.id || ' → ' || st.first_name || ' ' || st.last_name, ' | ')
   from students st
   where st.school_id = a.school_id and st.deleted_at is null
     and lower(trim(st.grade_level)) = lower(trim(a.source_grade))
     and cardinality(array(select unnest(pg_temp.nw(st.first_name || ' ' || st.last_name))
                           intersect select unnest(pg_temp.nw(a.source_full_name)))) >= 2)
from amco_student_accounts a
where a.school_year = '2026-2027' and a.batch = 1 and a.match_method = 'sin_emparejar'
union all
select '3_sin_correo_amco', st.grade_level || ' · ' || st.first_name || ' ' || st.last_name, st.id::text, st.enrollment_status
from students st
where st.school_id = (select id from schools where name = 'Centro Educativo Gran Manantial de Sabiduría')
  and st.deleted_at is null and st.enrollment_status = 'inscrito'
  and st.grade_level in ('3ro. Primaria','4to. Primaria','5to. Primaria','6to. Primaria',
                         '1ro. Secundaria','2do. Secundaria','3ro. Secundaria','4to. Secundaria','5to. Secundaria','6to. Secundaria')
  and not exists (select 1 from amco_student_accounts a where a.student_id = st.id and a.school_year = '2026-2027')
order by 1, 2;
