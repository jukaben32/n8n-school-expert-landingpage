'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveGuardianIdentity } from '@/lib/auth/resolveGuardianIdentity'
import { schoolDateString } from '@/lib/schoolDate'
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
    .gte('date', schoolDateString(desde))
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

type GuardianOk = { schoolId: string; familyId: string; guardianId: string }

type AbsenceCheck =
  | { ok: true; studentId: string }
  | { ok: false; error: string }

/**
 * ¿Esta falta es de un hijo de ESTE tutor y todavía se puede justificar?
 *
 * Filtrado explícito: no se confía en el attendanceId que manda el
 * navegador. La usan los dos pasos (preparar la subida y enviar), así nadie
 * recibe un enlace de subida para una falta que no es suya o que ya tiene
 * una justificación en revisión.
 */
async function checkJustifiableAbsence(identity: GuardianOk, attendanceId: unknown): Promise<AbsenceCheck> {
  if (typeof attendanceId !== 'string' || !attendanceId) {
    return { ok: false, error: 'Falta indicar de qué falta se trata.' }
  }

  const studentIds = await studentIdsOf(identity.guardianId)
  if (studentIds.length === 0) {
    return { ok: false, error: 'No hay estudiantes vinculados a tu cuenta.' }
  }

  const admin = createAdminClient()
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

  return { ok: true, studentId: attendance.student_id as string }
}

/**
 * Paso 1 (solo si el tutor adjunta un documento): devuelve un enlace firmado
 * de subida de un solo uso. El navegador sube la foto DIRECTO a Storage.
 *
 * Por qué así y no mandando el archivo dentro de la Server Action: las
 * Server Actions de Next cortan el cuerpo en 1 MB y Vercel en ~4.5 MB. Una
 * foto del celular pesa 2-5 MB, así que la acción reventaba y el tutor veía
 * "Algo salió mal" sin poder enviar nada (queja real del 2026-10-07: un papá
 * pasó dos días intentando subir el certificado médico de su hijo). Mismo
 * patrón que la solicitud de empleo (prepareJobApplicationUpload).
 */
export async function prepareJustificationUpload(input: {
  attendanceId: string
  fileName: string
  fileType: string
  size: number
}): Promise<{ ok: boolean; error?: string; path?: string; token?: string; contentType?: string }> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const fileName = typeof input?.fileName === 'string' ? input.fileName : ''
  const size = typeof input?.size === 'number' ? input.size : 0
  // El iPhone a veces manda el archivo sin tipo MIME: se deduce por la
  // extensión antes de validar, si no se rechazaría una foto válida.
  const fileType = resolveFileType(fileName, typeof input?.fileType === 'string' ? input.fileType : '')

  if (size <= 0) return { ok: false, error: 'El archivo está vacío. Vuelve a elegirlo.' }
  if (size > MAX_JUSTIFICATION_BYTES) {
    return { ok: false, error: 'El archivo es demasiado grande (máximo 10MB).' }
  }
  if (!ALLOWED_JUSTIFICATION_TYPES.includes(fileType)) {
    return { ok: false, error: 'Solo se aceptan fotos (JPG/PNG/WEBP/HEIC) o PDF.' }
  }

  const check = await checkJustifiableAbsence(identity, input?.attendanceId)
  if (!check.ok) return { ok: false, error: check.error }

  // Carpeta por colegio/familia: en el paso 2 se exige que la ruta esté
  // dentro de la carpeta de ESTA familia.
  const path = `${identity.schoolId}/${identity.familyId}/${crypto.randomUUID()}.${extensionForType(fileType)}`
  const { data, error } = await createAdminClient().storage
    .from(JUSTIFICATION_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[justificación] no se pudo crear el enlace de subida', error)
    return { ok: false, error: 'No se pudo preparar la subida del documento. Intenta de nuevo.' }
  }
  return { ok: true, path: data.path, token: data.token, contentType: fileType }
}

type UploadedDocument =
  | { ok: true; documentType: string }
  | { ok: false; error: string }

/**
 * Comprueba la ruta que manda el navegador en el paso 2: tiene que estar en
 * la carpeta de esta familia, tener la forma que generó el paso 1, existir
 * de verdad en Storage y no pasar del tope (el enlace firmado por sí solo no
 * limita el tamaño). El tipo se saca de la extensión que puso el servidor,
 * no de lo que diga el navegador.
 */
async function checkUploadedDocument(identity: GuardianOk, documentPath: string): Promise<UploadedDocument> {
  const folder = `${identity.schoolId}/${identity.familyId}`
  const name = documentPath.slice(folder.length + 1)
  const forma = /^[0-9a-f-]{36}\.(pdf|jpg|png|webp|heic|heif)$/i

  if (!documentPath.startsWith(`${folder}/`) || !forma.test(name)) {
    return { ok: false, error: 'No se encontró el documento adjunto. Vuelve a elegirlo.' }
  }

  const admin = createAdminClient()
  const { data } = await admin.storage.from(JUSTIFICATION_BUCKET).list(folder, { search: name, limit: 1 })
  const subido = (data ?? []).find((f) => f.name === name)
  if (!subido) {
    return { ok: false, error: 'No se encontró el documento adjunto. Vuelve a elegirlo.' }
  }

  const size = Number(subido.metadata?.size ?? 0)
  if (size > MAX_JUSTIFICATION_BYTES) {
    await admin.storage.from(JUSTIFICATION_BUCKET).remove([documentPath])
    return { ok: false, error: 'El archivo es demasiado grande (máximo 10MB).' }
  }

  return { ok: true, documentType: resolveFileType(name, '') }
}

/**
 * Paso 2: el tutor justifica una falta. Esto NUNCA cambia el estado de la
 * asistencia -- solo crea el registro 'pendiente' para que el colegio lo
 * revise (mismo criterio que uploadPaymentReceipt: la palabra de la
 * familia no mueve el dato oficial por sí sola).
 *
 * Solo recibe texto: si hubo documento, ya se subió en el paso 1 y aquí
 * llega únicamente su ruta.
 */
export async function submitAbsenceJustification(input: {
  attendanceId: string
  reason: string
  documentPath: string | null
}): Promise<ActionResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const reason = typeof input?.reason === 'string' ? input.reason.trim() : ''
  if (reason.length < 3) {
    return { ok: false, error: 'Escribe el motivo de la ausencia.' }
  }
  if (reason.length > 1000) {
    return { ok: false, error: 'El motivo es demasiado largo (máximo 1000 caracteres).' }
  }

  const check = await checkJustifiableAbsence(identity, input?.attendanceId)
  if (!check.ok) return { ok: false, error: check.error }

  // El documento es OPCIONAL: muchas justificaciones son de una línea.
  const documentPath = typeof input?.documentPath === 'string' && input.documentPath ? input.documentPath : null
  let documentType: string | null = null
  if (documentPath) {
    const doc = await checkUploadedDocument(identity, documentPath)
    if (!doc.ok) return { ok: false, error: doc.error }
    documentType = doc.documentType
  }

  const admin = createAdminClient()
  const { error: insertError } = await admin.from('attendance_justifications').insert({
    school_id: identity.schoolId,
    attendance_id: input.attendanceId,
    student_id: check.studentId,
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
