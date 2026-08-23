'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { staffCanAccessFamilyCategory, type MessageCategory } from '@/lib/messaging/categoryAccess'

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
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'mensajes_directos')) {
    return { ok: false as const, error: 'No tienes permiso para usar mensajes directos.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return {
    ok: true as const,
    schoolId,
    profileId: profile.id as string,
    role: profile.role as string,
    staffId: profile.staff_id as string | null,
  }
}

async function getOrCreateConversation(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  familyId: string,
  category: MessageCategory
) {
  const { data: existing } = await admin
    .from('direct_conversations')
    .select('id')
    .eq('school_id', schoolId)
    .eq('family_id', familyId)
    .eq('category', category)
    .maybeSingle()
  if (existing) return existing.id as string

  const { data: created, error } = await admin
    .from('direct_conversations')
    .insert({ school_id: schoolId, family_id: familyId, category })
    .select('id')
    .single()
  if (error || !created) throw new Error(error?.message ?? 'No se pudo crear la conversación.')
  return created.id as string
}

export async function sendStaffMessageAction(familyId: string, category: MessageCategory, body: string): Promise<ActionResult> {
  const resolved = await resolveStaff()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: 'Escribe un mensaje.' }

  const admin = createAdminClient()

  // resolveStaff() solo valida el módulo (mensajes_directos), no la
  // categoría -- estos caminos usan el cliente admin, que se salta RLS,
  // así que la autorización real de "esta familia en esta categoría" hay
  // que hacerla acá explícitamente (ver categoryAccess.ts).
  const allowed = await staffCanAccessFamilyCategory(admin, {
    schoolId: resolved.schoolId,
    role: resolved.role,
    staffId: resolved.staffId,
    familyId,
    category,
  })
  if (!allowed) return { ok: false, error: 'No tienes permiso para escribir en esta categoría con esta familia.' }

  let conversationId: string
  try {
    conversationId = await getOrCreateConversation(admin, resolved.schoolId, familyId, category)
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

  // Best-effort: avisa por correo al tutor principal de que le llegó un
  // mensaje nuevo. No bloquea ni falla el envío si esto falla.
  const [{ data: school }, { data: guardians }] = await Promise.all([
    admin.from('schools').select('name').eq('id', resolved.schoolId).single(),
    admin
      .from('guardians')
      .select('email, is_primary')
      .eq('family_id', familyId)
      .order('is_primary', { ascending: false }),
  ])
  const recipient = (guardians ?? []).find((g) => g.email)
  if (recipient?.email) {
    await notifyGuardianByEmail({
      schoolName: school?.name ?? null,
      guardianEmail: recipient.email,
      subject: 'Tienes un mensaje nuevo del colegio',
      body: trimmed,
    })
  }

  revalidatePath(`/dashboard/mensajes/${familyId}/${category}`)
  revalidatePath('/dashboard/mensajes')
  return { ok: true }
}

export async function markStaffReadAction(familyId: string, category: MessageCategory): Promise<ActionResult> {
  const resolved = await resolveStaff()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  const allowed = await staffCanAccessFamilyCategory(admin, {
    schoolId: resolved.schoolId,
    role: resolved.role,
    staffId: resolved.staffId,
    familyId,
    category,
  })
  if (!allowed) return { ok: false, error: 'No tienes permiso para ver esta conversación.' }

  await admin
    .from('direct_conversations')
    .update({ staff_last_read_at: new Date().toISOString() })
    .eq('school_id', resolved.schoolId)
    .eq('family_id', familyId)
    .eq('category', category)

  revalidatePath('/dashboard/mensajes')
  return { ok: true }
}

