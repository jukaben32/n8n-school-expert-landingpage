import { createAdminClient } from '@/lib/supabase/admin'
import { buildSecretariaMessageBody, type SecretariaNotice } from './secretariaNotice'

type AdminClient = ReturnType<typeof createAdminClient>

export interface DeliverNoticeInput {
  schoolId: string
  familyId: string
  // users_profiles.id del tutor: direct_messages.sender_profile_id es NOT NULL.
  profileId: string
  notice: SecretariaNotice
  channelLabel: string
  originalMessage: string
}

export interface DeliverNoticeResult {
  ok: boolean
  // Texto que se le devuelve al modelo como resultado de la herramienta.
  message: string
}

/**
 * Perfil de un tutor a partir de su ficha, para el canal de WhatsApp (que no tiene sesión y por
 * tanto no trae profileId). A propósito usa .limit(1) y NO .single(): guardian_id no es único en
 * users_profiles (dos tutores de una familia pueden compartirlo), y .single() falló en producción
 * por eso el 2026-09-28 (ver resolveGuardianIdentity.ts). Devuelve null si el tutor nunca entró al
 * portal: en ese caso el asistente no puede dejar avisos, y el prompt lo refleja.
 */
export async function findFamilyProfileId(admin: AdminClient, schoolId: string, familyId: string, guardianId: string): Promise<string | null> {
  const own = await admin
    .from('users_profiles')
    .select('id')
    .eq('school_id', schoolId)
    .eq('guardian_id', guardianId)
    .limit(1)
  const ownId = own.data?.[0]?.id as string | undefined
  if (ownId) return ownId

  // Quien escribe por WhatsApp puede no haber entrado nunca al portal, pero otro tutor de la MISMA familia
  // sí. La conversación con la secretaría es una sola por familia, así que se le atribuye el mensaje a ese
  // perfil: el texto original de la familia va dentro del aviso, de modo que nadie se confunde de quién es.
  const guardians = await admin
    .from('guardians')
    .select('id')
    .eq('school_id', schoolId)
    .eq('family_id', familyId)
    .is('deleted_at', null)
  const guardianIds = (guardians.data ?? []).map((g) => g.id as string)
  if (guardianIds.length === 0) return null

  const sibling = await admin
    .from('users_profiles')
    .select('id')
    .eq('school_id', schoolId)
    .in('guardian_id', guardianIds)
    .limit(1)
  return (sibling.data?.[0]?.id as string | undefined) ?? null
}

// Misma conversación "regular" (familia <-> colegio) que ve la secretaría en Mensajes.
// Es única por (familia, categoría): si dos avisos la crean a la vez, el segundo reintenta la lectura.
async function getOrCreateRegularConversation(admin: AdminClient, schoolId: string, familyId: string): Promise<string> {
  const find = () =>
    admin
      .from('direct_conversations')
      .select('id')
      .eq('school_id', schoolId)
      .eq('family_id', familyId)
      .eq('category', 'regular')
      .maybeSingle()

  const { data: existing } = await find()
  if (existing?.id) return existing.id as string

  const { data: created, error } = await admin
    .from('direct_conversations')
    .insert({ school_id: schoolId, family_id: familyId, category: 'regular' })
    .select('id')
    .single()
  if (created?.id) return created.id as string

  const { data: afterRace } = await find()
  if (afterRace?.id) return afterRace.id as string
  throw new Error(error?.message ?? 'No se pudo abrir la conversación.')
}

export async function deliverSecretariaNotice(admin: AdminClient, input: DeliverNoticeInput): Promise<DeliverNoticeResult> {
  try {
    const conversationId = await getOrCreateRegularConversation(admin, input.schoolId, input.familyId)

    const { error: insertError } = await admin.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_type: 'guardian',
      sender_profile_id: input.profileId,
      body: buildSecretariaMessageBody(input.notice, input.channelLabel, input.originalMessage),
    })
    if (insertError) throw new Error(insertError.message)

    // last_message_at es lo que sube la conversación al tope de la bandeja y enciende el contador de no leídos.
    const now = new Date().toISOString()
    await admin
      .from('direct_conversations')
      .update({ last_message_at: now, guardian_last_read_at: now })
      .eq('id', conversationId)

    return { ok: true, message: 'Aviso registrado en la bandeja de Mensajes de la secretaría.' }
  } catch (err) {
    console.error('[deliverSecretariaNotice] No se pudo dejar el aviso:', err instanceof Error ? err.message : err)
    return { ok: false, message: 'No se pudo registrar el aviso en la secretaría.' }
  }
}
