/**
 * Núcleo reutilizable de transcripción de audio -- mismo principio que
 * answerFamilyQuestion.ts: no depende de sesión ni de Next.js, recibe
 * bytes de audio y devuelve texto. Así, si más adelante WhatsApp/Twilio
 * necesita transcribir notas de voz (Fase 2, ver sección del asistente de
 * IA en AGENTS.md), reutiliza esta misma función sin cambios.
 *
 * Proveedor: OpenAI, modelo `gpt-4o-mini-transcribe` -- confirmado en la
 * documentación oficial (developers.openai.com/api/docs/guides/speech-to-text)
 * el 2026-07-28, no de memoria. Es el modelo de transcripción más barato
 * de OpenAI (~$0.003/min) que sigue aceptando `webm`/`m4a` directo (los
 * formatos que produce `MediaRecorder` en Chrome y Safari respectivamente),
 * sin necesitar conversión de formato de por medio.
 */

const MODEL = 'gpt-4o-mini-transcribe'
const MAX_AUDIO_BYTES = 10 * 1024 * 1024 // 10MB -- muy por debajo del límite de 25MB de OpenAI; control de costo/abuso, no una limitación técnica real.
const MIN_AUDIO_BYTES = 1024 // ~debajo de esto, es ruido/silencio, no una grabación real.

export type TranscribeAudioResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

export async function transcribeAudio(audio: Buffer, mimeType: string, filename: string): Promise<TranscribeAudioResult> {
  if (audio.byteLength < MIN_AUDIO_BYTES) {
    return { ok: false, error: 'La grabación está vacía o es demasiado corta.' }
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return { ok: false, error: 'La grabación es demasiado larga.' }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'La transcripción de audio no está configurada (falta OPENAI_API_KEY).' }
  }

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), filename)
  form.append('model', MODEL)

  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error de red'
    return { ok: false, error: `No se pudo contactar el servicio de transcripción: ${detail}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, error: `El servicio de transcripción respondió ${res.status}: ${body.slice(0, 300)}` }
  }

  const data = (await res.json()) as { text?: string }
  const text = data.text?.trim()
  if (!text) {
    return { ok: false, error: 'No se detectó ningún texto en la grabación.' }
  }

  return { ok: true, text }
}
