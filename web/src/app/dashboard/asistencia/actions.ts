'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveGuardianIdentity } from '@/lib/auth/resolveGuardianIdentity'
import {
  ALLOWED_JUSTIFICATION_TYPES,
  JUSTIFIABLE_ATTENDANCE_STATUSES,
  JUSTIFICATION_BUCKET,
  MAX_JUSTIFICATION_BYTES,
  extensionForType,
  resolveFileType,
  type JustifiableAbsence,
  type JustificationStatus,
} from '@/lib/attendance/justifications'

/**
 * Lado familia de la justificación de ausencias.
 *
 * Mismo principio que el resto de Portal Familiar: la sesión se resuelve
 * UNA sola vez (resolveGuardianIdentity) y a partir de ahí se filtra
 * explícitamente por los hijos de ese tutor en cada consulta -- no se
 * depende solo de la RLS para el aislamiento entre familias.
 */

interface ActionResult {
  ok: boolean
  error?: string
}

const DIAS_VISIBLES = 30

/** Los ids de los hijos vinculados a este tutor. */
async function studentIdsOf(guardianId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('student_guardians')
    .select('student_id')
    .eq('guardian_id', guardianId)

  return (data ?? []).map((r: { student_id: string }) => r.student_id)
}

/**
 * Las faltas de los hijos de este tutor en los últimos 30 días (la misma
 * ventana que ya muestra la pantalla de Asistencia), cada una con el estado
 * de su justificación si ya mandó una.
 */
export async function listMyAbsences(): Promise<JustifiableAbsence[]> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return []

  const studentIds = await studentIdsOf(identity.guardianId)
  if (studentIds.length === 0) return []

  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_VISIBLES)

  const admin = createAdminClient()
  const { data: records } = await admin
    .from('attendance')
    .select('id, date, status, student:students(first_name, last_name), subject:subjects(name)')
    .eq('school_id', identity.schoolId)
    .in('student_id', studentIds)
    .in('status', JUSTIFIABLE_ATTENDANCE_STATUSES)
    .gte('date', desde.toISOString().split('T')[0])
    .order('date', { ascending: false })

  type RecordShape = {
    id: string
    date: string
    status: string
    student: { first_name: string; last_name: string } | null
    subject: { name: string } | null
  }
  const rows = ((records ?? []) as unknown) as RecordShape[]
  if (rows.length === 0) return []

  const { data: justifications } = await admin
    .from('attendance_justifications')
    .select('id, attendance_id, status, reason, document_path, review_note, created_at')
    .in('attendance_id', rows.map((r) => r.id))
    .order('created_at', { ascending: false })

  type JustificationShape = {
    id: string
    attendance_id: string
    status: JustificationStatus
    reason: string
    document_path: string | null
    review_note: string | null
    created_at: string
  }

  // La más reciente por falta: una rechazada puede tener una nueva encima.
  const porFalta = new Map<string, JustificationShape>()
  for (const j of ((justifications ?? []) as unknown) as JustificationShape[]) {
    if (!porFalta.has(j.attendance_id)) porFalta.set(j.attendance_id, j)
  }

  return rows.map((r) => {
    const j = porFalta.get(r.id)
    return {
      attendanceId: r.id,
      date: r.date,
      status: r.status,
      studentName: r.student ? `${r.student.first_name} ${r.student.last_name}` : 'Estudiante',
      subjectName: r.subject?.name ?? null,
      justification: j
        ? {
            id: j.id,
            status: j.status,
            reason: j.reason,
            hasDocument: !!j.document_path,
            reviewNote: j.review_note,
            createdAt: j.created_at,
          }
        : null,
    }
  })
}

/** Cuántas faltas siguen sin una justificación viva (para el aviso del Portal). */
export async function countAbsencesToJustify(): Promise<number> {
  const absences = await listMyAbsences()
  return absences.filter((a) => !a.justification || a.justification.status === 'rechazada').length
}

/**
 * El tutor justifica una falta. Esto NUNCA cambia el estado de la
 * asistencia -- solo crea el registro 'pendiente' para que el colegio lo
 * revise (mismo criterio que uploadPaymentReceipt: la palabra de la
 * familia no mueve el dato oficial por sí sola).
 */
