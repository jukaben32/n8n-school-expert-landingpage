import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Guarda el transcript completo de una llamada de voz ya terminada en
 * ai_conversations (channel='voice'), un insert por turno -- mismo
 * formato que ya usa answerFamilyQuestion() para el chat de texto, para
 * que ambos canales queden mezclables si algún día se necesita un solo
 * historial. Se llama una sola vez al colgar (el navegador acumula el
 * transcript en memoria durante la llamada vía WebRTC/data channel;
 * aquí no hay sesión "viva" con OpenAI de la que leer turno por turno).
 */

export interface VoiceCallTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface LogVoiceCallTranscriptInput {
  schoolId: string
  familyId: string
  guardianId: string
  turns: VoiceCallTurn[]
}

export async function logVoiceCallTranscript(input: LogVoiceCallTranscriptInput): Promise<{ ok: boolean; error?: string }> {
  const { schoolId, familyId, guardianId, turns } = input
  const cleaned = turns.filter((t) => t.content.trim().length > 0)
  if (cleaned.length === 0) return { ok: true }

  const admin = createAdminClient()
  const { error } = await admin.from('ai_conversations').insert(
    cleaned.map((t) => ({
      school_id: schoolId,
      family_id: familyId,
      guardian_id: guardianId,
      channel: 'voice' as const,
      role: t.role,
      content: t.content,
    }))
  )

  if (error) {
    console.error('[logVoiceCallTranscript] No se pudo guardar la llamada:', error.message)
    return { ok: false, error: 'No se pudo guardar el registro de la llamada.' }
  }
  return { ok: true }
}
