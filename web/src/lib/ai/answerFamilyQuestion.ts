import { createAdminClient } from '@/lib/supabase/admin'
import { buildPortalBrandLine, getSchoolOrPlatformName } from '@/lib/branding'

/**
 * "Un solo cerebro, dos salidas" — núcleo del asistente de IA de MentorIApp.
 *
 * Esta función NO lee cookies ni sesión de Next.js -- recibe la identidad
 * ya resuelta (schoolId/familyId/guardianId) por quien la llama. Eso es
 * intencional: el widget de Portal Familiar (Fase 1, este archivo) la
 * llama después de resolver la sesión con el cliente normal de Supabase;
 * un futuro webhook de WhatsApp (Fase 2, no construido todavía -- ver
 * AGENTS.md) la llamará igual, después de resolver phone -> guardian_id
 * -> family_id manualmente, sin sesión de Supabase alguna.
 *
 * Aislamiento de datos como defensa en profundidad: usa SIEMPRE el
 * cliente `service_role` (nunca RLS) y filtra explícitamente por
 * family_id/school_id en cada consulta -- así el mismo código es
 * igual de seguro con sesión (Fase 1) que sin ella (Fase 2).
 */

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_OUTPUT_TOKENS = 1024
const MAX_MESSAGE_LENGTH = 2000
const DAILY_MESSAGE_LIMIT = 30
const HISTORY_TURNS = 8
const ANONYMOUS_DAILY_LIMIT = 15

/**
 * Límite de 30 turnos de usuario por familia cada 24h (ventana móvil),
 * compartido por todos los canales que escriben en ai_conversations
 * (chat de texto, nota de voz transcrita, y la llamada en vivo de
 * voiceCallSession.ts) -- cuentan contra el mismo tope porque todos
 * insertan aquí con role='user'. Exportado para no duplicar esta
 * consulta en cada núcleo nuevo.
 */
export async function checkDailyLimit(admin: ReturnType<typeof createAdminClient>, familyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: usageCount, error: usageError } = await admin
    .from('ai_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('role', 'user')
    .gte('created_at', since)

  if (usageError) {
    return { ok: false, error: 'No se pudo verificar el límite de uso del asistente.' }
  }
  if ((usageCount ?? 0) >= DAILY_MESSAGE_LIMIT) {
    return { ok: false, error: `Se alcanzó el límite de ${DAILY_MESSAGE_LIMIT} preguntas por día para esta familia. Intenta de nuevo mañana.` }
  }
  return { ok: true }
}

export type ChatChannel = 'widget' | 'whatsapp'

export interface AnswerFamilyQuestionInput {
  schoolId: string
  familyId: string
  guardianId: string
  channel: ChatChannel
  message: string
}

export type AnswerFamilyQuestionResult =
  | { ok: true; reply: string }
  | { ok: false; error: string }

export async function answerFamilyQuestion(input: AnswerFamilyQuestionInput): Promise<AnswerFamilyQuestionResult> {
  const message = input.message.trim()
  if (!message) {
    return { ok: false, error: 'El mensaje está vacío.' }
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: 'El mensaje es demasiado largo.' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'El asistente no está configurado (falta ANTHROPIC_API_KEY).' }
  }

  const admin = createAdminClient()
  const { schoolId, familyId, guardianId, channel } = input

  // ── Límite de uso: máximo DAILY_MESSAGE_LIMIT preguntas por familia en
  // las últimas 24 horas (ventana móvil, no "día calendario", para no
  // depender de la zona horaria del colegio). Cuenta solo turnos del
  // usuario, no las respuestas del asistente.
  const limitCheck = await checkDailyLimit(admin, familyId)
  if (!limitCheck.ok) return limitCheck

  const [context, history] = await Promise.all([
    gatherFamilyContext(admin, schoolId, familyId),
    fetchRecentHistory(admin, familyId, channel),
  ])

  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const systemPrompt = buildSystemPrompt(context.schoolName, context.contextText)

  let reply: string
  try {
    reply = await callClaude(apiKey, systemPrompt, [...history, { role: 'user', content: message }])
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error desconocido'
    return { ok: false, error: `No se pudo obtener respuesta del asistente: ${detail}` }
  }

  const { error: insertError } = await admin.from('ai_conversations').insert([
    { school_id: schoolId, family_id: familyId, guardian_id: guardianId, channel, role: 'user', content: message },
    { school_id: schoolId, family_id: familyId, guardian_id: guardianId, channel, role: 'assistant', content: reply },
  ])
  if (insertError) {
    // La respuesta ya se generó -- se devuelve igual, pero sin quedar
    // guardada en el historial. No tiene sentido perder la respuesta
    // por un fallo al guardar el log de la conversación.
    console.error('[answerFamilyQuestion] No se pudo guardar la conversación:', insertError.message)
  }

  return { ok: true, reply }
}

