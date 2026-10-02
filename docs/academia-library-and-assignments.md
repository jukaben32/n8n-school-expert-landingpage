# Academia: biblioteca, tareas y entregas

## Flujo del profesor

Academia abre **Tareas asignadas**. La navegación también permite entrar a
**Biblioteca** y **Resultados**.

1. Añadir contenido guarda un video/cuestionario en la biblioteca del curso.
   Publicarlo lo deja disponible para el profesor: no crea una tarea y no avisa
   a las familias. Los próximos videos importados directamente a `lessons`
   también son biblioteca por defecto (`is_library=true`).
2. Biblioteca permite buscar por título, curso y materia, 30 contenidos por
   página. **Ver contenido** muestra el video y las preguntas; **Asignar como
   tarea** permite añadir instrucciones y fecha de entrega.
3. **Asignar tarea → Tarea manual** admite respuesta escrita en el portal o
   trabajo en cuaderno/revisión en clase. Las instrucciones pueden contener
   enlaces a material de apoyo. Esta versión no sube archivos de entrega.
4. La asignación se dirige a los alumnos inscritos en ese curso en ese momento.
   No se asigna a otras secciones salvo que compartan exactamente el mismo
   `grade_level`: el colegio usa ese texto como demarcación del curso. Si se
   necesita separar secciones deben tener cursos distintos en la ficha/horario.
5. El profesor abre una tarea para consultar cada entrega, dejar un comentario,
   marcarla revisada o devolver una respuesta escrita para corregir. En
   cuaderno, registra la revisión. La fecha de entrega informa; no bloquea
   entregas tardías ni el repaso.
6. Desactivar una asignación la retira de alumnos/familias y de los avisos sin
   borrar entregas. Reactivarla conserva los destinatarios y no duplica avisos.
   No hay reasignación automática a alumnos matriculados después; debe crearse
   otra asignación para incorporarlos.

## Alcance

- Primaria e Inicial: asignaciones administrativas vigentes de curso en
  `teacher_assignments` (categoría regular); materias del mismo colegio.
- Secundaria y niveles desconocidos: combinación exacta profesor/curso/materia
  registrada en `class_schedules`, administrada por Dirección. Una asignación
  de curso sin materia en el horario no concede acceso a todas las materias.
- Dirección/administración: su colegio; superadministrador: colegio activo.
- Profesor con vínculo familiar: sus pantallas de trabajo usan vistas
  `security_invoker` con filtro de ámbito docente. Su vista familiar conserva
  únicamente los hijos propios, aunque estudien fuera de su ámbito docente.
- Alumnos: asignaciones activas para las que figuran como destinatarios, con
  ficha vigente, curso/colegio actual y lección publicada. No acceden a los
  contenidos nuevos de la biblioteca sin asignación, ni a otras entregas.
- Tutores: consulta de asignaciones, resultados y respuestas de hijos
  vinculados. No entregan ni revisan actividades. Solo reconocen lectura de
  sus avisos.

Los predicados booleanos con SECURITY DEFINER tienen auth.uid, búsqueda vacía,
sin ejecución anónima y verificaciones de vínculo/colegio/curso. Las RPC de
entrega calculan estudiante y nota en el servidor; la revisión vuelve a
comprobar el ámbito del docente. No se confía en student_id ni puntajes del
navegador. El cuestionario sigue siendo formativo: las opciones correctas son
visibles en su API actual para el feedback pedagógico; no debe presentarse
como un examen de respuestas secretas.

## Alumno y familia

**Mis tareas** separa actividades abiertas y completadas/repaso. Hay video y
cuestionario, respuesta escrita o instrucciones para cuaderno. Una respuesta
escrita entregada queda pendiente de revisión; una devolución permite editar
y reenviar. Leer un aviso no entrega ni completa una tarea. Los resultados
del cuestionario se guardan atómicamente y un reintento de la misma asignación
no duplica nota/puntos. Una nueva asignación del mismo video es otra actividad.

Las tareas completadas siguen disponibles para ver nuevamente el video y
repasar el cuestionario mientras sigan activas. Los enlaces antiguos a
lecciones se conservan: resuelven una asignación autorizada del mismo contenido.

## Conservación y avisos

Las 79 lecciones ya publicadas se convierten en asignaciones históricas para
conservar las actividades visibles y sus resultados. No se envían avisos por
esa conversión. Los videos existentes también siguen en la biblioteca; las
tareas manuales nuevas no llenan el catálogo de videos.

El aviso familiar se crea al **asignar**, no al publicar en biblioteca. La
campana y el Portal Familiar muestran el vínculo de esa asignación. El
trabajador WhatsApp revalida asignación activa, destinatario, materia, curso y
vínculo familiar antes de enviar. Sigue pendiente EVOLUTION_API_URL y la
conexión/habilitación del WhatsApp del colegio; esta implementación no envió
mensajes reales ni activó una conexión desconectada.

## Verificación

- `scripts/verify-academia-assignments.mjs`: migración y regresión SQL dentro de
  BEGIN/ROLLBACK; usa actores reales sin conservar fixtures ni mensajes.
- `scripts/test-academia-assignments.sql`: publicación sin aviso, asignación y
  destinatarios, Primaria/curso, Secundaria/materia, doble rol, prohibición de
  puntajes falsos y duplicados, entregar/devolver/reenviar/revisar, cuaderno,
  familia de consulta y retirada de tareas.
- `scripts/test-family-academia-render.mjs`: rutas Next reales contra fixtures
  locales; biblioteca, asignación, revisión, alumno, familia y restricciones.
- `scripts/test-family-academia.mjs` y `scripts/test-academia-whatsapp.mjs`:
  alcance familiar y envío autorizado/duplicados/retirada, proveedor simulado.
- `scripts/smoke-roles.mjs`: regresiones generales de roles contra Supabase,
  nuevas consultas de asignaciones y entregas; escrituras con ROLLBACK.

Despliegue en dos pasos para conservar el reproductor anterior durante la
actualización de Vercel: `20261002030916_academia_library_assignments.sql`
prepara el esquema; `20261002035515_academia_finish_assignment_rollout.sql`
cierra la escritura del cliente anterior después de confirmar el despliegue.
Se aplican y registran de forma transaccional con
`scripts/apply-academia-assignments.mjs` y el mismo comando con argumento
`finish`, respectivamente. Una pestaña anterior debe recargarse tras la
actualización para usar el nuevo guardado de cuestionarios.
