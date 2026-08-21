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

export interface CreateEventInput {
  title: string
  description: string
  eventDate: string
  startTime: string
  endTime: string
  location: string
  category: string
  gradeLevel: string // '' = todo el colegio
}

const VALID_CATEGORIES = ['general', 'academico', 'feriado', 'reunion', 'extracurricular', 'evaluacion']

export async function createEventAction(input: CreateEventInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'agenda_nuevo')) {
    return { ok: false, error: 'No tienes permiso para crear eventos.' }
  }

  const title = input.title.trim()
  if (!title) return { ok: false, error: 'El título es obligatorio.' }
  if (!input.eventDate) return { ok: false, error: 'La fecha es obligatoria.' }
  if (!VALID_CATEGORIES.includes(input.category)) return { ok: false, error: 'Categoría inválida.' }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()
  const gradeLevel = input.gradeLevel.trim() || null

  // Mismo principio que Comunicados: un profesor solo puede dirigir
  // eventos a su(s) grado(s) asignado(s), nunca a todo el colegio.
  if (profile.role === 'teacher') {
    if (!gradeLevel) {
      return { ok: false, error: 'Un profesor solo puede crear eventos para su grado/sección asignado, no para todo el colegio.' }
    }
    if (!profile.staff_id) return { ok: false, error: 'No se encontró tu ficha de personal.' }
    const { data: assigned } = await admin
      .from('teacher_assignments')
      .select('grade_level')
      .eq('staff_id', profile.staff_id)
      .eq('school_id', schoolId)
      .eq('grade_level', gradeLevel)
      .maybeSingle()
    if (!assigned) return { ok: false, error: 'Solo puedes crear eventos para tus grados/secciones asignados.' }
  }

  const { error: insertError } = await admin.from('calendar_events').insert({
    school_id: schoolId,
    author_profile_id: profile.id,
    title,
    description: input.description.trim() || null,
    event_date: input.eventDate,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    location: input.location.trim() || null,
    category: input.category,
    grade_level: gradeLevel,
  })
  if (insertError) return { ok: false, error: 'No se pudo guardar el evento. Intenta de nuevo.' }

  revalidatePath('/dashboard/agenda')
  return { ok: true }
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'agenda_nuevo')) {
    return { ok: false, error: 'No tienes permiso para borrar eventos.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('calendar_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('school_id', schoolId)
  if (error) return { ok: false, error: 'No se pudo borrar el evento.' }

  revalidatePath('/dashboard/agenda')
  return { ok: true }
}
