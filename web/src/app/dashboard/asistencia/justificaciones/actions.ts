'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { JUSTIFICATION_BUCKET, isHeic } from '@/lib/attendance/justifications'

/**
 * Lado colegio de la justificación de ausencias.
 *
 * Decisión de alcance, distinta al resto de bandejas de revisión de este
 * proyecto (comprobantes, fichas OCR, facturas de proveedores): aquí las
 * lecturas y los cambios de estado van con el cliente de SESIÓN, no con
 * service_role. El motivo es que quién puede revisar depende del grado
 * (un profesor solo ve las faltas de sus cursos) y esa regla ya está
 * escrita una vez, en la RLS -- repetirla en TypeScript sería una segunda
 * fuente de verdad de "quién ve qué", justo el patrón que en este proyecto
 * ya causó bugs silenciosos. El cliente admin se usa SOLO donde la RLS no
 * alcanza: el bucket privado y el correo al tutor.
 *
 * Contrapartida conocida: si una policy quedara mal, esto devuelve vacío en
 * vez de fallar. Por eso las escrituras confirman con `.select()` que de
 * verdad cambiaron una fila, y por eso hay comprobaciones nuevas en
 * scripts/smoke-roles.mjs.
 */

interface ActionResult {
  ok: boolean
  error?: string
}

