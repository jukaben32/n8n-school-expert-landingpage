import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Categoría de comunicación (Mensajes directos y Comunicados) -- ver
 * migraciones 034/035/036. 'regular' es el valor por defecto de siempre;
 * 'ingles'/'deporte' enrutan solo al equipo correspondiente.
 */
export type MessageCategory = 'regular' | 'ingles' | 'deporte'
export const MESSAGE_CATEGORIES: MessageCategory[] = ['regular', 'ingles', 'deporte']
export const MESSAGE_CATEGORY_LABELS: Record<MessageCategory, string> = {
  regular: 'Regular',
  ingles: 'Inglés',
  deporte: 'Deporte',
}

export function isMessageCategory(value: string): value is MessageCategory {
  return (MESSAGE_CATEGORIES as string[]).includes(value)
}

const FULL_ACCESS_ROLES = ['super_admin', 'school_admin', 'director']

/**
 * ¿Puede este miembro del staff leer/escribir la conversación de esta
 * familia en esta categoría?
 *
 * Replica en TypeScript la misma regla que la policy de RLS de
 * direct_conversations (migración 035) y la función SQL
 * staff_can_see_family_category() (migración 034) -- pero NO se puede
 * llamar a esa función vía RPC desde el cliente admin: es security
 * definer y depende de auth.uid(), que es null bajo service_role. Las
 * Server Actions de Mensajes directos (dashboard/mensajes/actions.ts)
 * usan el cliente admin para casi todo, así que la autorización real para
 * esos caminos tiene que vivir acá, no solo en la policy de RLS.
 */
export async function staffCanAccessFamilyCategory(
  admin: ReturnType<typeof createAdminClient>,
  params: { schoolId: string; role: string; staffId: string | null; familyId: string; category: MessageCategory }
): Promise<boolean> {
  const { schoolId, role, staffId, familyId, category } = params

  if (FULL_ACCESS_ROLES.includes(role)) return true
  if (category === 'regular') return role === 'teacher' || role === 'reception'
  if (role !== 'teacher' || !staffId) return false

  const { data: assignments } = await admin
    .from('teacher_assignments')
    .select('grade_level')
    .eq('school_id', schoolId)
    .eq('staff_id', staffId)
    .eq('category', category)

  const rows = assignments ?? []
  if (rows.length === 0) return false
  if (rows.some((r) => r.grade_level === null)) return true // "todo el colegio" para esta categoría

  const assignedGrades = rows.map((r) => r.grade_level as string)
  const { data: students } = await admin
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .in('grade_level', assignedGrades)

  return (students ?? []).length > 0
}

/**
 * Familias con las que este staff puede iniciar una conversación nueva en
 * esta categoría -- 'regular' sigue sin restricción (cualquier familia,
 * igual que siempre); 'ingles'/'deporte' solo familias con un hijo en un
 * grado asignado a este staff para esa categoría (o todas si tiene la
 * fila "todo el colegio"). Se usa para filtrar el selector de
 * StartConversationForm, no para autorizar lectura/escritura (eso es
 * staffCanAccessFamilyCategory).
 */
export async function getEligibleFamilyIdsForCategory(
  admin: ReturnType<typeof createAdminClient>,
  params: { schoolId: string; role: string; staffId: string | null; category: MessageCategory; allFamilyIds: string[] }
): Promise<Set<string>> {
  const { schoolId, role, staffId, category, allFamilyIds } = params

  if (FULL_ACCESS_ROLES.includes(role)) return new Set(allFamilyIds)
  if (category === 'regular') return role === 'teacher' || role === 'reception' ? new Set(allFamilyIds) : new Set()
  if (role !== 'teacher' || !staffId) return new Set()

  const { data: assignments } = await admin
    .from('teacher_assignments')
    .select('grade_level')
    .eq('school_id', schoolId)
    .eq('staff_id', staffId)
    .eq('category', category)

  const rows = assignments ?? []
  if (rows.length === 0) return new Set()
  if (rows.some((r) => r.grade_level === null)) return new Set(allFamilyIds)

  const assignedGrades = rows.map((r) => r.grade_level as string)
  const { data: students } = await admin
    .from('students')
    .select('family_id')
    .eq('school_id', schoolId)
    .in('grade_level', assignedGrades)
    .is('deleted_at', null)

  return new Set((students ?? []).map((s) => s.family_id as string))
}

/**
 * Categorías que este miembro del staff puede ver/usar en Mensajes
 * directos o Comunicados -- 'regular' siempre para teacher/reception,
 * 'ingles'/'deporte' solo si tiene alguna fila de teacher_assignments ahí.
 * Roles de acceso total ven las 3 siempre.
 */
export async function getStaffAvailableCategories(
  admin: ReturnType<typeof createAdminClient>,
  params: { schoolId: string; role: string; staffId: string | null }
): Promise<MessageCategory[]> {
  const { schoolId, role, staffId } = params

  if (FULL_ACCESS_ROLES.includes(role)) return [...MESSAGE_CATEGORIES]
  if (role === 'reception') return ['regular']
  if (role !== 'teacher') return []

  const categories = new Set<MessageCategory>(['regular'])
  if (staffId) {
    const { data: assignments } = await admin
      .from('teacher_assignments')
      .select('category')
      .eq('school_id', schoolId)
      .eq('staff_id', staffId)
      .neq('category', 'regular')
    for (const row of assignments ?? []) {
      const category = row.category as string
      if (isMessageCategory(category)) categories.add(category)
    }
  }
  return MESSAGE_CATEGORIES.filter((c) => categories.has(c))
}
