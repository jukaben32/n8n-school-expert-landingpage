/**
 * Permisos por rol — SchoolOS
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
  | 'tesoreria' | 'pagos'
  | 'comunicados' | 'comunicados_nuevo'
  | 'asistencia' | 'asistencia_registrar'
  | 'reportes'
  | 'academia_gestionar' // crear lecciones + ver progreso
  | 'configuracion_colegio'

const FULL_ACCESS: Module[] = [
  'secretaria', 'estudiantes', 'estudiantes_nuevo', 'estudiantes_escaneos', 'familias', 'personal',
  'tesoreria', 'pagos', 'comunicados', 'comunicados_nuevo',
  'asistencia', 'asistencia_registrar', 'reportes', 'academia_gestionar',
  'configuracion_colegio',
]

/** Qué módulos puede ver/usar cada rol de staff. */
const ROLE_MODULES: Record<Role, Module[]> = {
  super_admin: FULL_ACCESS,
  school_admin: FULL_ACCESS,
  director: FULL_ACCESS,

  // Profesor: su salón de clases -- asistencia, academia, avisos.
  // No gestiona familias completas ni dinero.
  teacher: ['asistencia', 'asistencia_registrar', 'comunicados', 'comunicados_nuevo', 'academia_gestionar'],

  // Recepción: la puerta de entrada -- estudiantes, familias, avisos,
  // asistencia. No maneja tesorería ni contenido de Academia.
  reception: ['estudiantes', 'estudiantes_nuevo', 'estudiantes_escaneos', 'familias', 'comunicados', 'comunicados_nuevo', 'asistencia', 'asistencia_registrar'],

  // Finanzas: dinero y a quién cobrarle -- tesorería, pagos, reportes,
  // y solo lectura de familias para facturar. No toca estudiantes,
  // asistencia, comunicados ni Academia.
  finance: ['tesoreria', 'pagos', 'reportes', 'familias'],

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
