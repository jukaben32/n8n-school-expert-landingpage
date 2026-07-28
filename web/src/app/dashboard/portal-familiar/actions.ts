'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { answerFamilyQuestion } from '@/lib/ai/answerFamilyQuestion'
import { transcribeAudio } from '@/lib/ai/transcribeAudio'

interface ChatResult {
  ok: boolean
  reply?: string
  error?: string
}

interface VoiceChatResult extends ChatResult {
  transcript?: string
}

/**
 * Resuelve la identidad del guardian autenticado (schoolId/familyId/
 * guardianId) desde la sesión, y solo entonces delega en el "cerebro"
 * compartido (answerFamilyQuestion) -- que en sí mismo no sabe nada de
 * cookies ni de Next.js. Este es el único lugar de la Fase 1 donde se
 * toca la sesión.
 */
async function resolveGuardianIdentity() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, guardian_id, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'guardian' || !profile.guardian_id) {
    return { ok: false as const, error: 'Solo disponible para tutores/padres de familia.' }
  }

  // Se usa el cliente admin (no RLS) para resolver family_id, siguiendo
  // el mismo principio de filtrado explícito que answerFamilyQuestion:
  // no se confía únicamente en RLS para el aislamiento de datos.
  const admin = createAdminClient()
  const { data: guardian } = await admin
    .from('guardians')
    .select('family_id')
    .eq('id', profile.guardian_id)
    .eq('school_id', profile.school_id)
    .single()

  if (!guardian) return { ok: false as const, error: 'No se encontró tu ficha de tutor.' }

  return {
    ok: true as const,
    schoolId: profile.school_id as string,
    familyId: guardian.family_id as string,
    guardianId: profile.guardian_id as string,
  }
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
