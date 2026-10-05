/**
 * Aviso del asistente de IA hacia la secretaría del colegio.
 *
 * Módulo PURO a propósito (sin Supabase ni Next.js): así se puede probar con
 * `scripts/test-secretaria-notice.mjs` sin tocar ninguna base ni API.
 *
 * El aviso llega a la secretaría como un mensaje directo de la familia (ver
 * deliverSecretariaNotice.ts), que es la bandeja que ya usa a diario.
 */

export const SECRETARIA_NOTICE_KINDS = ['aviso', 'solicitud'] as const
export type SecretariaNoticeKind = (typeof SECRETARIA_NOTICE_KINDS)[number]

export interface SecretariaNotice {
  kind: SecretariaNoticeKind
  student: string | null
  summary: string
}

export type ParseNoticeResult =
  | { ok: true; notice: SecretariaNotice }
  | { ok: false; error: string }

const MAX_SUMMARY_LENGTH = 600
const MAX_STUDENT_LENGTH = 120
const MAX_ORIGINAL_LENGTH = 500

const KIND_LABELS: Record<SecretariaNoticeKind, string> = {
  aviso: 'Aviso de la familia',
  solicitud: 'Solicitud de la familia',
}

export const SECRETARIA_TOOL_NAME = 'avisar_secretaria'

// Definición de la herramienta en el formato de la API de Anthropic.
export const SECRETARIA_TOOL = {
  name: SECRETARIA_TOOL_NAME,
  description:
    'Deja constancia en la bandeja de Mensajes de la secretaría del colegio. Úsala cuando la familia ' +
    'AVISE algo que el colegio debe saber (uniforme, llegada tarde, ausencia, quién recoge al niño) o ' +
    'pida algo que solo una persona puede resolver (cartas, certificaciones, excepciones, acuerdos de pago, ' +
    'cambios de datos). No la uses para preguntas que puedes responder tú con la información que tienes.',
  input_schema: {
    type: 'object',
    properties: {
      tipo: {
        type: 'string',
        enum: [...SECRETARIA_NOTICE_KINDS],
        description: '"aviso" si la familia solo informa algo; "solicitud" si pide que alguien haga algo.',
      },
      estudiante: {
        type: 'string',
        description: 'Nombre del hijo/a al que se refiere, si aplica. Omítelo si es de toda la familia.',
      },
      resumen: {
        type: 'string',
        description: 'Qué pasó o qué se pide, en 1 a 3 frases claras, con los detalles necesarios (fechas, motivo).',
      },
    },
    required: ['tipo', 'resumen'],
  },
} as const

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

// Valida lo que el modelo mandó a la herramienta: es entrada externa, nunca se asume bien formada.
export function parseSecretariaNotice(input: unknown): ParseNoticeResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'La herramienta recibió datos inválidos.' }
  }
  const raw = input as Record<string, unknown>

  const kind = SECRETARIA_NOTICE_KINDS.find((k) => k === raw.tipo)
  if (!kind) {
    return { ok: false, error: 'El campo "tipo" debe ser "aviso" o "solicitud".' }
  }

  const summary = cleanString(raw.resumen)
  if (!summary) {
    return { ok: false, error: 'Falta el "resumen" del aviso.' }
  }

  const student = cleanString(raw.estudiante).slice(0, MAX_STUDENT_LENGTH)
  return {
    ok: true,
    notice: { kind, student: student || null, summary: summary.slice(0, MAX_SUMMARY_LENGTH) },
  }
}

// Texto que verá la secretaría. Incluye el mensaje ORIGINAL de la familia (lo pone el servidor, no el
// modelo) para que nadie tenga que fiarse solo del resumen que escribió la IA.
export function buildSecretariaMessageBody(notice: SecretariaNotice, channelLabel: string, originalMessage: string): string {
  const original = originalMessage.replace(/\s+/g, ' ').trim().slice(0, MAX_ORIGINAL_LENGTH)
  const lines = [
    `🤖 ${KIND_LABELS[notice.kind]} (registrado por el asistente virtual)`,
    notice.student ? `Estudiante: ${notice.student}` : null,
    notice.summary,
    original ? `Mensaje original (${channelLabel}): «${original}»` : null,
  ]
  return lines.filter((line): line is string => line !== null).join('\n')
}

// Frases con las que el asistente le dice a la familia que dejó (o va a dejar) constancia en la secretaría.
// Es una RED DE SEGURIDAD, no el mecanismo principal: la prueba con Claude real mostró que a veces el
// modelo escribe "queda constancia en la secretaría" sin haber llamado a la herramienta. El servidor lo
// detecta para que lo que se le dice a la familia sea siempre cierto. Prefiere sobre-detectar (un aviso
// de más a la secretaría) a dejar pasar una promesa falsa.
const NEGATED_CLAIM = /\bno\s+(pude|puedo|he\s+podido|se\s+pudo|logr)/i
const DIRECT_CLAIM =
  /\b(queda(n)?\s+constancia|dej[eé]\s+constancia|constancia\s+de\s+(este|su|ese|esto)|ya\s+(le\s+)?avis|avis[eé]\b|voy\s+a\s+avisar|avisad[oa]\b)/i
const SECRETARIA_CLAIM = /secretar[ií]a/i
const REGISTERED_WORD = /\b(registrad[oa]|anotad[oa]|notificad[oa]|informad[oa]|enterad[oa])\b/i

export function claimsNoticeWasRegistered(reply: string): boolean {
  if (NEGATED_CLAIM.test(reply)) return false
  if (DIRECT_CLAIM.test(reply)) return true
  return SECRETARIA_CLAIM.test(reply) && REGISTERED_WORD.test(reply)
}

// Aviso que deja el servidor cuando el asistente prometió avisar y no generó el resumen él mismo.
export const FALLBACK_NOTICE: SecretariaNotice = {
  kind: 'aviso',
  student: null,
  summary: 'El asistente le confirmó a la familia que quedaba constancia, pero no redactó un resumen. Revise el mensaje original.',
}
