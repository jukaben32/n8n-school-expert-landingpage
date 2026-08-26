'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { MESSAGE_CATEGORIES, type MessageCategory } from '@/lib/messaging/categoryAccess'

interface ActionResult {
  ok: boolean
  error?: string
}

const FULL_ACCESS_ROLES = ['super_admin', 'school_admin', 'director']

const IMAGE_BUCKET = 'comunicados-imagenes'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

// Resuelve grados/secciones elegidos -> family_id de sus estudiantes activos,
// y guarda el comunicado como audience_type='family' (mismo tipo ya
// soportado desde la migración 002). audience_label queda como texto
// legible para mostrar "Para: Kinder A" en la tarjeta del comunicado.
//
// Recibe FormData (no un objeto plano) porque ahora puede traer una imagen
// adjunta -- mismo patrón que createClassUpdateAction/uploadPaymentReceipt.
export async function createMessageAction(formData: FormData): Promise<ActionResult> {
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

  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!title) {
    return { ok: false, error: 'El título es obligatorio.' }
  }

  const priority: 'normal' | 'urgent' = formData.get('priority') === 'urgent' ? 'urgent' : 'normal'
  const publish = formData.get('publish') === 'true'

  const image = formData.get('image')
  const hasImage = image instanceof File && image.size > 0
  if (!body && !hasImage) {
    return { ok: false, error: 'Escribe el contenido o adjunta una imagen.' }
  }
  if (hasImage) {
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return { ok: false, error: 'La imagen debe ser PNG, JPG o WEBP.' }
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: 'La imagen no puede pesar más de 5 MB.' }
    }
  }

  let gradeLevels: string[] = []
  const gradeLevelsRaw = formData.get('gradeLevels')
  if (typeof gradeLevelsRaw === 'string' && gradeLevelsRaw) {
    try {
      const parsed = JSON.parse(gradeLevelsRaw)
      if (Array.isArray(parsed)) gradeLevels = parsed.filter((g): g is string => typeof g === 'string')
    } catch {
      return { ok: false, error: 'Grados/secciones inválidos.' }
    }
  }

  const category = String(formData.get('category') ?? 'regular') as MessageCategory

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  if (!MESSAGE_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Categoría inválida.' }
  }

  const selectedGrades = Array.from(new Set(gradeLevels.map((g) => g.trim()).filter(Boolean)))

  // RLS ya restringe lo que un 'teacher' puede LEER de otros grados, pero
  // este insert va con el cliente admin (bypassa RLS) -- así que la regla
  // "solo tu grado, nunca todo el colegio" y "solo tu categoría" se
  // validan aquí de verdad.
  if (!FULL_ACCESS_ROLES.includes(profile.role)) {
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

  // Si hay imagen, se sube antes del insert -- si el insert falla después,
  // se limpia el archivo para no dejar huérfanos (mismo patrón que
  // uploadPaymentReceipt).
  let imagePath: string | null = null
  if (hasImage) {
    const { data: buckets } = await admin.storage.listBuckets()
    if (!buckets?.some((b) => b.name === IMAGE_BUCKET)) {
      const { error: createBucketError } = await admin.storage.createBucket(IMAGE_BUCKET, { public: false, fileSizeLimit: MAX_IMAGE_BYTES })
      if (createBucketError && !/already exists/i.test(createBucketError.message)) {
        return { ok: false, error: `No se pudo preparar el almacenamiento: ${createBucketError.message}` }
      }
    }

    const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${schoolId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await admin.storage.from(IMAGE_BUCKET).upload(path, image, { contentType: image.type })
    if (uploadError) {
      return { ok: false, error: `No se pudo subir la imagen: ${uploadError.message}` }
    }
    imagePath = path
  }

  const { error: insertError } = await admin.from('messages').insert({
    school_id: schoolId,
    author_id: profile.id,
    title,
    body,
    audience_type: audienceType,
    audience_ids: audienceIds,
    audience_label: audienceLabel,
    priority,
    category,
    image_path: imagePath,
    published_at: publish ? new Date().toISOString() : null,
  })
  if (insertError) {
    if (imagePath) await admin.storage.from(IMAGE_BUCKET).remove([imagePath])
    return { ok: false, error: 'No se pudo guardar el comunicado. Intenta de nuevo.' }
  }

  // Comunicado urgente y publicado ya (no borrador) -- avisa por correo a
  // un tutor por familia (el principal si tiene, si no el primero con
  // correo registrado). Best-effort, nunca falla la publicación.
  if (publish && priority === 'urgent') {
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
