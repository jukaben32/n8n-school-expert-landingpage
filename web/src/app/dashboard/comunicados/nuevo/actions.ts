'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { MESSAGE_CATEGORIES, type MessageCategory } from '@/lib/messaging/categoryAccess'

interface ActionResult {
  ok: boolean
  error?: string
}

const FULL_ACCESS_ROLES = ['super_admin', 'school_admin', 'director']

export interface CreateMessageInput {
  title: string
  body: string
  priority: 'normal' | 'urgent'
  publish: boolean
  /** Grados/secciones elegidos (students.grade_level) -- vacío = todo el colegio. */
  gradeLevels: string[]
  /** Regular / Inglés / Deporte (ver migración 036) -- clasifica el comunicado, no restringe quién lo lee. */
  category: MessageCategory
}

// Resuelve grados/secciones elegidos -> family_id de sus estudiantes activos,
// y guarda el comunicado como audience_type='family' (mismo tipo ya
// soportado desde la migración 002). audience_label queda como texto
// legible para mostrar "Para: Kinder A" en la tarjeta del comunicado.
export async function createMessageAction(input: CreateMessageInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'comunicados_nuevo')) {
    return { ok: false, error: 'No tienes permiso para crear comunicados.' }
  }

  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) {
    return { ok: false, error: 'El título y el contenido son obligatorios.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  const category = input.category
  if (!MESSAGE_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Categoría inválida.' }
  }

  const selectedGrades = Array.from(new Set(input.gradeLevels.map((g) => g.trim()).filter(Boolean)))

  // RLS ya restringe lo que un 'teacher' puede LEER de otros grados, pero
  // este insert va con el cliente admin (bypassa RLS) -- así que la regla
  // "solo tu grado, nunca todo el colegio" y "solo tu categoría" se
  // validan aquí de verdad.
  if (!FULL_ACCESS_ROLES.includes(profile.role)) {
    if (profile.role !== 'teacher' && !(profile.role === 'reception' && category === 'regular')) {
      return { ok: false, error: 'No tienes permiso para publicar en esta categoría.' }
    }
    if (profile.role === 'teacher') {
      if (selectedGrades.length === 0) {
        return { ok: false, error: 'Un profesor solo puede dirigir comunicados a su grado/sección asignado, no a todo el colegio.' }
      }
      if (!profile.staff_id) {
        return { ok: false, error: 'No se encontró tu ficha de personal.' }
      }
      const { data: assigned } = await admin
        .from('teacher_assignments')
        .select('grade_level')
        .eq('staff_id', profile.staff_id)
        .eq('school_id', schoolId)
        .eq('category', category)
      const assignedRows = assigned ?? []
      if (assignedRows.length === 0) {
        return { ok: false, error: 'No tienes ningún grado/sección asignado en esta categoría.' }
      }
      const wholeSchool = assignedRows.some((a) => a.grade_level === null)
      if (!wholeSchool) {
        const assignedSet = new Set(assignedRows.map((a) => a.grade_level as string))
        if (selectedGrades.some((g) => !assignedSet.has(g))) {
          return { ok: false, error: 'Solo puedes dirigir comunicados a tus grados/secciones asignados en esta categoría.' }
        }
      }
    }
  }

  let audienceType: 'all' | 'family' = 'all'
  let audienceIds: string[] | null = null
  let audienceLabel: string | null = null

  if (selectedGrades.length > 0) {
    const { data: students, error: studentsError } = await admin
      .from('students')
      .select('family_id')
      .eq('school_id', schoolId)
      .in('grade_level', selectedGrades)
      .is('deleted_at', null)
    if (studentsError) {
      return { ok: false, error: 'No se pudo resolver el grado/sección seleccionado.' }
    }

    const familyIds = Array.from(new Set((students ?? []).map((s) => s.family_id as string)))
    if (familyIds.length === 0) {
      return { ok: false, error: 'No hay estudiantes activos en el grado/sección seleccionado.' }
    }

    audienceType = 'family'
    audienceIds = familyIds
    audienceLabel = selectedGrades.join(', ')
  }

  const { error: insertError } = await admin.from('messages').insert({
    school_id: schoolId,
    author_id: profile.id,
    title,
    body,
    audience_type: audienceType,
    audience_ids: audienceIds,
    audience_label: audienceLabel,
    priority: input.priority,
    category,
    published_at: input.publish ? new Date().toISOString() : null,
  })
  if (insertError) {
    return { ok: false, error: 'No se pudo guardar el comunicado. Intenta de nuevo.' }
  }

  revalidatePath('/dashboard/comunicados')
  return { ok: true }
}
