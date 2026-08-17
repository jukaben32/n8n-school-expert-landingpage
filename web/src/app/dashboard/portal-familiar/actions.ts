'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { answerFamilyQuestion } from '@/lib/ai/answerFamilyQuestion'
import { transcribeAudio } from '@/lib/ai/transcribeAudio'
import { startVoiceCallSession } from '@/lib/ai/startVoiceCallSession'
import { logVoiceCallTranscript, type VoiceCallTurn } from '@/lib/ai/logVoiceCallTranscript'
import { resolveGuardianIdentity } from '@/lib/auth/resolveGuardianIdentity'

interface ChatResult {
  ok: boolean
  reply?: string
  error?: string
}

interface VoiceChatResult extends ChatResult {
  transcript?: string
}

interface VoiceCallSessionResult {
  ok: boolean
  clientSecret?: string
  expiresAt?: number
  model?: string
  error?: string
}

export async function sendFamilyChatMessage(message: string): Promise<ChatResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const result = await answerFamilyQuestion({
    schoolId: identity.schoolId,
    familyId: identity.familyId,
    guardianId: identity.guardianId,
    channel: 'widget',
    message,
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, reply: result.reply }
}

/**
 * Recibe el audio grabado en el navegador (MediaRecorder), lo transcribe,
 * y reutiliza sendFamilyChatMessage tal cual con el texto resultante --
 * no duplica resolución de identidad, límite diario ni la llamada al
 * "cerebro": es la misma tubería del chat de texto, con un paso de
 * transcripción antes.
 */
export async function sendFamilyVoiceMessage(formData: FormData): Promise<VoiceChatResult> {
  const file = formData.get('audio')
  if (!(file instanceof File)) {
    return { ok: false, error: 'No se recibió ningún audio.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const transcription = await transcribeAudio(buffer, file.type || 'audio/webm', file.name || 'audio.webm')
  if (!transcription.ok) return { ok: false, error: transcription.error }

  const chatResult = await sendFamilyChatMessage(transcription.text)
  return { ...chatResult, transcript: transcription.text }
}

export async function getFamilyChatHistory(): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_conversations')
    .select('role, content')
    .eq('family_id', identity.familyId)
    .eq('channel', 'widget')
    .order('created_at', { ascending: true })
    .limit(30)

  return (data ?? []) as { role: 'user' | 'assistant'; content: string }[]
}

/**
 * Arranca la llamada de voz en vivo: resuelve la identidad del guardian
 * (único lugar de este flujo que toca la sesión) y delega en
 * startVoiceCallSession() para el resto -- mismo patrón que
 * sendFamilyChatMessage con answerFamilyQuestion(). El navegador llama a
 * esta Server Action directamente desde el hook de WebRTC (useFamilyVoiceCall),
 * igual que ya hace FamilyChatWidget con sendFamilyChatMessage.
 */
export async function startFamilyVoiceCallSession(): Promise<VoiceCallSessionResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const result = await startVoiceCallSession({ schoolId: identity.schoolId, familyId: identity.familyId })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, clientSecret: result.clientSecret, expiresAt: result.expiresAt, model: result.model }
}

/**
 * Guarda el transcript de la llamada al colgar. Vuelve a resolver la
 * identidad del guardian en vez de confiar en un familyId que mandara
 * el cliente -- así un guardian nunca puede escribir un log a nombre de
 * otra familia aunque manipule la petición.
 */
export async function logFamilyVoiceCall(turns: VoiceCallTurn[]): Promise<{ ok: boolean; error?: string }> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  return logVoiceCallTranscript({
    schoolId: identity.schoolId,
    familyId: identity.familyId,
    guardianId: identity.guardianId,
    turns,
  })
}

interface DirectMessageRow {
  id: string
  sender_type: 'guardian' | 'staff'
  body: string
  created_at: string
}

interface DirectMessagesResult {
  ok: boolean
  messages?: DirectMessageRow[]
  error?: string
}

async function getOrCreateFamilyConversation(admin: ReturnType<typeof createAdminClient>, schoolId: string, familyId: string) {
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

/**
 * Mensajería directa de dos vías con el colegio -- distinta del asistente
 * de IA: acá hay un humano (profesor/dirección/recepción) del otro lado.
 * Una sola conversación por familia (get-or-create), igual que su
 * contraparte en dashboard/mensajes/actions.ts para el lado del staff.
 */
export async function getFamilyDirectMessages(): Promise<DirectMessagesResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const admin = createAdminClient()
  const conversationId = await getOrCreateFamilyConversation(admin, identity.schoolId, identity.familyId).catch(() => null)
  if (!conversationId) return { ok: true, messages: [] }

  await admin.from('direct_conversations').update({ guardian_last_read_at: new Date().toISOString() }).eq('id', conversationId)

  const { data, error } = await admin
    .from('direct_messages')
    .select('id, sender_type, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) return { ok: false, error: 'No se pudieron cargar los mensajes.' }

  return { ok: true, messages: (data ?? []) as DirectMessageRow[] }
}

export async function sendFamilyDirectMessage(body: string): Promise<{ ok: boolean; error?: string }> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: 'Escribe un mensaje.' }

  const admin = createAdminClient()
  let conversationId: string
  try {
    conversationId = await getOrCreateFamilyConversation(admin, identity.schoolId, identity.familyId)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo abrir la conversación.' }
  }

  const { data: guardianProfile } = await admin
    .from('users_profiles')
    .select('id')
    .eq('guardian_id', identity.guardianId)
    .single()
  if (!guardianProfile) return { ok: false, error: 'No se encontró tu perfil.' }

  const now = new Date().toISOString()
  const { error: insertError } = await admin.from('direct_messages').insert({
    conversation_id: conversationId,
    sender_type: 'guardian',
    sender_profile_id: guardianProfile.id,
    body: trimmed,
  })
  if (insertError) return { ok: false, error: 'No se pudo enviar el mensaje.' }

  await admin.from('direct_conversations').update({ last_message_at: now, guardian_last_read_at: now }).eq('id', conversationId)

  return { ok: true }
}
