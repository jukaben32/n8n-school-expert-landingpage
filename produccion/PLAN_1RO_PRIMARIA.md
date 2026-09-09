# Academia 1ro de Primaria — plan de video-lecciones del año escolar 2026-2027

**93 lecciones en 4 materias**, una por semana y por materia aproximadamente,
alineadas unidad por unidad con las guías del proyecto **ActivaMente** que usa
el Centro Educativo Gran Manantial de Sabiduría y con el **Diseño Curricular
del MINERD** (ver `curriculo-1ro.md`, que trae la fuente y las páginas
exactas).

| Materia | Unidades del libro | Lecciones |
|---|---|---|
| Lengua Española | 7 (U0–U6) + 2 ABP | 21 |
| Matemática | 10 + ¡De vuelta a clases! + ABP | 32 |
| Ciencias de la Naturaleza | 9 + ABP | 21 |
| Ciencias Sociales | 10 + ABP | 19 |
| **Total** | **36 unidades** | **93** |

---

## Cómo es una lección de 1ro (y por qué NO es una de 6to en pequeño)

Las 9 lecciones de 6to que ya están en producción viven de láminas con
texto. Un niño de 6 años en septiembre **no lee todavía**: aprender a leer es
lo que va a hacer durante este año. Así que cambian cinco cosas, y son
decisiones tomadas a propósito, no un ajuste de estilo:

| | 6to (ya en producción) | 1ro (este plan) |
|---|---|---|
| Duración | ~6 min | **2–3 min** (medido en las 12 ya escritas) |
| Escenas | 15 | **11–13**, contando las que leen el cuestionario |
| Ritmo de la voz | ~150 palabras/min | **~130** (`ritmo: 0.76`) |
| Lámina | Título + texto explicativo | **Un dibujo grande, 6 palabras como máximo** |
| Cuestionario | 4 preguntas, opciones de texto | **3 preguntas, opciones con dibujo** |

**El cuestionario era el problema serio, y era de código, no de guion.**
`LessonPlayer.tsx` pintaba cada opción como texto y nada más. Se agregó
`quiz_options.image_path` (migración `20260913000000`) y la rejilla de
dibujos en el reproductor. Una opción sin imagen sigue mostrando su texto,
así que las lecciones de 6to no cambian en nada y una lección de 1ro se
puede contestar aunque una imagen falle al cargar.

**Además, el video siempre lee las preguntas en voz alta al final.** Aunque
las imágenes estén, el niño de 1ro necesita oír la pregunta. Las últimas
escenas de cada guion son eso, y no son opcionales.

### Reglas de contenido

- **Nada de "la letra de la semana" en Lengua.** El currículo oficial no
  prescribe orden de letras: trabaja la conciencia fonológica desde las
  palabras de cada tipo de texto. Un video sobre la S cuando el salón va por
  la M es peor que no tener video; organizarlo por tipo de texto elimina ese
  riesgo (ver `curriculo-1ro.md`).
- **Los ejemplos son dominicanos**: el colmado de la esquina, una funda de
  mangos, la guagua, el plátano, pesos dominicanos. Además de entenderse
  mejor aquí, hace el contenido original por construcción.
- **Ningún modelo generativo escribe un dato.** Números, letras y rótulos se
  dibujan con HTML real (`lib/estilo-inicial.css`). Los dibujos son emoji
  (fuente, determinista) y SVG hecho a mano.

---

## Lengua Española — 21 lecciones

Cada unidad del libro es un tipo de texto del currículo oficial, uno por uno.

### U0. Un día muy especial · *la lista de asistencia y el calendario*
| # | Lección | Qué aprende | Cuestionario |
|---|---|---|---|
| 1 | Mi nombre en la lista | Reconocer su nombre escrito entre otros; para qué sirve pasar lista | Señalar el nombre que empieza igual que el suyo |
| 2 | ¿Cuántas sílabas tiene tu nombre? | Contar sílabas dando palmadas | Cuántas palmadas tiene una palabra dibujada |
| 3 | El calendario de mi salón | Los días de la semana, para qué sirve el calendario | Qué día viene después del que se muestra |

