'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { extractStructuredDocument, type SourceMediaType } from '@/lib/ocr/extractStructuredDocument'
import { enrollmentFormSchema, enrollmentFormInstructions, type EnrollmentFormData } from '@/lib/ocr/enrollmentFormSchema'
import { createStudentWithFamily, type CreateStudentWithFamilyInput } from '@/lib/students/createStudentWithFamily'
import type { SubmitNewStudentInput } from '../nuevo/actions'

const BUCKET = 'fichas-inscripcion'
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB por archivo suelto
const MAX_PDF_BYTES = 25 * 1024 * 1024 // 25MB por PDF multi-página

const MEDIA_TYPE_BY_MIME: Record<string, SourceMediaType> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

interface ActionResult {
  ok: boolean
  error?: string
}

async function resolveScanStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'estudiantes_escaneos')) {
    return { ok: false as const, error: 'No tienes permiso para escanear fichas de inscripción.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, staffProfileId: profile.id as string, schoolId }
}

export interface PendingEnrollmentScan {
  id: string
  storage_path: string
  source_page: number | null
  confidence: number | null
  extraction_error: string | null
  extracted_data: EnrollmentFormData | null
  created_at: string
}

export async function listPendingEnrollmentScans(): Promise<PendingEnrollmentScan[]> {
  const staff = await resolveScanStaff()
  if (!staff.ok) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('enrollment_form_scans')
    .select('id, storage_path, source_page, confidence, extraction_error, extracted_data, created_at')
    .eq('school_id', staff.schoolId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as PendingEnrollmentScan[]
}

/** URL firmada de corta duración -- el bucket es privado, nunca hay una URL pública. */
export async function getEnrollmentScanSignedUrl(scanId: string): Promise<string | null> {
  const staff = await resolveScanStaff()
  if (!staff.ok) return null

  const admin = createAdminClient()
  const { data: scan } = await admin
    .from('enrollment_form_scans')
    .select('storage_path')
    .eq('id', scanId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!scan) return null

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(scan.storage_path, 300)
  if (error || !data) return null
  return data.signedUrl
}

export type UploadScansResult = { ok: true; created: number } | { ok: false; error: string }

/**
 * Sube y procesa un lote de fichas. `formData` trae `mode` ('files' o
 * 'multiPagePdf') y uno o varios campos `file`. Solo crea filas en
 * `enrollment_form_scans` (bandeja de revisión) -- nunca un estudiante.
 */
export async function uploadEnrollmentScans(formData: FormData): Promise<UploadScansResult> {
  const staff = await resolveScanStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const mode = formData.get('mode')
  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0) return { ok: false, error: 'No se recibió ningún archivo.' }

  const admin = createAdminClient()

  if (mode === 'multiPagePdf') {
    const file = files[0]
    if (MEDIA_TYPE_BY_MIME[file.type] !== 'application/pdf') {
      return { ok: false, error: 'Para el modo "PDF multi-página" el archivo debe ser un PDF.' }
    }
    if (file.size > MAX_PDF_BYTES) return { ok: false, error: 'El PDF es demasiado grande (máximo 25MB).' }

    const bytes = Buffer.from(await file.arrayBuffer())
    const storagePath = `${staff.schoolId}/${crypto.randomUUID()}.pdf`
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'application/pdf' })
    if (uploadError) return { ok: false, error: `No se pudo subir el archivo: ${uploadError.message}` }

    const extraction = await extractStructuredDocument({
      input: { kind: 'multiPagePdf', base64: bytes.toString('base64') },
      schema: enrollmentFormSchema,
      instructions: enrollmentFormInstructions,
    })
    if (!extraction.ok) return { ok: false, error: extraction.error }

    const rows = extraction.results.map((r) => ({
      school_id: staff.schoolId,
      uploaded_by: staff.staffProfileId,
      storage_path: storagePath,
      source_page: r.index + 1,
      status: 'pendiente',
      extracted_data: r.data,
      confidence: r.ok ? confidenceOf(r.data) : null,
      extraction_error: r.error,
    }))
    const { error: insertError } = await admin.from('enrollment_form_scans').insert(rows)
    if (insertError) return { ok: false, error: insertError.message }

    revalidatePath('/dashboard/estudiantes/escaneos')
    return { ok: true, created: rows.length }
  }

  // mode === 'files': cada archivo subido es una ficha independiente.
  const prepared: { file: File; mediaType: SourceMediaType; base64: string }[] = []
  for (const file of files) {
    const mediaType = MEDIA_TYPE_BY_MIME[file.type]
    if (!mediaType) return { ok: false, error: `Tipo de archivo no soportado: "${file.name}".` }
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: `El archivo "${file.name}" es demasiado grande (máximo 10MB).` }
    const bytes = Buffer.from(await file.arrayBuffer())
    prepared.push({ file, mediaType, base64: bytes.toString('base64') })
  }

  const extraction = await extractStructuredDocument({
    input: { kind: 'files', documents: prepared.map((p) => ({ mediaType: p.mediaType, base64: p.base64 })) },
    schema: enrollmentFormSchema,
    instructions: enrollmentFormInstructions,
  })
  if (!extraction.ok) return { ok: false, error: extraction.error }

  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i]
    const extension = p.mediaType === 'application/pdf' ? 'pdf' : p.mediaType.split('/')[1]
    const storagePath = `${staff.schoolId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(p.base64, 'base64'), { contentType: p.mediaType })
    if (uploadError) return { ok: false, error: `No se pudo subir "${p.file.name}": ${uploadError.message}` }

    const r = extraction.results[i]
    rows.push({
      school_id: staff.schoolId,
      uploaded_by: staff.staffProfileId,
      storage_path: storagePath,
      source_page: null,
      status: 'pendiente',
      extracted_data: r.data,
      confidence: r.ok ? confidenceOf(r.data) : null,
      extraction_error: r.error,
    })
  }

  const { error: insertError } = await admin.from('enrollment_form_scans').insert(rows)
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath('/dashboard/estudiantes/escaneos')
  return { ok: true, created: rows.length }
}

function confidenceOf(data: Record<string, unknown> | null): number | null {
  const value = data?.confianza
  return typeof value === 'number' ? value : null
}

/**
 * Confirma una ficha revisada -- crea el estudiante (+ familia/tutores si
 * aplica) con los valores que el staff corrigió en pantalla, usando el
 * mismo createStudentWithFamily() que el formulario manual. Nunca usa
 * extracted_data directamente.
 */
export async function confirmEnrollmentScan(scanId: string, input: SubmitNewStudentInput): Promise<ActionResult> {
  const staff = await resolveScanStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { data: scan } = await admin
    .from('enrollment_form_scans')
    .select('id, status')
    .eq('id', scanId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!scan) return { ok: false, error: 'No se encontró la ficha.' }
  if (scan.status !== 'pendiente') return { ok: false, error: 'Esta ficha ya fue revisada.' }

  const supabase = await createClient()
  const fullInput: CreateStudentWithFamilyInput =
    input.mode === 'new'
      ? { mode: 'new', schoolId: staff.schoolId, student: input.student, familyName: input.familyName, guardians: input.guardians }
      : { mode: 'existing', schoolId: staff.schoolId, student: input.student, familyId: input.familyId }

  const result = await createStudentWithFamily(supabase, fullInput)
  if (!result.ok) return { ok: false, error: result.error }

  await admin
    .from('enrollment_form_scans')
    .update({
      status: 'confirmado',
      created_student_id: result.studentId,
      created_family_id: result.familyId,
      reviewed_by: staff.staffProfileId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', scanId)

  revalidatePath('/dashboard/estudiantes/escaneos')
  revalidatePath('/dashboard/estudiantes')
  return { ok: true }
}

export async function rejectEnrollmentScan(scanId: string, reason: string): Promise<ActionResult> {
  const staff = await resolveScanStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { data: scan } = await admin
    .from('enrollment_form_scans')
    .select('id, status')
    .eq('id', scanId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!scan) return { ok: false, error: 'No se encontró la ficha.' }
  if (scan.status !== 'pendiente') return { ok: false, error: 'Esta ficha ya fue revisada.' }

  await admin
    .from('enrollment_form_scans')
    .update({
      status: 'rechazado',
      reviewed_by: staff.staffProfileId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim() || null,
    })
    .eq('id', scanId)

  revalidatePath('/dashboard/estudiantes/escaneos')
  return { ok: true }
}
