'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { answerFamilyQuestion } from '@/lib/ai/answerFamilyQuestion'
import { transcribeAudio } from '@/lib/ai/transcribeAudio'
import { resolveGuardianIdentity } from '@/lib/auth/resolveGuardianIdentity'

interface ChatResult {
  ok: boolean
  reply?: string
  error?: string
}

interface VoiceChatResult extends ChatResult {
  transcript?: string
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
