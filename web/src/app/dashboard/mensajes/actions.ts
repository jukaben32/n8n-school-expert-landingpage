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

async function resolveStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'mensajes_directos')) {
    return { ok: false as const, error: 'No tienes permiso para usar mensajes directos.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId, profileId: profile.id as string }
}

async function getOrCreateConversation(admin: ReturnType<typeof createAdminClient>, schoolId: string, familyId: string) {
  const { data: existing } = await admin
    .from('direct_conversations')
    .select('id')
    .eq('school_id', schoolId)
    .eq('family_id', familyId)
    .maybeSingle()
  if (existing) return existing.id as string

  const { data: created, error } = await admin
    .from('direct_conversations')
    .insert({ school_id: schoolId, family_id: familyId })
    .select('id')
    .single()
  if (error || !created) throw new Error(error?.message ?? 'No se pudo crear la conversación.')
  return created.id as string
}

export async function sendStaffMessageAction(familyId: string, body: string): Promise<ActionResult> {
  const resolved = await resolveStaff()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: 'Escribe un mensaje.' }

  const admin = createAdminClient()
  let conversationId: string
  try {
    conversationId = await getOrCreateConversation(admin, resolved.schoolId, familyId)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo abrir la conversación.' }
  }

  const now = new Date().toISOString()
  const { error: insertError } = await admin.from('direct_messages').insert({
    conversation_id: conversationId,
    sender_type: 'staff',
    sender_profile_id: resolved.profileId,
    body: trimmed,
  })
  if (insertError) return { ok: false, error: 'No se pudo enviar el mensaje.' }

  await admin.from('direct_conversations').update({ last_message_at: now, staff_last_read_at: now }).eq('id', conversationId)

  revalidatePath(`/dashboard/mensajes/${familyId}`)
  revalidatePath('/dashboard/mensajes')
  return { ok: true }
}
