/**
 * Asistente de redacción para el personal del colegio -- reescribe un
 * borrador (comunicado o mensaje directo a una familia) con ortografía y
 * gramática correctas y tono profesional, sin inventar información nueva.
 *
 * Mismo patrón que answerFamilyQuestion.ts: fetch directo a la API de
 * Claude (Haiku, rápido y barato), sin SDK adicional.
 */

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_OUTPUT_TOKENS = 1024
const MAX_INPUT_LENGTH = 4000

export type DraftContext = 'comunicado' | 'mensaje_directo'

const CONTEXT_LABEL: Record<DraftContext, string> = {
  comunicado: 'un comunicado dirigido a todas las familias del colegio (o a un grupo de grados/secciones)',
  mensaje_directo: 'un mensaje directo dirigido a una familia específica, dentro de una conversación privada',
}

export type PolishResult =
  | { ok: true; polished: string }
  | { ok: false; error: string }

export async function polishStaffMessage(rawText: string, context: DraftContext): Promise<PolishResult> {
  const trimmed = rawText.trim()
  if (!trimmed) return { ok: false, error: 'Escribe un borrador primero.' }
  if (trimmed.length > MAX_INPUT_LENGTH) return { ok: false, error: 'El borrador es demasiado largo.' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'El asistente de redacción no está configurado (falta ANTHROPIC_API_KEY).' }

  const system = `Eres el asistente de redacción de un colegio en República Dominicana. Tu única tarea es reescribir el borrador que te da el personal del colegio para ${CONTEXT_LABEL[context]}.

Reglas estrictas:
- Corrige ortografía, gramática y puntuación.
- Usa un tono profesional pero cálido, propio de un colegio, en español de República Dominicana.
- NO inventes ni agregues información (fechas, nombres, montos, horarios) que no esté en el borrador.
- NO agregues saludos ni despedidas genéricas si el borrador no los tiene.
- Mantén el mensaje conciso -- no lo alargues innecesariamente.
- Responde ÚNICAMENTE con el texto reescrito. Sin comillas, sin explicaciones, sin comentarios.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: [{ role: 'user', content: trimmed }],
      }),
    })

    if (!res.ok) {
      console.error('[polishStaffMessage] Claude API error:', await res.text())
      return { ok: false, error: 'No se pudo mejorar la redacción. Intenta de nuevo.' }
    }

    const data = await res.json()
    const polished = data.content?.[0]?.text?.trim()
    if (!polished) return { ok: false, error: 'El asistente no devolvió ningún texto.' }

    return { ok: true, polished }
  } catch (err) {
    console.error('[polishStaffMessage] fetch error:', err)
    return { ok: false, error: 'No se pudo conectar con el asistente de redacción.' }
  }
}
