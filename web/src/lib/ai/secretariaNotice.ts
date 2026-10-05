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
        description:
          'Nombre del hijo/a al que se refiere. OBLIGATORIO si la familia tiene más de un hijo ("toda la familia" si aplica a todos); si no sabes de cuál es, pregúntale a la familia antes de llamar la herramienta.',
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

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const WHOLE_FAMILY = /\b(toda la familia|todos|ambos|los dos)\b/
const FAMILY_SAYS_ALL = /\b(toda la familia|ambos|ambas|los dos|las dos|los tres|las tres|mis hijos|mis hijas|mis ninos|mis ninas)\b/

export interface StudentRef {
  fullName: string
  // Solo el nombre de pila: el apellido lo comparten los hermanos y no sirve para distinguirlos.
  givenName: string
}

export type StudentCheckResult = { ok: true } | { ok: false; error: string }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ¿La familia mencionó el nombre de pila de este hijo en lo que escribió?
function familyMentionedGivenName(student: StudentRef, familyText: string): boolean {
  const tokens = normalizeName(student.givenName)
    .split(' ')
    .filter((token) => token.length >= 3)
  if (tokens.length === 0) return true // sin nombre de pila usable no se puede comprobar: no se bloquea
  const text = normalizeName(familyText)
  return tokens.some((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text))
}

/**
 * Con una familia de varios hijos, un aviso sin saber de cuál es obliga a la secretaría a adivinar.
 * La prueba con Claude real mostró dos cosas: el modelo a veces no pregunta aunque el prompt se lo pida,
 * y cuando no sabe de cuál es, ADIVINA (elegía siempre al primer hijo, y una vez avisó por los dos).
 * Por eso se exige por código, no por prompt:
 *   1. el aviso debe nombrar a un hijo de la familia (o decir "toda la familia");
 *   2. el nombre de pila de ese hijo debe aparecer en lo que la familia escribió (`familyText`).
 * Si no se cumple, la herramienta devuelve un error que le dice al modelo que le pregunte a la familia.
 * Con un solo hijo no se pide nada. `familyText` son SOLO los mensajes de la familia, nunca los del asistente
 * (que podrían nombrar a un hijo sin que la familia lo haya dicho).
 */
export function checkNoticeStudent(notice: SecretariaNotice, students: StudentRef[], familyText: string): StudentCheckResult {
  if (students.length <= 1) return { ok: true }
  // Si la propia familia dijo que es para todos ("los dos", "ambos"), no hay a quién preguntarle: es de toda
  // la familia. Sin esto el asistente le volvía a preguntar a la madre algo que ya había dicho. A propósito NO
  // se incluye "todos" aquí (podría ser "todos los uniformes"); solo en el campo estudiante que escribe el modelo.
  if (FAMILY_SAYS_ALL.test(normalizeName(familyText))) return { ok: true }

  const list = students.map((s) => s.fullName).join(', ')
  const given = notice.student ? normalizeName(notice.student) : ''
  if (!given) {
    return {
      ok: false,
      error:
        `La familia tiene ${students.length} hijos (${list}) y no dijiste de cuál es el aviso. ` +
        'Pregúntale a la familia a cuál se refiere y llama de nuevo la herramienta con ese nombre; ' +
        'si es de toda la familia, escribe "toda la familia" en el campo estudiante.',
    }
  }
  if (WHOLE_FAMILY.test(given)) return { ok: true }

  const matched =
    given.length >= 3
      ? students.find((s) => {
          const n = normalizeName(s.fullName)
          return n.includes(given) || given.includes(n)
        })
      : undefined
  if (!matched) {
    return {
      ok: false,
      error: `"${notice.student}" no coincide con ningún hijo de esta familia (${list}). Usa el nombre exacto de uno de ellos.`,
    }
  }

  if (!familyMentionedGivenName(matched, familyText)) {
    return {
      ok: false,
      error:
        `La familia todavía no ha dicho de cuál hijo habla: no lo supongas ni elijas el primero. ` +
        `Pregúntale cuál es (${list}) y llama de nuevo la herramienta con el nombre que te confirme.`,
    }
  }
  return { ok: true }
}

// Aviso que deja el servidor cuando el asistente prometió avisar y no generó el resumen él mismo.
export const FALLBACK_NOTICE: SecretariaNotice = {
  kind: 'aviso',
  student: null,
  summary: 'El asistente le confirmó a la familia que quedaba constancia, pero no redactó un resumen. Revise el mensaje original.',
}