// "Modo recepción general" -- para cuando el webhook de WhatsApp no pudo
// identificar el número como el de una familia registrada (ver
// resolveGuardianByPhone.ts). A propósito NUNCA recibe family_id ni
// guardian_id, así que no hay forma de que termine mezclando datos de una
// familia -- solo puede usar información pública del colegio (faq_document,
// contacto). Sin historial de conversación (una sola respuesta por
// mensaje): no hay ninguna familia dueña de ese historial para poder
// guardarlo con las mismas garantías de privacidad que ai_conversations.
export interface AnswerGeneralQuestionInput {
  schoolId: string
  phone: string
  message: string
}

export async function answerGeneralQuestion(input: AnswerGeneralQuestionInput): Promise<AnswerFamilyQuestionResult> {
  const message = input.message.trim()
  if (!message) {
    return { ok: false, error: 'El mensaje está vacío.' }
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: 'El mensaje es demasiado largo.' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'El asistente no está configurado (falta ANTHROPIC_API_KEY).' }
  }

  const admin = createAdminClient()
  const { schoolId, phone } = input

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: usageCount, error: usageError } = await admin
    .from('whatsapp_anonymous_messages')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('phone', phone)
    .gte('created_at', since)
  if (usageError) {
    return { ok: false, error: 'No se pudo verificar el límite de uso.' }
  }
  if ((usageCount ?? 0) >= ANONYMOUS_DAILY_LIMIT) {
    return { ok: false, error: `Se alcanzó el límite de ${ANONYMOUS_DAILY_LIMIT} mensajes por día para este número. Intenta de nuevo mañana, o contacta a la secretaría del colegio.` }
  }

  const { data: school, error: schoolError } = await admin
    .from('schools')
    .select('name, faq_document, address, phone, email')
    .eq('id', schoolId)
    .single()
  if (schoolError || !school) {
    return { ok: false, error: 'No se encontró el colegio.' }
  }

  const schoolName = getSchoolOrPlatformName(school.name)
  const contactText = [school.address, school.phone, school.email].filter(Boolean).join(' · ')
  const systemPrompt = `Eres el asistente de recepción de ${schoolName}, contestando por WhatsApp a alguien que NO está identificado como padre/madre/tutor de una familia ya registrada en el colegio.

Reglas estrictas:
1. Solo puedes usar la información de la sección "INFORMACIÓN PÚBLICA DEL COLEGIO" de abajo. No inventes datos que no estén ahí.
2. NUNCA tienes acceso a datos de ninguna familia, estudiante, pago o asistencia específicos -- no existen en tu contexto. Si te preguntan por el estado de un estudiante, una factura, o cualquier cosa específica de una familia, responde que para eso necesitan entrar al Portal Familiar con su cuenta, o contactar a la secretaría del colegio directamente.
3. Si parece un padre/madre interesado en matricular a su hijo/a, sé cálido y útil con información general (horarios, proceso de admisión si está en la info de abajo), y sugiere dejar sus datos en el sitio web del colegio o contactar a la secretaría para continuar.
4. No das consejos médicos, legales ni psicológicos.
5. Responde en español, de forma breve, cálida y profesional.

INFORMACIÓN PÚBLICA DEL COLEGIO:
Colegio: ${schoolName}
${contactText ? `Contacto: ${contactText}` : ''}
${school.faq_document ? `\nPreguntas frecuentes y políticas generales:\n${school.faq_document}` : 'No hay preguntas frecuentes cargadas todavía.'}`

  let reply: string
  try {
    reply = await callClaude(apiKey, systemPrompt, [{ role: 'user', content: message }])
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error desconocido'
    return { ok: false, error: `No se pudo obtener respuesta del asistente: ${detail}` }
  }

  const { error: logError } = await admin.from('whatsapp_anonymous_messages').insert({ school_id: schoolId, phone })
  if (logError) {
    console.error('[answerGeneralQuestion] No se pudo registrar el uso:', logError.message)
  }

  return { ok: true, reply }
}

type AdminClient = ReturnType<typeof createAdminClient>

async function fetchRecentHistory(admin: AdminClient, familyId: string, channel: ChatChannel) {
  const { data } = await admin
    .from('ai_conversations')
    .select('role, content')
    .eq('family_id', familyId)
    .eq('channel', channel)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS)

  const rows = (data ?? []) as { role: 'user' | 'assistant'; content: string }[]
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }))
}

export interface FamilyContext {
  ok: true
  schoolName: string
  contextText: string
}
export interface FamilyContextError {
  ok: false
  error: string
}

