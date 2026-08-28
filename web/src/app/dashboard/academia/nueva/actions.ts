'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { extractStructuredDocument, type SourceMediaType } from '@/lib/ocr/extractStructuredDocument'
import { quizPageSchema, quizPageInstructions, type QuizPageData } from '@/lib/ocr/quizPageSchema'

const IMAGE_BUCKET = 'academia-imagenes'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

const MAX_SCAN_FILE_BYTES = 10 * 1024 * 1024 // 10MB por archivo suelto
const MAX_SCAN_PDF_BYTES = 25 * 1024 * 1024 // 25MB por PDF multi-página
const MEDIA_TYPE_BY_MIME: Record<string, SourceMediaType> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

async function resolveAcademiaStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'academia_gestionar')) {
    return { ok: false as const, error: 'No tienes permiso para gestionar Academia.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

async function ensureImageBucket(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data: buckets } = await admin.storage.listBuckets()
  if (buckets?.some((b) => b.name === IMAGE_BUCKET)) return null
  const { error } = await admin.storage.createBucket(IMAGE_BUCKET, { public: false, fileSizeLimit: MAX_IMAGE_BYTES })
  if (error && !/already exists/i.test(error.message)) return error.message
  return null
}

export type UploadQuestionImageResult =
  | { ok: true; imagePath: string; previewUrl: string }
  | { ok: false; error: string }

/**
 * Sube la imagen de apoyo de UNA pregunta (ej. un diagrama que la pregunta
 * necesita) -- no crea nada en la base de datos, solo devuelve el path para
 * que NewLessonForm lo guarde junto con la pregunta al hacer "Guardar
 * lección". El bucket es privado, así que también devuelve una signed URL
 * de vista previa inmediata para mostrarla en el formulario.
 */
export async function uploadQuestionImageAction(formData: FormData): Promise<UploadQuestionImageResult> {
  const staff = await resolveAcademiaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const file = formData.get('image')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecciona una imagen.' }
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: 'La imagen debe ser PNG, JPG o WEBP.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'La imagen no puede pesar más de 5 MB.' }
  }

  const admin = createAdminClient()
  const bucketError = await ensureImageBucket(admin)
  if (bucketError) return { ok: false, error: `No se pudo preparar el almacenamiento: ${bucketError}` }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${staff.schoolId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await admin.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type })
  if (uploadError) return { ok: false, error: `No se pudo subir la imagen: ${uploadError.message}` }

  const { data: signed, error: signError } = await admin.storage.from(IMAGE_BUCKET).createSignedUrl(path, 3600)
  if (signError || !signed) return { ok: false, error: 'La imagen se subió, pero no se pudo generar la vista previa.' }

  return { ok: true, imagePath: path, previewUrl: signed.signedUrl }
}

export interface ExtractedQuizQuestion {
  prompt: string
  options: string[]
  correctOptionIndex: number | null
}

export type ExtractQuizResult =
  | { ok: true; questions: ExtractedQuizQuestion[]; warnings: string[] }
  | { ok: false; error: string }

/**
 * Extrae preguntas+opciones de una o varias fotos (o un PDF multi-página)
 * del cuestionario de un libro de texto, usando el mismo núcleo de OCR ya
 * usado para fichas de inscripción y facturas de proveedores (ver
 * extractStructuredDocument.ts). A propósito NO crea nada en la base de
 * datos -- devuelve el borrador para que el profesor lo revise/corrija en
 * el propio formulario de Nueva Lección antes de "Guardar lección".
 */
export async function extractQuizFromDocumentsAction(formData: FormData): Promise<ExtractQuizResult> {
  // Solo se usa para verificar la sesión/permiso -- esta acción nunca sube
  // ni persiste nada, así que no hace falta el schoolId resuelto.
  const staff = await resolveAcademiaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const mode = formData.get('mode')
  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0) return { ok: false, error: 'No se recibió ningún archivo.' }

  if (mode === 'multiPagePdf') {
    const file = files[0]
    if (MEDIA_TYPE_BY_MIME[file.type] !== 'application/pdf') {
      return { ok: false, error: 'Para el modo "PDF multi-página" el archivo debe ser un PDF.' }
    }
    if (file.size > MAX_SCAN_PDF_BYTES) return { ok: false, error: 'El PDF es demasiado grande (máximo 25MB).' }

    const bytes = Buffer.from(await file.arrayBuffer())
    const extraction = await extractStructuredDocument({
      input: { kind: 'multiPagePdf', base64: bytes.toString('base64') },
      schema: quizPageSchema,
      instructions: quizPageInstructions,
    })
    if (!extraction.ok) return { ok: false, error: extraction.error }
    return collectQuestions(extraction.results)
  }

  // mode === 'files': cada archivo es una página/foto independiente.
  const prepared: { file: File; mediaType: SourceMediaType; base64: string }[] = []
  for (const file of files) {
    const mediaType = MEDIA_TYPE_BY_MIME[file.type]
    if (!mediaType || mediaType === 'application/pdf') return { ok: false, error: `Tipo de archivo no soportado: "${file.name}".` }
    if (file.size > MAX_SCAN_FILE_BYTES) return { ok: false, error: `El archivo "${file.name}" es demasiado grande (máximo 10MB).` }
    const bytes = Buffer.from(await file.arrayBuffer())
    prepared.push({ file, mediaType, base64: bytes.toString('base64') })
  }

  const extraction = await extractStructuredDocument({
    input: { kind: 'files', documents: prepared.map((p) => ({ mediaType: p.mediaType, base64: p.base64 })) },
    schema: quizPageSchema,
    instructions: quizPageInstructions,
  })
  if (!extraction.ok) return { ok: false, error: extraction.error }
  return collectQuestions(extraction.results)
}

function collectQuestions(
  results: { index: number; ok: boolean; data: Record<string, unknown> | null; error: string | null }[]
): ExtractQuizResult {
  const questions: ExtractedQuizQuestion[] = []
  const warnings: string[] = []

  for (const r of results) {
    if (!r.ok || !r.data) {
      warnings.push(`Página ${r.index + 1}: no se pudo leer (${r.error ?? 'error desconocido'}).`)
      continue
    }
    const data = r.data as unknown as QuizPageData
    for (const q of data.preguntas ?? []) {
      if (!q.enunciado?.trim() || !Array.isArray(q.opciones) || q.opciones.filter((o) => o.trim()).length < 2) continue
      const options = q.opciones.map((o) => o.trim()).filter(Boolean)
      const correctOptionIndex =
        typeof q.indice_correcta === 'number' && q.indice_correcta >= 0 && q.indice_correcta < options.length
          ? q.indice_correcta
          : null
      questions.push({ prompt: q.enunciado.trim(), options, correctOptionIndex })
    }
  }

  if (questions.length === 0) {
    return { ok: false, error: 'No se pudo extraer ninguna pregunta de opción múltiple de los archivos subidos.' }
  }
  return { ok: true, questions, warnings }
}
