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

export interface CreateAuthorizationInput {
  title: string
  description: string
  eventDate: string
  gradeLevel: string // '' = todo el colegio
  isImageConsent: boolean
}

export async function createAuthorizationAction(input: CreateAuthorizationInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'autorizaciones_nuevo')) {
    return { ok: false, error: 'No tienes permiso para crear autorizaciones.' }
  }

  const title = input.title.trim()
  const description = input.description.trim()
  if (!title || !description) {
    return { ok: false, error: 'El título y la descripción (qué se autoriza) son obligatorios.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const gradeLevel = input.gradeLevel.trim() || null
  const admin = createAdminClient()

  // Mismo principio que Comunicados/Agenda: un profesor solo puede pedir
  // autorización a sus grados/secciones asignados, nunca a todo el colegio.
  if (profile.role === 'teacher') {
    if (!gradeLevel) {
      return { ok: false, error: 'Un profesor solo puede pedir autorizaciones para su grado/sección asignado, no para todo el colegio.' }
    }
    if (!profile.staff_id) return { ok: false, error: 'No se encontró tu ficha de personal.' }
    const { data: assigned } = await admin
      .from('teacher_assignments')
      .select('grade_level')
      .eq('staff_id', profile.staff_id)
      .eq('school_id', schoolId)
      .eq('grade_level', gradeLevel)
      .maybeSingle()
    if (!assigned) return { ok: false, error: 'Solo puedes pedir autorizaciones para tus grados/secciones asignados.' }
  }

  const { data: created, error } = await admin
    .from('authorization_requests')
    .insert({
      school_id: schoolId,
      title,
      description,
      event_date: input.eventDate || null,
      grade_level: gradeLevel,
      created_by: profile.id,
      is_image_consent: input.isImageConsent,
    })
    .select('id')
    .single()
  if (error || !created) return { ok: false, error: 'No se pudo crear la autorización.' }

  revalidatePath('/dashboard/autorizaciones')
  return { ok: true }
}

export interface RespondAuthorizationInput {
  authorizationRequestId: string
  studentId: string
  decision: 'autorizado' | 'no_autorizado'
  signerFullName: string
  password: string
}

/**
 * Registra la respuesta de un tutor a una autorización -- exige
 * reintroducir su contraseña como paso extra antes de aceptar la firma
 * (mismo principio que un banco pidiendo el PIN antes de una
 * transferencia, aunque ya estés dentro de la app): mitiga que alguien
 * que tomó el teléfono ya desbloqueado del padre/madre (ej. un hijo)
 * pueda firmar en su nombre sin saber la contraseña real.
 */
export async function respondAuthorizationAction(input: RespondAuthorizationInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('guardian_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile?.guardian_id) return { ok: false, error: 'Solo disponible para tutores/padres de familia.' }

  const signerFullName = input.signerFullName.trim()
  if (!signerFullName) return { ok: false, error: 'Escribe tu nombre completo para confirmar.' }
  if (!input.password) return { ok: false, error: 'Vuelve a escribir tu contraseña para confirmar la firma.' }

  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: input.password })
  if (reauthError) return { ok: false, error: 'Contraseña incorrecta. Vuelve a intentarlo.' }

  // Con el cliente normal (sujeto a RLS) a propósito: la política
  // authorization_responses_guardian_own es la que de verdad garantiza
  // que este tutor solo puede firmar por sus propios hijos.
  const { error } = await supabase.from('authorization_responses').upsert(
    {
      authorization_request_id: input.authorizationRequestId,
      student_id: input.studentId,
      guardian_id: profile.guardian_id,
      decision: input.decision,
      signer_full_name: signerFullName,
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'authorization_request_id,student_id' }
  )
  if (error) return { ok: false, error: 'No se pudo registrar tu respuesta. Verifica que este estudiante sea tuyo.' }

  revalidatePath('/dashboard/autorizaciones')
  return { ok: true }
}

/**
 * Manda un correo recordatorio a los tutores que todavía no han
 * respondido esta autorización. Best-effort por cada uno -- si uno falla
 * no bloquea a los demás.
 */
export async function sendReminderAction(authorizationRequestId: string): Promise<ActionResult & { sent?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'autorizaciones')) {
    return { ok: false, error: 'No tienes permiso para esto.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  const { data: request } = await admin
    .from('authorization_requests')
    .select('id, title, grade_level, school_id')
    .eq('id', authorizationRequestId)
    .eq('school_id', schoolId)
    .single()
  if (!request) return { ok: false, error: 'No se encontró la autorización.' }

  const { data: school } = await admin.from('schools').select('name').eq('id', schoolId).single()

  const studentsQuery = admin
    .from('students')
    .select('id, first_name, last_name, family_id')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
  const { data: studentsRaw } = request.grade_level
    ? await studentsQuery.eq('grade_level', request.grade_level)
    : await studentsQuery

  const { data: responsesRaw } = await admin
    .from('authorization_responses')
    .select('student_id')
    .eq('authorization_request_id', authorizationRequestId)
  const respondedIds = new Set((responsesRaw ?? []).map((r) => r.student_id as string))

  const pendingStudents = (studentsRaw ?? []).filter((s) => !respondedIds.has(s.id))
  const pendingFamilyIds = Array.from(new Set(pendingStudents.map((s) => s.family_id as string)))
  if (pendingFamilyIds.length === 0) return { ok: true, sent: 0 }

  const { data: guardiansRaw } = await admin
    .from('guardians')
    .select('family_id, email, is_primary')
    .in('family_id', pendingFamilyIds)
    .order('is_primary', { ascending: false })
  const emailByFamily = new Map<string, string>()
  for (const g of guardiansRaw ?? []) {
    if (g.email && !emailByFamily.has(g.family_id as string)) emailByFamily.set(g.family_id as string, g.email as string)
  }

  let sent = 0
  await Promise.all(
    Array.from(emailByFamily.values()).map(async (email) => {
      await notifyGuardianByEmail({
        schoolName: school?.name ?? null,
        guardianEmail: email,
        subject: `Recordatorio: autorización pendiente — ${request.title}`,
        body: `Todavía no hemos recibido tu respuesta a la autorización "${request.title}". Por favor entra al Portal Familiar para autorizar o no autorizar antes de la fecha del evento.`,
      })
      sent += 1
    })
  )

  return { ok: true, sent }
}