export async function submitAbsenceJustification(formData: FormData): Promise<ActionResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const attendanceId = formData.get('attendanceId')
  const reasonRaw = formData.get('reason')
  const file = formData.get('file')

  if (typeof attendanceId !== 'string' || !attendanceId) {
    return { ok: false, error: 'Falta indicar de qué falta se trata.' }
  }
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : ''
  if (reason.length < 3) {
    return { ok: false, error: 'Escribe el motivo de la ausencia.' }
  }
  if (reason.length > 1000) {
    return { ok: false, error: 'El motivo es demasiado largo (máximo 1000 caracteres).' }
  }

  // El archivo es OPCIONAL: muchas justificaciones son de una línea. Un
  // <input type="file"> vacío llega como un File de 0 bytes, no como null.
  const hasFile = file instanceof File && file.size > 0
  // El iPhone a veces manda el archivo sin tipo MIME: se deduce por la
  // extensión antes de validar, si no se rechazaría una foto válida.
  const fileType = hasFile ? resolveFileType(file.name, file.type) : ''
  if (hasFile) {
    if (file.size > MAX_JUSTIFICATION_BYTES) {
      return { ok: false, error: 'El archivo es demasiado grande (máximo 10MB).' }
    }
    if (!ALLOWED_JUSTIFICATION_TYPES.includes(fileType)) {
      return { ok: false, error: 'Solo se aceptan fotos (JPG/PNG/WEBP/HEIC) o PDF.' }
    }
  }

  const admin = createAdminClient()

  // Filtrado explícito: la falta tiene que ser de un hijo de ESTE tutor y de
  // este colegio -- no se confía en el attendanceId que manda el navegador.
  const studentIds = await studentIdsOf(identity.guardianId)
  if (studentIds.length === 0) {
    return { ok: false, error: 'No hay estudiantes vinculados a tu cuenta.' }
  }

  const { data: attendance } = await admin
    .from('attendance')
    .select('id, student_id, status')
    .eq('id', attendanceId)
    .eq('school_id', identity.schoolId)
    .in('student_id', studentIds)
    .maybeSingle()

  if (!attendance) return { ok: false, error: 'No se encontró esa falta.' }
  if (!JUSTIFIABLE_ATTENDANCE_STATUSES.includes(attendance.status)) {
    return { ok: false, error: 'Esta asistencia ya no necesita justificación.' }
  }

  const { data: viva } = await admin
    .from('attendance_justifications')
    .select('id, status')
    .eq('attendance_id', attendanceId)
    .neq('status', 'rechazada')
    .maybeSingle()

  if (viva) {
    return {
      ok: false,
      error: viva.status === 'pendiente'
        ? 'Ya enviaste una justificación para esta falta; el colegio la está revisando.'
        : 'Esta falta ya fue justificada.',
    }
  }

  const justificationId = crypto.randomUUID()
  let documentPath: string | null = null
  let documentType: string | null = null

  if (hasFile) {
    const path = `${identity.schoolId}/${identity.familyId}/${justificationId}.${extensionForType(fileType)}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from(JUSTIFICATION_BUCKET)
      .upload(path, buffer, { contentType: fileType, upsert: false })

    if (uploadError) {
      return { ok: false, error: `No se pudo subir el documento: ${uploadError.message}` }
    }
    documentPath = path
    documentType = fileType
  }

  const { error: insertError } = await admin.from('attendance_justifications').insert({
    id: justificationId,
    school_id: identity.schoolId,
    attendance_id: attendanceId,
    student_id: attendance.student_id,
    family_id: identity.familyId,
    guardian_id: identity.guardianId,
    reason,
    document_path: documentPath,
    document_type: documentType,
    status: 'pendiente',
  })

  if (insertError) {
    // El archivo ya se subió -- se limpia para no dejarlo huérfano.
    if (documentPath) await admin.storage.from(JUSTIFICATION_BUCKET).remove([documentPath])
    // 23505 = el índice único que impide dos justificaciones vivas por
    // falta (dos pestañas abiertas, doble clic...).
    if (insertError.code === '23505') {
      return { ok: false, error: 'Ya hay una justificación enviada para esta falta.' }
    }
    return { ok: false, error: `No se pudo enviar la justificación: ${insertError.message}` }
  }

  revalidatePath('/dashboard/asistencia')
  revalidatePath('/dashboard/portal-familiar')
  return { ok: true }
}