### U1. ¿Quién soy? · *la tarjeta de identidad*
| # | Lección | Qué aprende | Cuestionario |
|---|---|---|---|
| 1 | Mi tarjeta con mi nombre | Nombre y apellido; la mayúscula al inicio | Cuál tarjeta está bien escrita |
| 2 | El sonido con que empieza mi nombre | Sonido inicial; letra inicial | Qué dibujo empieza con el mismo sonido |
| 3 | Nombres que riman | Rimas | Cuál rima con la palabra dada |

### U2. Muchos letreros · *el letrero*
| # | Lección | Qué aprende | Cuestionario |
|---|---|---|---|
| 1 | Los letreros hablan sin hablar | Para qué sirve un letrero; leer el entorno | Qué letrero va en cada lugar |
| 2 | Letreros de mi barrio | Palabras frecuentes: PARE, SALIDA, BAÑO, COLMADO | Qué dice el letrero que se muestra |
| 3 | Escribo mi propio letrero | Producción escrita corta; letra grande y clara | Cuál letrero se entiende mejor |

### U3. La lista de compras · *la lista*
| # | Lección | Qué aprende | Cuestionario |
|---|---|---|---|
| 1 | ¿Qué es una lista? | Estructura: una cosa debajo de la otra | Cuál de las dos es una lista |
| 2 | Palabras largas y palabras cortas | Comparar longitud de palabras (pan / plátano) | Cuál palabra es la más larga |
| 3 | Escribo la lista del colmado | Producción escrita; orden | Qué falta en la lista |

### U4. Pequeños mensajes · *el mensaje corto*
| # | Lección | Qué aprende | Cuestionario |
|---|---|---|---|
| 1 | Un mensaje para alguien | Para qué sirve; a quién se lo escribo | A quién va dirigido el mensaje |
| 2 | Junto sílabas y formo palabras | Unir sílabas (ma-no, ca-sa) | Qué palabra se forma con esas sílabas |
| 3 | Le escribo un recado a mi mamá | Producción escrita | Cuál recado está completo |

### U5. Leemos noticias · *la noticia*
| # | Lección | Qué aprende | Cuestionario |
|---|---|---|---|
| 1 | ¿Qué es una noticia? | Qué pasó, dónde y cuándo | Cuál de estas es una noticia |
| 2 | El titular dice mucho en poco | El titular resume | Qué titular va con el dibujo |
| 3 | Cuento una noticia de mi escuela | Producción oral y escrita | Qué le falta a esta noticia |

### U6. Había una vez · *el cuento*
| # | Lección | Qué aprende | Cuestionario |
|---|---|---|---|
| 1 | Todo cuento tiene tres partes | Principio, medio y final | Cuál dibujo es el principio |
| 2 | Los personajes del cuento | Quién es el personaje | Quién es el personaje principal |
| 3 | Invento el final | Producción oral creativa | Cuál final tiene sentido |

**ABP (Teatrillo de títeres · La lista de compras)**: son proyectos de aula,
no lecciones. Quedan **fuera del catálogo de video** a propósito: el valor
del ABP está en que el niño lo haga con las manos y con sus compañeros. Si
más adelante se quiere apoyo audiovisual, lo natural es **un solo video de
"cómo se hace"** dirigido a la maestra y a la familia, no una lección con
cuestionario.

---

## Matemática — 32 lecciones

Es la materia donde el orden del libro tiene más margen de duda: los títulos
("En el jardín de mi casa") son temáticos y no dicen el contenido. **El
reparto de abajo sigue la progresión estándar del currículo de 1ro**
(conteo → decena → suma → resta → hasta 99 → geometría → medida → datos),
que es la que usa cualquier libro de este grado, pero **cada unidad está
marcada para que la maestra de 1ro lo confirme antes de producir esa tanda**.
Confirmarlo es leer los títulos de las lecciones de una unidad del libro: 5
minutos por unidad.

### U0. ¡De vuelta a clases! *(repaso de Inicial)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Contamos del 1 al 10 | Conteo con objetos; el número dice cuántos hay |
| 2 | Agrupamos por color, forma y tamaño | Clasificar según una característica |

### U1. ¡Me gusta jugar! *(números hasta el 9)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Los números del 0 al 9 | Nombre, símbolo y cantidad |
| 2 | ¿Cuántos hay? Más, menos e igual | Comparar cantidades |
| 3 | Primero, segundo, tercero | Ordinales hasta el décimo |

