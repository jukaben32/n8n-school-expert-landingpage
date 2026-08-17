'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { buildWebsiteSettings, websiteSettingsToJson, type SchoolWebsiteSettings } from '@/lib/websiteSettings'

export interface WebsiteServiceInput {
  icon: string
  name: string
  description: string
  duration: string
  price: string
}

export interface WebsiteTeamMemberInput {
  name: string
  role: string
  bio: string
  photoUrl: string
}

export interface WebsiteTestimonialInput {
  quote: string
  authorName: string
  authorRole: string
  rating: number
}

export interface WebsiteFaqInput {
  question: string
  answer: string
}

export interface SaveWebsiteContentInput {
  logoUrl: string
  settings: SchoolWebsiteSettings
  services: WebsiteServiceInput[]
  teamMembers: WebsiteTeamMemberInput[]
  testimonials: WebsiteTestimonialInput[]
  faqs: WebsiteFaqInput[]
}

interface ActionResult {
  ok: boolean
  error?: string
}

interface UploadResult {
  ok: boolean
  url?: string
  error?: string
}

async function resolveSchoolAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'website')) {
    return { ok: false as const, error: 'No tienes permiso para editar el sitio web.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

// Las listas (servicios, equipo, testimonios, FAQs) se reemplazan por
// completo en cada guardado -- más simple y seguro que comparar IDs
// temporales del cliente contra los reales de la base, y estas listas son
// pequeñas (un puñado de filas), así que borrar+insertar sale barato.
async function replaceList(
  admin: ReturnType<typeof createAdminClient>,
  table: 'website_services' | 'website_team_members' | 'website_testimonials' | 'website_faqs',
  schoolId: string,
  rows: Record<string, unknown>[]
) {
  const { error: delError } = await admin.from(table).delete().eq('school_id', schoolId)
  if (delError) throw delError
  if (rows.length === 0) return
  const { error: insError } = await admin
    .from(table)
    .insert(rows.map((row, i) => ({ school_id: schoolId, ...row, sort_order: i })))
  if (insError) throw insError
}

export async function saveWebsiteContentAction(input: SaveWebsiteContentInput): Promise<ActionResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  const { schoolId } = resolved

  const { data: schoolRow, error: schoolFetchError } = await admin
    .from('schools')
    .select('settings')
    .eq('id', schoolId)
    .single()
  if (schoolFetchError) return { ok: false, error: 'No se pudo cargar la configuración actual del colegio.' }

  const currentSettings = schoolRow.settings && typeof schoolRow.settings === 'object' && !Array.isArray(schoolRow.settings)
    ? schoolRow.settings
    : {}

  const cleanedSettings = buildWebsiteSettings(input.settings)

  try {
    const { error: settingsError } = await admin
      .from('schools')
      .update({
        logo_url: input.logoUrl.trim() || null,
        settings: { ...currentSettings, website: websiteSettingsToJson(cleanedSettings) },
      })
      .eq('id', schoolId)
    if (settingsError) throw settingsError

    await replaceList(
      admin,
      'website_services',
      schoolId,
      input.services
        .filter((s) => s.name.trim())
        .map((s) => ({
          icon: s.icon.trim() || 'sparkles',
          name: s.name.trim(),
          description: s.description.trim() || null,
          duration: s.duration.trim() || null,
          price: s.price.trim() || null,
        }))
    )
    await replaceList(
      admin,
      'website_team_members',
      schoolId,
      input.teamMembers
        .filter((m) => m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          role: m.role.trim() || 'Personal del colegio',
          bio: m.bio.trim() || null,
          photo_url: m.photoUrl.trim() || null,
        }))
    )
    await replaceList(
      admin,
      'website_testimonials',
      schoolId,
      input.testimonials
        .filter((t) => t.quote.trim() && t.authorName.trim())
        .map((t) => ({
          quote: t.quote.trim(),
          author_name: t.authorName.trim(),
          author_role: t.authorRole.trim() || null,
          rating: Math.min(5, Math.max(1, t.rating || 5)),
        }))
    )
    await replaceList(
      admin,
      'website_faqs',
      schoolId,
      input.faqs
        .filter((f) => f.question.trim() && f.answer.trim())
        .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo guardar el sitio web.' }
  }

  revalidatePath('/dashboard/website')
  revalidatePath('/colegio/[subdomain]', 'page')
  return { ok: true }
}

const WEBSITE_PHOTOS_BUCKET = 'website-photos'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

// Sube una sola imagen del constructor de sitio web (logo, portada, foto de
// "sobre nosotros", fotos del personal) al bucket público website-photos,
// bajo un prefijo website/{schoolId}/ -- mismo patrón que el proyecto de
// referencia (real-estate-multi-ai-agent-saas), un solo endpoint genérico
// con un parámetro `kind` en vez de uno por campo.
//
// El bucket se crea la primera vez que hace falta (público, para que
// /colegio/[subdomain] pueda mostrar las imágenes sin sesión) -- así no
// hace falta un paso manual en el dashboard de Supabase.
export async function uploadWebsitePhotoAction(formData: FormData): Promise<UploadResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { ok: false, error: 'No se recibió ningún archivo.' }
  }
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    return { ok: false, error: 'Formato no soportado (usa PNG, JPG o WEBP).' }
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: 'La imagen no puede pesar más de 5 MB.' }
  }

  const kindRaw = formData.get('kind')
  const kind = typeof kindRaw === 'string' && /^[a-z0-9-]+$/.test(kindRaw) ? kindRaw : 'photo'

  const admin = createAdminClient()

  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === WEBSITE_PHOTOS_BUCKET)) {
    const { error: createBucketError } = await admin.storage.createBucket(WEBSITE_PHOTOS_BUCKET, {
      public: true,
      fileSizeLimit: MAX_PHOTO_BYTES,
    })
    // Ignora "already exists" por si dos subidas concurrentes intentan
    // crearlo a la vez -- cualquier otro error sí bloquea la subida.
    if (createBucketError && !/already exists/i.test(createBucketError.message)) {
      return { ok: false, error: `No se pudo preparar el almacenamiento: ${createBucketError.message}` }
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `website/${resolved.schoolId}/${kind}-${Date.now()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from(WEBSITE_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: publicUrlData } = admin.storage.from(WEBSITE_PHOTOS_BUCKET).getPublicUrl(path)
  return { ok: true, url: publicUrlData.publicUrl }
}

const INQUIRY_STATUSES = new Set(['nuevo', 'contactado', 'descartado'])

export async function updateInquiryStatusAction(inquiryId: string, status: string): Promise<ActionResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }
  if (!INQUIRY_STATUSES.has(status)) return { ok: false, error: 'Estado inválido.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('website_inquiries')
    .update({ status })
    .eq('id', inquiryId)
    .eq('school_id', resolved.schoolId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/website')
  return { ok: true }
}
