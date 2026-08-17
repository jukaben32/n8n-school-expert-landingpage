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

const BUCKET = 'class-updates'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

async function resolveStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'actualizaciones')) {
    return { ok: false as const, error: 'No tienes permiso para publicar actualizaciones.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId, profileId: profile.id as string }
}

// Publica una foto corta del día a día -- dirigida a UN estudiante puntual
// o a un grado/sección completo (nunca ambos, ver el check de la migración
// 032). El bucket es privado (fotos de menores); se sube con el cliente
// admin igual que las fichas escaneadas de estudiantes_escaneos.
export async function createClassUpdateAction(formData: FormData): Promise<ActionResult> {
  const resolved = await resolveStaff()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { ok: false, error: 'Selecciona una foto.' }
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: 'Formato no soportado (usa PNG, JPG o WEBP).' }
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: 'La foto no puede pesar más de 5 MB.' }
  }

  const studentId = formData.get('studentId')
  const gradeLevel = formData.get('gradeLevel')
  const caption = formData.get('caption')

  const hasStudent = typeof studentId === 'string' && studentId.length > 0
  const hasGrade = typeof gradeLevel === 'string' && gradeLevel.trim().length > 0
  if (hasStudent === hasGrade) {
    return { ok: false, error: 'Elige un estudiante específico O un grado/sección, no ambos ni ninguno.' }
  }

  const admin = createAdminClient()

  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: createBucketError } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_PHOTO_BYTES })
    if (createBucketError && !/already exists/i.test(createBucketError.message)) {
      return { ok: false, error: `No se pudo preparar el almacenamiento: ${createBucketError.message}` }
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${resolved.schoolId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (uploadError) return { ok: false, error: `No se pudo subir la foto: ${uploadError.message}` }

  const { error: insertError } = await admin.from('class_updates').insert({
    school_id: resolved.schoolId,
    author_profile_id: resolved.profileId,
    student_id: hasStudent ? studentId : null,
    grade_level: hasGrade ? (gradeLevel as string).trim() : null,
    caption: typeof caption === 'string' && caption.trim() ? caption.trim() : null,
    photo_path: path,
  })
  if (insertError) return { ok: false, error: 'No se pudo guardar la actualización.' }

  revalidatePath('/dashboard/actualizaciones')
  return { ok: true }
}

export async function deleteClassUpdateAction(updateId: string): Promise<ActionResult> {
  const resolved = await resolveStaff()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  const { data: update } = await admin
    .from('class_updates')
    .select('photo_path')
    .eq('id', updateId)
    .eq('school_id', resolved.schoolId)
    .maybeSingle()
  if (!update) return { ok: false, error: 'No se encontró la actualización.' }

  await admin.storage.from(BUCKET).remove([update.photo_path])
  const { error } = await admin.from('class_updates').update({ deleted_at: new Date().toISOString() }).eq('id', updateId)
  if (error) return { ok: false, error: 'No se pudo eliminar.' }

  revalidatePath('/dashboard/actualizaciones')
  return { ok: true }
}
