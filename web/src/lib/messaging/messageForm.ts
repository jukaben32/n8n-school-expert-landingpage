import { createAdminClient } from '@/lib/supabase/admin'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { type MessageCategory } from './categoryAccess'

// Lógica compartida entre crear un comunicado y editar un borrador
// existente (ver web/src/app/dashboard/comunicados/nuevo/actions.ts) --
// antes solo existía "crear"; al agregar "editar" se extrajo aquí para no
// duplicar la validación de permisos/audiencia/imagen en dos archivos.

export const MESSAGE_IMAGE_BUCKET = 'comunicados-imagenes'
export const MESSAGE_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MESSAGE_ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export const FULL_ACCESS_ROLES = ['super_admin', 'school_admin', 'director']

interface StaffProfile {
  role: string
  staff_id: string | null
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * ¿Puede este miembro del staff publicar/editar en esta categoría, dirigido
 * a estos grados? RLS ya restringe lo que un 'teacher' puede LEER de otros
 * grados, pero los inserts/updates van con el cliente admin (bypassa RLS)
 * -- así que la regla "solo tu grado, nunca todo el colegio" y "solo tu
 * categoría" se valida aquí de verdad.
 */
export async function checkMessagePermission(
  admin: ReturnType<typeof createAdminClient>,
  params: { profile: StaffProfile; schoolId: string; category: MessageCategory; selectedGrades: string[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { profile, schoolId, category, selectedGrades } = params
  if (FULL_ACCESS_ROLES.includes(profile.role)) return { ok: true }

  if (profile.role !== 'teacher' && !(profile.role === 'reception' && category === 'regular')) {
    return { ok: false, error: 'No tienes permiso para publicar en esta categoría.' }
  }

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
      .eq('category', category)
    const assignedRows = assigned ?? []
    if (assignedRows.length === 0) {
      return { ok: false, error: 'No tienes ningún grado/sección asignado en esta categoría.' }
    }
    const wholeSchool = assignedRows.some((a) => a.grade_level === null)
    if (!wholeSchool) {
      const assignedSet = new Set(assignedRows.map((a) => a.grade_level as string))
      if (selectedGrades.some((g) => !assignedSet.has(g))) {
        return { ok: false, error: 'Solo puedes dirigir comunicados a tus grados/secciones asignados en esta categoría.' }
      }
    }
  }

  return { ok: true }
}

/** Resuelve grados/secciones elegidos -> family_id de sus estudiantes activos. */
export async function resolveMessageAudience(
  admin: ReturnType<typeof createAdminClient>,
  params: { schoolId: string; selectedGrades: string[] }
): Promise<Result<{ audienceType: 'all' | 'family'; audienceIds: string[] | null; audienceLabel: string | null }>> {
  const { schoolId, selectedGrades } = params
  if (selectedGrades.length === 0) {
    return { ok: true, data: { audienceType: 'all', audienceIds: null, audienceLabel: null } }
  }

  const { data: students, error } = await admin
    .from('students')
    .select('family_id')
    .eq('school_id', schoolId)
    .in('grade_level', selectedGrades)
    .is('deleted_at', null)
  if (error) return { ok: false, error: 'No se pudo resolver el grado/sección seleccionado.' }

  const familyIds = Array.from(new Set((students ?? []).map((s) => s.family_id as string)))
  if (familyIds.length === 0) return { ok: false, error: 'No hay estudiantes activos en el grado/sección seleccionado.' }

  return { ok: true, data: { audienceType: 'family', audienceIds: familyIds, audienceLabel: selectedGrades.join(', ') } }
}

export async function uploadMessageImage(
  admin: ReturnType<typeof createAdminClient>,
  params: { schoolId: string; image: File }
): Promise<Result<string>> {
  const { schoolId, image } = params
  if (!MESSAGE_ALLOWED_IMAGE_TYPES.has(image.type)) {
    return { ok: false, error: 'La imagen debe ser PNG, JPG o WEBP.' }
  }
  if (image.size > MESSAGE_MAX_IMAGE_BYTES) {
    return { ok: false, error: 'La imagen no puede pesar más de 5 MB.' }
  }

  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === MESSAGE_IMAGE_BUCKET)) {
    const { error: createBucketError } = await admin.storage.createBucket(MESSAGE_IMAGE_BUCKET, { public: false, fileSizeLimit: MESSAGE_MAX_IMAGE_BYTES })
    if (createBucketError && !/already exists/i.test(createBucketError.message)) {
      return { ok: false, error: `No se pudo preparar el almacenamiento: ${createBucketError.message}` }
    }
  }

  const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${schoolId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await admin.storage.from(MESSAGE_IMAGE_BUCKET).upload(path, image, { contentType: image.type })
  if (uploadError) return { ok: false, error: `No se pudo subir la imagen: ${uploadError.message}` }

  return { ok: true, data: path }
}

/**
 * Comunicado urgente y publicado (no borrador) -- avisa por correo a un
 * tutor por familia (el principal si tiene, si no el primero con correo
 * registrado). Best-effort, nunca falla la publicación.
 */
export async function notifyUrgentMessage(params: {
  admin: ReturnType<typeof createAdminClient>
  schoolId: string
  audienceType: 'all' | 'family'
  audienceIds: string[] | null
  title: string
  body: string
}): Promise<void> {
  const { admin, schoolId, audienceType, audienceIds, title, body } = params
  const [{ data: school }, { data: guardians }] = await Promise.all([
    admin.from('schools').select('name').eq('id', schoolId).single(),
    audienceType === 'family' && audienceIds
      ? admin.from('guardians').select('family_id, email, is_primary').in('family_id', audienceIds).order('is_primary', { ascending: false })
      : admin.from('guardians').select('family_id, email, is_primary').eq('school_id', schoolId).order('is_primary', { ascending: false }),
  ])

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
