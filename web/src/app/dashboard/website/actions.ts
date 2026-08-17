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
      .update({ settings: { ...currentSettings, website: websiteSettingsToJson(cleanedSettings) } })
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