// Exportada para que voiceCallSession.ts arme las mismas "instructions"
// que el chat de texto sin repetir estas 5 consultas.
export async function gatherFamilyContext(admin: AdminClient, schoolId: string, familyId: string): Promise<FamilyContext | FamilyContextError> {
  const [schoolRes, familyRes, studentsRes, invoicesRes, messagesRes] = await Promise.all([
    admin.from('schools').select('name, faq_document').eq('id', schoolId).single(),
    admin.from('families').select('name').eq('id', familyId).eq('school_id', schoolId).single(),
    admin
      .from('students')
      .select('id, first_name, last_name, birth_date, enrollment_status')
      .eq('family_id', familyId)
      .eq('school_id', schoolId)
      .is('deleted_at', null),
    admin
      .from('invoices')
      .select('description, amount, total_amount, discount_amount, due_date, status')
      .eq('family_id', familyId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('due_date', { ascending: false })
      .limit(10),
    admin
      .from('messages')
      .select('title, body, priority, published_at')
      .eq('school_id', schoolId)
      .eq('audience_type', 'all')
      .not('published_at', 'is', null)
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(5),
  ])

  if (familyRes.error || !familyRes.data) {
    return { ok: false, error: 'No se encontró la familia.' }
  }

  const studentIds = (studentsRes.data ?? []).map((s) => s.id)
  const { data: attendanceRows } = studentIds.length
    ? await admin
        .from('attendance')
        .select('student_id, date, status')
        .in('student_id', studentIds)
        .order('date', { ascending: false })
        .limit(30)
    : { data: [] as { student_id: string; date: string; status: string }[] }

  const schoolName = getSchoolOrPlatformName(schoolRes.data?.name)

  const studentsText = (studentsRes.data ?? [])
    .map((s) => `- ${s.first_name} ${s.last_name} (nacimiento: ${s.birth_date}, estado de matrícula: ${s.enrollment_status})`)
    .join('\n') || 'No hay estudiantes registrados en esta familia.'

  const studentNameById = new Map((studentsRes.data ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]))
  const attendanceText = (attendanceRows ?? [])
    .slice(0, 15)
    .map((a) => `- ${studentNameById.get(a.student_id) ?? 'estudiante'}: ${a.date} — ${a.status}`)
    .join('\n') || 'No hay registros de asistencia recientes.'

  const invoicesText = (invoicesRes.data ?? [])
    .map((i) => `- ${i.description}: total ${i.total_amount} DOP (descuento: ${i.discount_amount} DOP), vence ${i.due_date}, estado: ${i.status}`)
    .join('\n') || 'No hay facturas registradas.'

  const messagesText = (messagesRes.data ?? [])
    .map((m) => `- [${m.priority}] ${m.title}: ${m.body}`)
    .join('\n') || 'No hay comunicados recientes.'

  const contextText = `Colegio: ${schoolName}
Familia: ${familyRes.data.name}

Hijos de esta familia:
${studentsText}

Asistencia reciente (últimos registros):
${attendanceText}

Facturas de esta familia:
${invoicesText}

Últimos comunicados generales del colegio:
${messagesText}${schoolRes.data?.faq_document ? `\n\nPreguntas frecuentes y políticas generales del colegio (aplican a todas las familias):\n${schoolRes.data.faq_document}` : ''}`

  return { ok: true, schoolName, contextText }
}

function buildSystemPrompt(schoolName: string, contextText: string): string {
  return `Eres el asistente virtual del Portal Familiar de ${buildPortalBrandLine(schoolName)}.

Hablas con un padre/madre/tutor sobre SU PROPIA familia. Reglas estrictas:
1. Solo puedes usar la información de la sección "DATOS DE LA FAMILIA" de abajo. No inventes datos que no estén ahí.
2. Nunca reveles, menciones ni compares con datos de otras familias, otros estudiantes o de otros colegios -- no tienes acceso a esa información y debes decir que no puedes ayudar con eso si te la piden.
3. No das consejos médicos, legales ni psicológicos -- para eso remite al colegio directamente.
4. Si la pregunta no se puede responder con los datos disponibles, dilo claramente y sugiere contactar a la secretaría del colegio.
5. Responde en español, de forma breve, cálida y profesional.
6. La sección "Preguntas frecuentes y políticas generales del colegio" (si aparece más abajo) es información pública del colegio, igual para todas las familias -- úsala para preguntas de horarios, uniforme, reglas, etc. No la confundas con los datos privados de esta familia en particular.

DATOS DE LA FAMILIA:
${contextText}`
}

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

async function callClaude(apiKey: string, system: string, messages: ChatTurn[]): Promise<string> {
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
      messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic API respondió ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const text = data.content?.find((block) => block.type === 'text')?.text
  if (!text) {
    throw new Error('Respuesta del modelo sin contenido de texto.')
  }
  return text
}
