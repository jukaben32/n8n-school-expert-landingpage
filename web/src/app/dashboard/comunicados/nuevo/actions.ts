'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface ActionResult {
  ok: boolean
  error?: string
}

export interface CreateMessageInput {
  title: string
  body: string
  priority: 'normal' | 'urgent'
  publish: boolean
  /** Grados/secciones elegidos (students.grade_level) -- vacío = todo el colegio. */
  gradeLevels: string[]
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
    .select('id, role, school_id')
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

  let audienceType: 'all' | 'family' = 'all'
  let audienceIds: string[] | null = null
  let audienceLabel: string | null = null

  const selectedGrades = Array.from(new Set(input.gradeLevels.map((g) => g.trim()).filter(Boolean)))
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
    published_at: input.publish ? new Date().toISOString() : null,
  })
  if (insertError) {
    return { ok: false, error: 'No se pudo guardar el comunicado. Intenta de nuevo.' }
  }

  revalidatePath('/dashboard/comunicados')
  return { ok: true }
}