### U2. En el jardín de mi casa *(hasta el 19 · la suma)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Del 10 al 19: nace la decena | Diez unidades hacen una decena |
| 2 | Juntar es sumar | El signo + y el = |
| 3 | Sumamos hasta 10 | Con dedos, objetos y dibujos |

### U3. De paseo a la playa *(la resta)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Quitar es restar | El signo − |
| 2 | Restamos hasta 10 | Con objetos y dibujos |
| 3 | ¿Sumo o resto? | Elegir la operación en un problema |

### U4. ¡Qué diversa es la vida! *(hasta el 99)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Contamos de 10 en 10 hasta 99 | La tabla del 99 |
| 2 | Decenas y unidades | Valor de posición; componer y descomponer |
| 3 | Mayor, menor o igual | Los signos >, < y = |

### U5. En el museo *(figuras planas y líneas)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Círculo, cuadrado, triángulo y rectángulo | Nombrar y distinguir |
| 2 | Líneas rectas, curvas y mixtas | Reconocerlas y trazarlas |
| 3 | Mosaicos y patrones | Construir patrones con figuras |

### U6. Después de mis tareas *(el tiempo)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Los días de la semana | El calendario y para qué sirve |
| 2 | El reloj: la hora en punto | Leer relojes análogos y digitales |
| 3 | Antes, ahora y después | Ordenar secuencias de actividades |

### U7. Divertirnos en familia *(suma y resta hasta 99)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Sumamos números de dos cifras | Sin llevar |
| 2 | Restamos números de dos cifras | Sin llevar |
| 3 | Patrones de números | De 2 en 2, de 5 en 5, de 10 en 10 |

### U8. Formas a mi alrededor *(cuerpos geométricos y posición)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Cubo, esfera, cono y cilindro | Reconocerlos en objetos reales |
| 2 | Caras, bordes y esquinas | Describir un cuerpo geométrico |
| 3 | Arriba, abajo, dentro, fuera | Posición; izquierda y derecha |

### U9. En el súper *(dinero y medida)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Nuestras monedas | 1, 5, 10 y 25 pesos |
| 2 | Los billetes | 20, 50 y 100 pesos; equivalencias |
| 3 | Largo y corto, pesado y liviano | Comparar y estimar |
| 4 | La taza, el litro y el galón | Capacidad con unidades arbitrarias |

### U10. ¡Llegan las vacaciones! *(datos)*
| # | Lección | Qué aprende |
|---|---|---|
| 1 | Tablas de conteo | Recolectar y organizar datos |
| 2 | Pictogramas y gráficas de barras | Leer e interpretar |

---

## Ciencias de la Naturaleza — 21 lecciones

Los títulos de las unidades ya son el contenido: aquí no hay nada que
suponer, el mapeo con el currículo es directo.

### U1. Los seres vivos
1. **¿Está vivo o no está vivo?** — nace, crece, se alimenta y muere.
2. **Las plantas también están vivas** — partes de la planta y qué necesita.

### U2. Los animales
1. **Los animales por fuera** — patas, alas, cola, plumas, escamas.
2. **¿Dónde viven y cómo se mueven?** — acuáticos, terrestres, los que vuelan.
3. **¿Qué comen los animales?** — plantas, otros animales, de todo.

### U3. Los seres humanos
1. **Las partes de mi cuerpo** — cabeza, tronco y extremidades.
2. **Mis cinco sentidos** — para qué sirve cada uno.

### U4. Cuidemos nuestra salud
1. **Lavarse las manos y cepillarse los dientes** — higiene diaria.
2. **Alimentos que me hacen bien** — elegir bien qué comer.
3. **Cuando me enfermo y las vacunas** — gripe, dengue; por qué vacunarse.

### U5. La materia
1. **Sólido, líquido y gas** — con agua, hielo y vapor.
2. **¿Se disuelve o no se disuelve?** — mezclas en agua (sal, azúcar, arena).

### U6. Las máquinas
1. **Máquinas simples que uso todos los días** — la rampa, la palanca, la rueda.
2. **Casas, edificios y cómo nos comunicamos** — teléfono, radio, televisión.

