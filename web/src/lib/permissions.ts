/**
 * Permisos por rol — MentorIApp
 *
 * Antes, cada página del dashboard definía su propio array de
 * "staffRoles" a mano, sin ninguna regla en común: un profesor podía
 * ver la lista completa de Familias o crear comunicados igual que un
 * director, y no había ninguna forma de saber si eso era intencional
 * o un descuido. Este archivo es la única fuente de verdad.
 *
 * NOTA: esto controla la experiencia (qué ve la persona, a dónde se
 * le redirige). Desde la migración 016, las políticas de RLS de
 * Supabase también están alineadas con esta misma matriz -- así que
 * esto ya no es solo una capa de interfaz, es la fuente de verdad de
 * ambos lados.
 */

export type Role =
  | 'super_admin' | 'school_admin' | 'director'
  | 'teacher' | 'finance' | 'reception'
  | 'guardian' | 'student'

export type Module =
  | 'secretaria'
  | 'estudiantes' | 'estudiantes_nuevo' | 'estudiantes_escaneos'
  | 'estudiantes_accesos' // crear el login de los estudiantes (código + contraseña impresa)
  | 'familias'
  | 'personal'
  | 'tesoreria' | 'pagos' | 'tesoreria_proveedores'
  | 'comunicados' | 'comunicados_nuevo'
  | 'agenda' | 'agenda_nuevo' // agenda digital: eventos del colegio (reuniones, feriados, evaluaciones...)
  | 'horarios' // ver el horario de clases (propio si es teacher, del colegio si es staff)
  | 'horarios_gestionar' // crear franjas horarias y asignar materia/profesor por grado
  | 'planificacion' // planificar clases -- profesor solo las suyas (RLS), admin ve todas
  | 'notas' // ver notas / boletines
  | 'notas_gestionar' // registrar notas -- profesor solo sus materias/grados (RLS), admin todas
  | 'autorizaciones' // ver autorizaciones (permisos firmados, ej. excursiones)
  | 'autorizaciones_nuevo' // crear autorizaciones nuevas
  | 'mensajes_directos' // conversación privada de dos vías con una familia
  | 'asistencia' | 'asistencia_registrar'
  | 'reportes'
  | 'academia' // vista del estudiante: sus lecciones, tareas y cuestionarios
  | 'academia_gestionar' // crear lecciones + ver progreso
  | 'actualizaciones' // fotos cortas del día a día, por estudiante o por grado
  | 'whatsapp' // configuración del canal WhatsApp / Evolution API
  | 'website' // constructor del sitio público del colegio
  | 'configuracion_colegio'
  | 'asistente_ia' // ver conversaciones del asistente de IA con las familias
  | 'encuestas' // ver encuestas/votaciones y operar la urna del propio curso (profesor)
  | 'encuestas_gestionar' // crear encuestas/votaciones, abrirlas y cerrarlas

const FULL_ACCESS: Module[] = [
  'secretaria', 'estudiantes', 'estudiantes_nuevo', 'estudiantes_escaneos', 'estudiantes_accesos', 'familias', 'personal',
  'tesoreria', 'pagos', 'tesoreria_proveedores', 'comunicados', 'comunicados_nuevo',
  'agenda', 'agenda_nuevo', 'mensajes_directos',
  'asistencia', 'asistencia_registrar', 'reportes', 'academia_gestionar', 'actualizaciones',
  'horarios', 'horarios_gestionar', 'planificacion', 'notas', 'notas_gestionar',
  'autorizaciones', 'autorizaciones_nuevo',
  'encuestas', 'encuestas_gestionar',
  'whatsapp',
  'website',
  'configuracion_colegio', 'asistente_ia',
]

/** Qué módulos puede ver/usar cada rol de staff. */
const ROLE_MODULES: Record<Role, Module[]> = {
  super_admin: FULL_ACCESS,
  school_admin: FULL_ACCESS,
  director: FULL_ACCESS,

  // Profesor: su salón de clases -- asistencia, academia, avisos.
  // No gestiona familias completas ni dinero.
  // 'encuestas' (sin '_gestionar'): el profesor carga los candidatos y
  // opera la urna de SU curso -- crear/abrir/cerrar la votación es de
  // dirección. El alcance por curso lo impone la RLS (can_run_poll).
  teacher: ['asistencia', 'asistencia_registrar', 'comunicados', 'comunicados_nuevo', 'agenda', 'agenda_nuevo', 'mensajes_directos', 'academia_gestionar', 'actualizaciones', 'horarios', 'planificacion', 'notas', 'notas_gestionar', 'autorizaciones', 'autorizaciones_nuevo', 'encuestas'],

  // Recepción/Secretaría: la puerta de entrada -- estudiantes (ingresos y
  // salidas), familias, avisos, agenda, asistencia, horarios, notas,
  // autorizaciones, mensajes directos con padres (permisos, cartas de
  // confirmación de estudio) y tesorería/pagos (facturar, cobrar, validar
  // comprobantes de transferencia). No incluye 'tesoreria_proveedores'
  // (facturas de proveedores/Alegra -- eso es gestión contable, se queda en
  // Finanzas) ni contenido de Academia.
  reception: ['estudiantes', 'estudiantes_nuevo', 'estudiantes_escaneos', 'estudiantes_accesos', 'familias', 'comunicados', 'comunicados_nuevo', 'agenda', 'agenda_nuevo', 'mensajes_directos', 'asistencia', 'asistencia_registrar', 'horarios', 'notas', 'autorizaciones', 'autorizaciones_nuevo', 'tesoreria', 'pagos'],

  // Finanzas: dinero y a quién cobrarle -- tesorería, pagos, facturas de
  // proveedores/Alegra, reportes, y solo lectura de familias para
  // facturar. No toca estudiantes, asistencia, comunicados ni Academia.
  finance: ['tesoreria', 'pagos', 'tesoreria_proveedores', 'reportes', 'familias'],

  // El tutor no usa este mapa: tiene su propia página dedicada
  // (portal-familiar). Se lista por completitud de tipos.
  guardian: [],

  // Estudiante: desde 2026-09-04 tiene login propio. Solo dos cosas --
  // Academia (sus lecciones, tareas y cuestionarios) y Encuestas, donde
  // vota en la junta directiva de SU curso y responde las encuestas
  // dirigidas a estudiantes. Qué votación le toca y que no pueda votar
  // dos veces lo impone la base de datos (student_can_see_poll +
  // cast_student_vote), no esta lista.
  student: ['academia', 'encuestas'],
}

/** ¿Puede este rol acceder a este módulo? */
export function canAccess(role: string | null | undefined, module: Module): boolean {
  if (!role) return false
  return (ROLE_MODULES[role as Role] ?? []).includes(module)
}

/** Lista de roles que pueden acceder a un módulo (útil para .includes() rápidos). */
export function rolesFor(module: Module): Role[] {
  return (Object.keys(ROLE_MODULES) as Role[]).filter((role) => ROLE_MODULES[role].includes(module))
}
