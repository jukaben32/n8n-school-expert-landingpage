-- =========================================================================
-- Carga de la "Política de Confidencialidad, Protección del Menor y Ética
-- Laboral" (2026-09-23) para que todo el personal la firme desde
-- /dashboard/politicas. Requiere la migración 20260923000000_staff_policies.
--
-- Texto tomado del .docx del colegio, SIN el bloque final de "Compromiso de
-- aceptación y firma" (eso lo hace la pantalla de firma), y con las dos
-- líneas agregadas en 4.1 a pedido del colegio: la excepción de
-- MentorIApp → Actualizaciones y la tablet del colegio.
--
-- Idempotente: no la inserta dos veces. Alternativa sin SQL: publicarla
-- desde /dashboard/politicas/nueva pegando el mismo texto.
-- =========================================================================

insert into staff_policies (school_id, title, body)
select s.id, $politica$POLÍTICA DE CONFIDENCIALIDAD, PROTECCIÓN DEL MENOR Y ÉTICA LABORAL$politica$, $politica$Alcance: Todo el personal (Docentes, Administrativos, Personal de Apoyo y Directivos)

1. Objetivo

Garantizar el resguardo absoluto de la información institucional, pedagógica y personal que se maneja dentro del colegio, protegiendo el derecho a la intimidad de los alumnos, sus familias y el personal, asegurando un entorno escolar seguro, profesional y libre de filtraciones.

2. Confidencialidad Institucional y Manejo de Información

Secreto Profesional: Todo el personal queda obligado a mantener estricta reserva sobre los métodos de trabajo, decisiones internas, estrategias pedagógicas, actas de reuniones y cualquier situación administrativa del colegio. Esta información es de uso exclusivo para el ejercicio de sus funciones.

Prohibición de Uso Particular: Queda terminantemente prohibido utilizar información obtenida en el plano laboral para beneficio propio, de terceros o para ventilarla en círculos sociales, redes sociales o con particulares.

Información de los Alumnos: Los expedientes académicos, conductuales, psicológicos o médicos de los estudiantes son confidenciales. Ningún empleado está autorizado a discutir la situación de un alumno con personas ajenas a sus padres, tutores legales o el equipo directivo del centro.

3. Separación de lo Laboral y lo Personal (Vínculos Familiares y de Amistad)

El colegio reconoce que existen empleados que comparten lazos familiares, de pareja o de amistad fuera de la institución o con miembros de la comunidad escolar. Para mantener la armonía y evitar conflictos de interés, se establece que:

Límites Claros: Los asuntos laborales se discuten y resuelven exclusivamente dentro del colegio y a través de los canales oficiales. Está prohibido trasladar debates o tensiones laborales al ámbito personal/familiar.

Prevención de Consecuencias y Maltrato: Bajo ninguna circunstancia se permitirá que las relaciones personales influyan en el trato hacia compañeros o estudiantes. Filtrar información interna a familiares o relacionados con el fin de generar ventajas, favoritismos, hostigamiento o represalias laborales será considerado una falta muy grave.

4. Protección del Menor y Deber de Notificación (Cumplimiento de la Ley 136-03)

La confidencialidad encuentra su límite legal e indispensable cuando se trata de la seguridad física o emocional de un menor.

Signos de Maltrato o Violencia: Si un docente o cualquier empleado observa en un alumno signos físicos, conductuales o psicológicos que sugieran abuso, maltrato o violencia (intrafamiliar o externa), no debe callar ni ocultar la información bajo el argumento de la confidencialidad.

Protocolo de Actuación: El empleado tiene la obligación legal y moral de reportar la situación de inmediato a la Dirección del Colegio y al Departamento de Orientación/Psicología. La institución procederá de inmediato a realizar los informes de lugar ante las autoridades competentes (Tribunal de Niños, Niñas y Adolescentes / CONANI), de acuerdo con lo que establece la Ley 136-03.

4.1. Uso de Dispositivos Personales y Captura de Imágenes de Menores

Prohibición en Dispositivos Personales: Queda estrictamente prohibido a todo el personal docente, administrativo o de apoyo tomar fotografías, grabar videos o almacenar imágenes de los alumnos utilizando sus teléfonos celulares personales, tabletas o cualquier dispositivo propio, salvo autorización expresa y por escrito de la Dirección para un fin pedagógico específico.

Excepción: se exceptúan las fotos subidas a la plataforma oficial del colegio (MentorIApp → Actualizaciones), que no se almacenan en el dispositivo del docente.

Tablet del colegio: si para su labor necesita tomar fotografías o videos de los alumnos, puede solicitar la tablet del colegio.

Redes Sociales Personales: Ningún empleado está autorizado a publicar fotos, videos o información de los alumnos, ni de las actividades internas del colegio, en sus redes sociales personales (Facebook, Instagram, TikTok, Estados de WhatsApp, etc.).

Cuentas Institucionales: Las capturas de imágenes para las redes oficiales del colegio se realizarán exclusivamente con los dispositivos asignados por la institución o por el personal expresamente delegado por la Dirección, asegurando siempre que se mantenga el decoro y la dignidad del menor.

5. Régimen de Sanciones

La violación de cualquiera de los puntos de esta política (ya sea por filtración de información, uso indebido de datos de menores, o por permitir que relaciones personales afecten el entorno laboral) será considerada una falta grave a las obligaciones de lealtad y eficiencia. Esto facultará al colegio a aplicar las sanciones disciplinarias correspondientes, incluyendo la amonestación escrita, la suspensión o el Despido Justificado según el Código de Trabajo, sin perjuicio de las acciones civiles o penales que la ley dominicana establezca para la protección de menores.$politica$
from schools s
where s.name = 'Centro Educativo Gran Manantial de Sabiduría'
  and not exists (
    select 1 from staff_policies sp
    where sp.school_id = s.id and sp.title = $politica$POLÍTICA DE CONFIDENCIALIDAD, PROTECCIÓN DEL MENOR Y ÉTICA LABORAL$politica$
  );