### U7. El sonido
1. **Sonidos fuertes y suaves** — intensidad.
2. **Sonidos graves y agudos** — tono.

### U8. Me ubico en el espacio
1. **¿Dónde está?** — posición con un punto de referencia.
2. **¿Cómo llego?** — trayectoria, dar y seguir indicaciones.

### U9. La Tierra, el Sol y la Luna
1. **El agua, el aire y el suelo** — de qué está hecho nuestro planeta.
2. **El día y la noche** — por qué se hace de noche.

### ABP. Nos preparamos para un huracán
1. **Antes, durante y después de un huracán** — qué hace mi familia.
   *Es el único ABP que sí lleva video*: es contenido de seguridad y en este
   país es información que salva, no una manualidad de aula.

---

## Ciencias Sociales — 19 lecciones

### U1. Mi identidad personal
1. **Yo soy único** — mi nombre completo, cómo soy, qué me gusta.

### U2. Mi familia
1. **Quiénes forman mi familia** — integrantes y qué hace cada uno.
2. **Mi árbol genealógico** — de dónde vengo.

### U3. Mi comunidad
1. **Mi casa, mi calle, mi barrio** — dónde vivo y cómo se llama.
2. **Mi escuela y quiénes trabajan en ella** — la comunidad escolar.

### U4. Historia de mi familia y mi entorno
1. **Antes y ahora** — cómo cambian las personas y los lugares con el tiempo.

### U5. Orientación espacial
1. **Cerca, lejos, izquierda y derecha** — orientarse con referencias.
2. **Un mapa sencillo de mi escuela** — leer y dibujar un mapa.

### U6. La isla de Santo Domingo
1. **La isla donde vivo** — República Dominicana y Haití.
2. **Mi pueblo en el mapa** — ubicar su comunidad.

### U7. Orientación temporal
1. **Ayer, hoy y mañana** — pasado, presente y futuro.
2. **La línea del tiempo de mi día** — mañana, tarde y noche.

### U8. Valores y deberes
1. **Mis deberes en la casa y en la escuela** — responsabilidades.
2. **Los símbolos patrios** — la Bandera y el Himno Nacional.

### U9. Mis derechos y mis necesidades
1. **Lo que todo niño necesita** — alimentación, salud, vivienda, educación.
2. **Mis derechos** — y el respeto a los de los demás.

### U10. El entorno natural y social
1. **Espacios naturales y espacios sociales** — el río y el parque.
2. **Cuido mi ambiente** — acciones que ayudan y acciones que dañan.

**ABP (Témperas naturales)**: sin video, por la misma razón que los de
Lengua — el valor está en hacerlo con las manos.

---

## Lo que ya está escrito (12 lecciones)

Guiones completos, con su cuestionario ilustrado, verificados con
`node lib/revisar-guiones.mjs 1ro` y con todas sus láminas renderizadas y
revisadas. **Falta la voz** (`OPENROUTER_API_KEY`) para que salga el MP4.

| Materia | Lecciones listas |
|---|---|
| Lengua Española | U0 *Mi nombre en la lista* · U0 *¿Cuántas sílabas tiene tu nombre?* · U1 *Mi tarjeta con mi nombre* |
| Matemática | U0 *Contamos del 1 al 10* · U1 *Los números del 0 al 9* · U1 *Primero, segundo, tercero* |
| Ciencias Naturales | U1 *¿Está vivo o no está vivo?* · U1 *Las plantas también están vivas* · U2 *Los animales por fuera* |
| Ciencias Sociales | U1 *Yo soy único* · U2 *Quiénes forman mi familia* · U3 *Mi casa, mi calle, mi barrio* |

Son ~3 semanas de clase en las cuatro materias a la vez, o sea el arranque
real del año. Las 81 restantes siguen el mismo molde.

## Herramientas de la fábrica

