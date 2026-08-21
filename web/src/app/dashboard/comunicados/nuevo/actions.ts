'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'

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

  const selectedGrades = Array.from(new Set(input.gradeLevels.map((g) => g.trim()).filter(Boolean)))

  // RLS ya restringe lo que un 'teacher' puede LEER de otros grados, pero
  // este insert va con el cliente admin (bypassa RLS) -- así que la regla
  // "solo tu grado, nunca todo el colegio" se valida aquí de verdad.
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
      .in('grade_level', selectedGrades)
    const assignedSet = new Set((assigned ?? []).map((a) => a.grade_level as string))
    if (selectedGrades.some((g) => !assignedSet.has(g))) {
      return { ok: false, error: 'Solo puedes dirigir comunicados a tus grados/secciones asignados.' }
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
    published_at: input.publish ? new Date().toISOString() : null,
  })
  if (insertError) {
    return { ok: false, error: 'No se pudo guardar el comunicado. Intenta de nuevo.' }
  }

  // Comunicado urgente y publicado ya (no borrador) -- avisa por correo a
  // un tutor por familia (el principal si tiene, si no el primero con
  // correo registrado). Best-effort, nunca falla la publicación.
  if (input.publish && input.priority === 'urgent') {
    await notifyUrgentMessage({ admin, schoolId, audienceType, audienceIds, title, body })
  }

  revalidatePath('/dashboard/comunicados')
  return { ok: true }
}

async function notifyUrgentMessage({
  admin,
  schoolId,
  audienceType,
  audienceIds,
  title,
  body,
}: {
  admin: ReturnType<typeof createAdminClient>
  schoolId: string
  audienceType: 'all' | 'family'
  audienceIds: string[] | null
  title: string
  body: string
}): Promise<void> {
  const [{ data: school }, { data: guardians }] = await Promise.all([
    admin.from('schools').select('name').eq('id', schoolId).single(),
    audienceType === 'family' && audienceIds
      ? admin.from('guardians').select('family_id, email, is_primary').in('family_id', audienceIds).order('is_primary', { ascending: false })
      : admin.from('guardians').select('family_id, email, is_primary').eq('school_id', schoolId).order('is_primary', { ascending: false }),
  ])

  // Un tutor por familia -- como ya viene ordenado is_primary primero, el
  // primer email que aparezca por cada family_id es el principal.
  const emailByFamily = new Map<string, string>()
  for (const g of guardians ?? []) {
    if (g.email && !emailByFamily.has(g.family_id)) emailByFamily.set(g.family_id, g.email)
  }

  await Promise.all(
    Array.from(emailByFamily.values()).map((email) =>
      notifyGuardianByEmail({
        schoolName: school?.name ?? null,
        guardianEmail: email,
        subject: `Aviso urgente: ${title}`,
        body,
      })
    )
  )
}
