'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { MESSAGE_CATEGORIES, type MessageCategory } from '@/lib/messaging/categoryAccess'
import {
  checkMessagePermission,
  resolveMessageAudience,
  uploadMessageImage,
  notifyUrgentMessage,
  MESSAGE_IMAGE_BUCKET,
} from '@/lib/messaging/messageForm'

interface ActionResult {
  ok: boolean
  error?: string
}

// Recibe FormData (no un objeto plano) porque puede traer una imagen
// adjunta -- mismo patrón que createClassUpdateAction/uploadPaymentReceipt.
function parseSelectedGrades(formData: FormData): string[] | null {
  const raw = formData.get('gradeLevels')
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return Array.from(
      new Set(parsed.filter((g): g is string => typeof g === 'string').map((g) => g.trim()).filter(Boolean))
    )
  } catch {
    return null
  }
}

/**
 * Crea un comunicado nuevo -- audience_type='family' (grados/secciones
 * elegidos) o 'all' (todo el colegio), según lo que envíe el formulario.
 * "Guardar borrador" deja published_at en null (solo visible para staff).
 */
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

  const selectedGrades = parseSelectedGrades(formData)
  if (selectedGrades === null) {
    return { ok: false, error: 'Grados/secciones inválidos.' }
  }

  const category = String(formData.get('category') ?? 'regular') as MessageCategory
  if (!MESSAGE_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Categoría inválida.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  const permission = await checkMessagePermission(admin, { profile, schoolId, category, selectedGrades })
  if (!permission.ok) return permission

  const audience = await resolveMessageAudience(admin, { schoolId, selectedGrades })
  if (!audience.ok) return { ok: false, error: audience.error }

  // Si hay imagen, se sube antes del insert -- si el insert falla después,
  // se limpia el archivo para no dejar huérfanos (mismo patrón que
  // uploadPaymentReceipt).
  let imagePath: string | null = null
  if (hasImage) {
    const uploaded = await uploadMessageImage(admin, { schoolId, image })
    if (!uploaded.ok) return { ok: false, error: uploaded.error }
    imagePath = uploaded.data
  }

  const { error: insertError } = await admin.from('messages').insert({
    school_id: schoolId,
    author_id: profile.id,
    title,
    body,
    audience_type: audience.data.audienceType,
    audience_ids: audience.data.audienceIds,
    audience_label: audience.data.audienceLabel,
    priority,
    category,
    image_path: imagePath,
    published_at: publish ? new Date().toISOString() : null,
  })
  if (insertError) {
    if (imagePath) await admin.storage.from(MESSAGE_IMAGE_BUCKET).remove([imagePath])
    return { ok: false, error: 'No se pudo guardar el comunicado. Intenta de nuevo.' }
  }

  if (publish && priority === 'urgent') {
    await notifyUrgentMessage({
      admin,
      schoolId,
      audienceType: audience.data.audienceType,
      audienceIds: audience.data.audienceIds,
      title,
      body,
    })
  }

  revalidatePath('/dashboard/comunicados')
  return { ok: true }
}

/**
 * Retoma un borrador ya guardado (published_at null) para seguir
 * editándolo y, cuando esté listo, publicarlo -- antes no existía ninguna
 * forma de hacer esto: "Guardar borrador" y "Publicar ahora" solo creaban
 * comunicados nuevos, así que un borrador guardado quedaba congelado para
 * siempre (ver conversación con el colegio, 2026-09-23: secretaría tuvo que
 * recrear el aviso de "no docencia" porque no había manera de retomarlo).
 * Un comunicado ya publicado no se puede editar por acá.
 */
export async function updateMessageAction(messageId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'comunicados_nuevo')) {
    return { ok: false, error: 'No tienes permiso para editar comunicados.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  const { data: existing, error: existingError } = await admin
    .from('messages')
    .select('id, published_at, image_path')
    .eq('id', messageId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingError || !existing) return { ok: false, error: 'No se encontró el comunicado.' }
  if (existing.published_at) return { ok: false, error: 'Este comunicado ya fue publicado y no se puede editar.' }

  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!title) {
    return { ok: false, error: 'El título es obligatorio.' }
  }

  const priority: 'normal' | 'urgent' = formData.get('priority') === 'urgent' ? 'urgent' : 'normal'
  const publish = formData.get('publish') === 'true'

  const image = formData.get('image')
  const hasNewImage = image instanceof File && image.size > 0
  const removeImage = formData.get('removeImage') === 'true'
  const keepsExistingImage = !hasNewImage && !removeImage && !!existing.image_path

  if (!body && !hasNewImage && !keepsExistingImage) {
    return { ok: false, error: 'Escribe el contenido o adjunta una imagen.' }
  }

  const selectedGrades = parseSelectedGrades(formData)
  if (selectedGrades === null) {
    return { ok: false, error: 'Grados/secciones inválidos.' }
  }

  const category = String(formData.get('category') ?? 'regular') as MessageCategory
  if (!MESSAGE_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Categoría inválida.' }
  }

  const permission = await checkMessagePermission(admin, { profile, schoolId, category, selectedGrades })
  if (!permission.ok) return permission

  const audience = await resolveMessageAudience(admin, { schoolId, selectedGrades })
  if (!audience.ok) return { ok: false, error: audience.error }

  let imagePath: string | null = keepsExistingImage ? existing.image_path : null
  if (hasNewImage) {
    const uploaded = await uploadMessageImage(admin, { schoolId, image })
    if (!uploaded.ok) return { ok: false, error: uploaded.error }
    imagePath = uploaded.data
  }

  const { error: updateError } = await admin
    .from('messages')
    .update({
      title,
      body,
      audience_type: audience.data.audienceType,
      audience_ids: audience.data.audienceIds,
      audience_label: audience.data.audienceLabel,
      priority,
      category,
      image_path: imagePath,
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq('id', messageId)
  if (updateError) {
    if (imagePath && imagePath !== existing.image_path) await admin.storage.from(MESSAGE_IMAGE_BUCKET).remove([imagePath])
    return { ok: false, error: 'No se pudo guardar el comunicado. Intenta de nuevo.' }
  }

  // Si se reemplazó o se quitó la imagen anterior, borrar el archivo viejo.
  if (existing.image_path && existing.image_path !== imagePath) {
    await admin.storage.from(MESSAGE_IMAGE_BUCKET).remove([existing.image_path])
  }

  if (publish && priority === 'urgent') {
    await notifyUrgentMessage({
      admin,
      schoolId,
      audienceType: audience.data.audienceType,
      audienceIds: audience.data.audienceIds,
      title,
      body,
    })
  }

  revalidatePath('/dashboard/comunicados')
  return { ok: true }
}