| Script | Para qué |
|---|---|
| `lib/revisar-guiones.mjs` | Revisa los guiones **antes** de producirlos: curso exacto, láminas, cuestionario, y que la respuesta correcta no caiga siempre en el mismo botón. Corre en un segundo y evita descubrir el fallo con el MP4 ya hecho. |
| `lib/render-laminas.mjs` | Dibuja las láminas y los dibujos del cuestionario sin gastar una sola llamada de voz. Sirve para revisar cómo se ve una lección. |
| `lib/producir.mjs` | La fábrica completa: láminas → voz verificada palabra por palabra → MP4. |
| `lib/subir-imagenes.mjs` | Sube los dibujos de las opciones al bucket privado. |
| `lib/cargar-sql.mjs` | Genera el SQL que carga las lecciones en Academia. |

## Orden de producción

No se produce en volumen sin haber cerrado el ciclo completo una vez. Es lo
mismo que se hizo con 6to y funcionó.

1. **Tanda piloto** — la Unidad 1 de las 4 materias. Se produce, se sube, se
   carga y **la maestra de 1ro la ve completa** antes de seguir. Ahí se
   ajusta ritmo, vocabulario y dificultad del cuestionario con evidencia, no
   con opinión.
2. **Primer trimestre** — hasta U3 de cada materia.
3. **Segundo y tercer trimestre** — el resto, por tandas de unidad.

### Estado verificado contra producción (2026-09-09)

Con un PAT de la Management API, de un solo uso:

| | |
|---|---|
| Curso exacto de 1ro | **`1ro. Primaria`** — con punto. **20 inscritos** (27 con los retirados). Es el texto que va en `lessons.grade_level`, carácter por carácter. |
| `20260909000000_academia_curso_texto` | ✅ **aplicada** (`lessons.grade_level` existe). AGENTS.md la daba por pendiente; ya no lo está. |
| `20260913000000_quiz_opciones_con_imagen` | ✅ **aplicada** en esta sesión, y comprobada corriéndola **dos veces** (idempotente). |
| Lecciones de 6to | ✅ **9 cargadas y publicadas**, 4 preguntas cada una, en `6to. Primaria`. |
| Sin regresión en 6to | ✅ 144 opciones existentes, **todas con `image_path` nulo** → se siguen pintando como texto. |
| Bucket `academia-imagenes` | ✅ existe, privado. |
| Funciones de visibilidad | ✅ `current_student_id`, `student_can_see_lesson`, `guardian_can_see_lesson`. |

### ⚠️ Lo que bloquea de verdad: no hay ni un solo login de estudiante

**`select count(*) from users_profiles where role='student'` → 0.**

O sea que hoy **nadie puede ver Academia**, ni en 1ro ni en 6to: el contenido
está cargado y publicado, pero no existe una sola cuenta capaz de abrirlo. Se
crean en `/dashboard/estudiantes/accesos`, uno por uno o por curso completo,
y se entregan impresos.

### Lo demás que hace falta

1. **`OPENROUTER_API_KEY`** para la voz. Sin ella los guiones se quedan en
   texto: no hay MP4.
2. **Subir los MP4 a YouTube como *no listados*** — `lessons.video_provider`
   solo acepta `youtube`/`vimeo`. Son 93 subidas a mano en el año. Si eso
   pesa demasiado, la alternativa es Cloudflare Stream, que necesita una
   migración aparte para aceptar MP4 propio.
3. **Subir las imágenes de las opciones** con `lib/subir-imagenes.mjs`
   (necesita `SUPABASE_SERVICE_ROLE_KEY`). Mientras no se suban, el
   cuestionario funciona igual: cada opción muestra su texto.
4. **Confirmar con la maestra de 1ro el orden de las unidades de
   Matemática**, que es lo único de este plan que no está anclado a una
   fuente (ver la nota al inicio de esa materia).

### Advertencia sobre el acceso, que no es un detalle

Un niño de 6 años no teclea un código de 7 caracteres ni una contraseña de
8. En la práctica quien va a abrir la lección es la madre o el padre desde
su teléfono — y hoy **el tutor no tiene ninguna vía**: `academia/page.tsx`
exige `profile.student_id`, y el tutor tiene `guardian_id`, así que le sale
"Tu cuenta todavía no está vinculada a un estudiante". La policy de base de
datos para tutores **ya existe** (`lessons_guardian_read_curso`), o sea que
falta el camino en la interfaz, no el permiso.

Queda anotado como la primera mejora a decidir cuando la tanda piloto esté
arriba, porque cambia quién puede usar esto de verdad en la casa.