async function resolveAttendanceStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'asistencia')) {
    return { ok: false as const, error: 'No tienes permiso para revisar justificaciones.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, supabase, staffProfileId: profile.id as string, schoolId }
}

export interface PendingJustification {
  id: string
  reason: string
  created_at: string
  has_document: boolean
  /** Foto de iPhone sin convertir: el navegador no la previsualiza, se descarga. */
  document_is_heic: boolean
  student_name: string
  grade_level: string | null
  absence_date: string
  absence_status: string
  subject_name: string | null
  guardian_name: string
}

/**
 * Las justificaciones pendientes que ESTE usuario puede revisar. La lista
 * de ids la decide la RLS (cliente de sesión); los nombres se completan
 * después con el cliente admin, porque `guardians` está cerrada para el rol
 * 'teacher' y con su propio cliente le llegarían vacíos -- el mismo fallo
 * silencioso que dejó al profesor sin lista de familias en Mensajes.
 */
export async function listPendingJustifications(): Promise<PendingJustification[]> {
  const staff = await resolveAttendanceStaff()
  if (!staff.ok) return []

  const { data: visibles } = await staff.supabase
    .from('attendance_justifications')
    .select('id')
    .eq('school_id', staff.schoolId)
    .eq('status', 'pendiente')

  const ids = (visibles ?? []).map((r: { id: string }) => r.id)
  if (ids.length === 0) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('attendance_justifications')
    .select(`
      id, reason, created_at, document_path, document_type,
      students(first_name, last_name, grade_level),
      guardians(first_name, last_name),
      attendance(date, status, subject:subjects(name))
    `)
    .in('id', ids)
    .order('created_at', { ascending: true })

  type Row = {
    id: string
    reason: string
    created_at: string
    document_path: string | null
    document_type: string | null
    students: { first_name: string; last_name: string; grade_level: string | null } | null
    guardians: { first_name: string; last_name: string } | null
    attendance: { date: string; status: string; subject: { name: string } | null } | null
  }

  return (((data ?? []) as unknown) as Row[]).map((r) => ({
    id: r.id,
    reason: r.reason,
    created_at: r.created_at,
    has_document: !!r.document_path,
    document_is_heic: isHeic(r.document_type),
    student_name: r.students ? `${r.students.first_name} ${r.students.last_name}` : 'Estudiante',
    grade_level: r.students?.grade_level ?? null,
    absence_date: r.attendance?.date ?? '',
    absence_status: r.attendance?.status ?? '',
    subject_name: r.attendance?.subject?.name ?? null,
    guardian_name: r.guardians ? `${r.guardians.first_name} ${r.guardians.last_name}` : 'Tutor',
  }))
}

/** Cuántas hay pendientes para el badge de la pantalla de Asistencia. */
export async function countPendingJustifications(): Promise<number> {
  const staff = await resolveAttendanceStaff()
  if (!staff.ok) return 0

  const { count } = await staff.supabase
    .from('attendance_justifications')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', staff.schoolId)
    .eq('status', 'pendiente')

  return count ?? 0
}

/**
 * URL firmada de 5 minutos. El bucket es privado y esto es un documento
 * médico de un menor -- nunca hay una URL pública.
 */
export async function getJustificationSignedUrl(justificationId: string): Promise<string | null> {
  const staff = await resolveAttendanceStaff()
  if (!staff.ok) return null

  // La visibilidad la decide la RLS con el cliente de sesión; solo después
  // se toca el bucket con service_role.
  const { data: visible } = await staff.supabase
    .from('attendance_justifications')
    .select('id, document_path')
    .eq('id', justificationId)
    .eq('school_id', staff.schoolId)
    .maybeSingle()

  if (!visible?.document_path) return null

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(JUSTIFICATION_BUCKET)
    .createSignedUrl(visible.document_path, 300)

  if (error || !data) return null
  return data.signedUrl
}

/**
 * Acepta o rechaza una justificación.
 *
 * Al ACEPTAR (y solo entonces) la fila de `attendance` pasa a
 * 'justificado'. Es 1 a 1 con el registro de asistencia: si el estudiante
 * quedó ausente en tres materias del mismo día, cada una se justifica
 * aparte -- se prefirió eso antes que "arreglar" en silencio filas que el
 * tutor no vio al enviar.
 */
export async function reviewJustification(
  justificationId: string,
  decision: 'aceptada' | 'rechazada',
  note: string,
): Promise<ActionResult> {
  const staff = await resolveAttendanceStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  if (decision !== 'aceptada' && decision !== 'rechazada') {
    return { ok: false, error: 'Decisión inválida.' }
  }

  const { data: justification } = await staff.supabase
    .from('attendance_justifications')
    .select('id, status, attendance_id, guardian_id, student_id')
    .eq('id', justificationId)
    .eq('school_id', staff.schoolId)
    .maybeSingle()

  if (!justification) return { ok: false, error: 'No se encontró la justificación.' }
  if (justification.status !== 'pendiente') {
    return { ok: false, error: 'Esta justificación ya fue revisada.' }
  }

  const { data: updated, error: updateError } = await staff.supabase
    .from('attendance_justifications')
    .update({
      status: decision,
      reviewed_by: staff.staffProfileId,
      reviewed_at: new Date().toISOString(),
      review_note: note.trim() || null,
    })
    .eq('id', justificationId)
    .eq('status', 'pendiente')
    .select('id')

  if (updateError) {
    return { ok: false, error: `No se pudo guardar la revisión: ${updateError.message}` }
  }
  if (!updated || updated.length === 0) {
    // Sin error y sin fila = la policy no dejó pasar la escritura (o
    // alguien más la revisó primero). No se puede fallar en silencio.
    return { ok: false, error: 'No se pudo guardar la revisión: no tienes permiso sobre esta falta, o ya fue revisada.' }
  }

  if (decision === 'aceptada') {
    const { error: attendanceError } = await staff.supabase
      .from('attendance')
      .update({ status: 'justificado' })
      .eq('id', justification.attendance_id)
      .eq('school_id', staff.schoolId)

    if (attendanceError) {
      return {
        ok: false,
        error: `La justificación quedó aceptada, pero no se pudo marcar la asistencia como justificada: ${attendanceError.message}`,
      }
    }
  }

  await avisarAlTutor(justification.guardian_id, justification.student_id, staff.schoolId, decision, note)

  revalidatePath('/dashboard/asistencia')
  revalidatePath('/dashboard/asistencia/justificaciones')
  return { ok: true }
}

/** Correo al tutor con el resultado. Best-effort: nunca tumba la revisión. */
async function avisarAlTutor(
  guardianId: string,
  studentId: string,
  schoolId: string,
  decision: 'aceptada' | 'rechazada',
  note: string,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const [{ data: guardian }, { data: student }, { data: school }] = await Promise.all([
      admin.from('guardians').select('first_name, email').eq('id', guardianId).maybeSingle(),
      admin.from('students').select('first_name, last_name').eq('id', studentId).maybeSingle(),
      admin.from('schools').select('name').eq('id', schoolId).maybeSingle(),
    ])

    if (!guardian?.email) return

    const nombreEstudiante = student ? `${student.first_name} ${student.last_name}` : 'su hijo/a'
    const resultado = decision === 'aceptada'
      ? `La justificación de la ausencia de ${nombreEstudiante} fue aceptada. La asistencia quedó marcada como justificada.`
      : `La justificación de la ausencia de ${nombreEstudiante} no fue aceptada.`

    await notifyGuardianByEmail({
      schoolName: school?.name ?? null,
      guardianEmail: guardian.email,
      subject: `Justificación de ausencia ${decision}`,
      body: note.trim() ? `${resultado}\n\nNota del colegio: ${note.trim()}` : resultado,
    })
  } catch (err) {
    console.error('[reviewJustification] aviso al tutor falló:', err)
  }
}
