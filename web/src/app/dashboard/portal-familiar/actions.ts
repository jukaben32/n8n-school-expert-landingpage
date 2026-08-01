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
