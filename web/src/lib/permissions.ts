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
  | 'familias'
  | 'personal'
  | 'tesoreria' | 'pagos' | 'tesoreria_proveedores'
  | 'comunicados' | 'comunicados_nuevo'
  | 'mensajes_directos' // conversación privada de dos vías con una familia
  | 'asistencia' | 'asistencia_registrar'
  | 'reportes'
  | 'academia_gestionar' // crear lecciones + ver progreso
  | 'actualizaciones' // fotos cortas del día a día, por estudiante o por grado
  | 'whatsapp' // configuración del canal WhatsApp / Evolution API
  | 'website' // constructor del sitio público del colegio
  | 'configuracion_colegio'
  | 'asistente_ia' // ver conversaciones del asistente de IA con las familias

const FULL_ACCESS: Module[] = [
  'secretaria', 'estudiantes', 'estudiantes_nuevo', 'estudiantes_escaneos', 'familias', 'personal',
  'tesoreria', 'pagos', 'tesoreria_proveedores', 'comunicados', 'comunicados_nuevo', 'mensajes_directos',
  'asistencia', 'asistencia_registrar', 'reportes', 'academia_gestionar', 'actualizaciones',
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
  teacher: ['asistencia', 'asistencia_registrar', 'comunicados', 'comunicados_nuevo', 'mensajes_directos', 'academia_gestionar', 'actualizaciones'],

  // Recepción/Secretaría: la puerta de entrada -- estudiantes (ingresos y
  // salidas), familias, avisos, asistencia, mensajes directos con padres
  // (permisos, cartas de confirmación de estudio) y tesorería/pagos
  // (facturar, cobrar, validar comprobantes de transferencia). No incluye
  // 'tesoreria_proveedores' (facturas de proveedores/Alegra -- eso es
  // gestión contable, se queda en Finanzas) ni contenido de Academia.
  reception: ['estudiantes', 'estudiantes_nuevo', 'estudiantes_escaneos', 'familias', 'comunicados', 'comunicados_nuevo', 'mensajes_directos', 'asistencia', 'asistencia_registrar', 'tesoreria', 'pagos'],

  // Finanzas: dinero y a quién cobrarle -- tesorería, pagos, facturas de
  // proveedores/Alegra, reportes, y solo lectura de familias para
  // facturar. No toca estudiantes, asistencia, comunicados ni Academia.
  finance: ['tesoreria', 'pagos', 'tesoreria_proveedores', 'reportes', 'familias'],

  // Estos dos no usan este mapa (tienen sus propias páginas dedicadas:
  // portal-familiar y academia), se listan por completitud de tipos.
  guardian: [],
  student: [],
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
