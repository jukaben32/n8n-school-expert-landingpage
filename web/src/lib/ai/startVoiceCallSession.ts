import { createAdminClient } from '@/lib/supabase/admin'
import { buildPortalBrandLine, getSchoolOrPlatformName } from '@/lib/branding'
import { checkDailyLimit, gatherFamilyContext } from './answerFamilyQuestion'

/**
 * Llamada de voz en vivo del asistente de Portal Familiar -- WebRTC en
 * tiempo real contra la Realtime API de OpenAI, distinto de la nota de
 * voz grabada (transcribeAudio.ts, turno por turno). Sigue el mismo
 * principio "un solo cerebro" que answerFamilyQuestion.ts: no lee
 * cookies/sesión, recibe la identidad ya resuelta, y reutiliza
 * gatherFamilyContext() para no duplicar las 5 consultas de contexto
 * familiar ni arriesgarse a que las dos vías (chat y voz) muestren datos
 * distintos.
 *
 * Endpoints verificados contra la API real de OpenAI el 2026-08-01 (no
 * de memoria/documentación vieja): OpenAI retiró la API beta de
 * Realtime. `/v1/realtime/sessions` y `/v1/realtime` (WebRTC) devuelven
 * 404/400 "beta_api_shape_disabled" -- el reemplazo GA es
 * `/v1/realtime/client_secrets` (para el token efímero, con la config
 * anidada bajo `session`, voz en `session.audio.output.voice`) y
 * `/v1/realtime/calls` (para el intercambio SDP de WebRTC, ya sin
 * `?model=` porque el modelo queda fijado en el token efímero).
 */

const MODEL = 'gpt-realtime'
const VOICE = 'alloy'

export type StartVoiceCallSessionResult =
  | { ok: true; clientSecret: string; expiresAt: number; model: string }
  | { ok: false; error: string }

export interface StartVoiceCallSessionInput {
  schoolId: string
  familyId: string
}

export async function startVoiceCallSession(input: StartVoiceCallSessionInput): Promise<StartVoiceCallSessionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'La llamada de voz no está configurada (falta OPENAI_API_KEY).' }
  }

  const admin = createAdminClient()
  const { schoolId, familyId } = input

  // Mismo tope de 30 turnos/24h que el chat de texto y la nota de voz --
  // los tres canales escriben en ai_conversations con role='user', así
  // que cuentan contra el mismo límite. Una sola llamada puede generar
  // varios turnos de una vez (aceptado para esta primera versión, ver
  // AGENTS.md si hace falta revisarlo).
  const limitCheck = await checkDailyLimit(admin, familyId)
  if (!limitCheck.ok) return limitCheck

  const context = await gatherFamilyContext(admin, schoolId, familyId)
  if (!context.ok) return { ok: false, error: context.error }

  const instructions = buildVoiceInstructions(getSchoolOrPlatformName(context.schoolName), context.contextText)

  let openaiResponse: Response
  try {
    openaiResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: MODEL,
          instructions,
          audio: {
            output: { voice: VOICE },
            input: {
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          },
        },
      }),
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error de red'
    return { ok: false, error: `No se pudo contactar la Realtime API de OpenAI: ${detail}` }
  }

  if (!openaiResponse.ok) {
    const body = await openaiResponse.text().catch(() => '')
    return { ok: false, error: `OpenAI Realtime respondió ${openaiResponse.status}: ${body.slice(0, 300)}` }
  }

  const session = (await openaiResponse.json()) as { value?: string; expires_at?: number }
  if (!session.value) {
    return { ok: false, error: 'OpenAI no devolvió un token de sesión válido.' }
  }

  return { ok: true, clientSecret: session.value, expiresAt: session.expires_at ?? 0, model: MODEL }
}

function buildVoiceInstructions(schoolName: string, contextText: string): string {
  return `Eres el asistente de voz del Portal Familiar de ${buildPortalBrandLine(schoolName)}. Estás en una llamada telefónica en vivo con un padre/madre/tutor -- responde de forma breve, cálida y conversacional (esto es una llamada, no un chat escrito).

Reglas estrictas:
1. Solo puedes usar la información de la sección "DATOS DE LA FAMILIA" de abajo. No inventes datos que no estén ahí.
2. Nunca reveles, menciones ni compares con datos de otras familias, otros estudiantes o de otros colegios -- no tienes acceso a esa información y debes decir que no puedes ayudar con eso si te la piden.
3. No das consejos médicos, legales ni psicológicos -- para eso remite al colegio directamente.
4. Si la pregunta no se puede responder con los datos disponibles, dilo claramente y sugiere contactar a la secretaría del colegio.
5. Habla siempre en español.

DATOS DE LA FAMILIA:
${contextText}`
}
