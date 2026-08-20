'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { answerFamilyQuestion } from '@/lib/ai/answerFamilyQuestion'
import { transcribeAudio } from '@/lib/ai/transcribeAudio'
import { startVoiceCallSession } from '@/lib/ai/startVoiceCallSession'
import { logVoiceCallTranscript, type VoiceCallTurn } from '@/lib/ai/logVoiceCallTranscript'
import { resolveGuardianIdentity } from '@/lib/auth/resolveGuardianIdentity'
import { type MessageCategory } from '@/lib/messaging/categoryAccess'

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

interface DirectMessageRow {
  id: string
  sender_type: 'guardian' | 'staff'
  body: string
  created_at: string
}

interface DirectMessagesResult {
  ok: boolean
  messages?: DirectMessageRow[]
  error?: string
}

async function getOrCreateFamilyConversation(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  familyId: string,
  category: MessageCategory
) {
  const { data: existing } = await admin
    .from('direct_conversations')
    .select('id')
    .eq('school_id', schoolId)
    .eq('family_id', familyId)
    .eq('category', category)
    .maybeSingle()
  if (existing) return existing.id as string

  const { data: created, error } = await admin
    .from('direct_conversations')
    .insert({ school_id: schoolId, family_id: familyId, category })
    .select('id')
    .single()
  if (error || !created) throw new Error(error?.message ?? 'No se pudo crear la conversación.')
  return created.id as string
}

/**
 * Mensajería directa de dos vías con el colegio -- distinta del asistente
 * de IA: acá hay un humano (profesor/dirección/recepción, o el equipo de
 * Inglés/Deporte según la categoría) del otro lado. Una conversación por
 * (familia, categoría) -- get-or-create, igual que su contraparte en
 * dashboard/mensajes/actions.ts para el lado del staff.
 */
export async function getFamilyDirectMessages(category: MessageCategory = 'regular'): Promise<DirectMessagesResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const admin = createAdminClient()
  const conversationId = await getOrCreateFamilyConversation(admin, identity.schoolId, identity.familyId, category).catch(() => null)
  if (!conversationId) return { ok: true, messages: [] }

  await admin.from('direct_conversations').update({ guardian_last_read_at: new Date().toISOString() }).eq('id', conversationId)

  const { data, error } = await admin
    .from('direct_messages')
    .select('id, sender_type, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) return { ok: false, error: 'No se pudieron cargar los mensajes.' }

  return { ok: true, messages: (data ?? []) as DirectMessageRow[] }
}

export async function sendFamilyDirectMessage(body: string, category: MessageCategory = 'regular'): Promise<{ ok: boolean; error?: string }> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: 'Escribe un mensaje.' }

  const admin = createAdminClient()
  let conversationId: string
  try {
    conversationId = await getOrCreateFamilyConversation(admin, identity.schoolId, identity.familyId, category)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo abrir la conversación.' }
  }

  const { data: guardianProfile } = await admin
    .from('users_profiles')
    .select('id')
    .eq('guardian_id', identity.guardianId)
    .single()
  if (!guardianProfile) return { ok: false, error: 'No se encontró tu perfil.' }

  const now = new Date().toISOString()
  const { error: insertError } = await admin.from('direct_messages').insert({
    conversation_id: conversationId,
    sender_type: 'guardian',
    sender_profile_id: guardianProfile.id,
    body: trimmed,
  })
  if (insertError) return { ok: false, error: 'No se pudo enviar el mensaje.' }

  await admin.from('direct_conversations').update({ last_message_at: now, guardian_last_read_at: now }).eq('id', conversationId)

  return { ok: true }
}

export interface ClassUpdateItem {
  id: string
  caption: string | null
  photoUrl: string | null
  targetLabel: string
  createdAt: string
}

const CLASS_UPDATES_BUCKET = 'class-updates'
const SIGNED_URL_TTL = 3600

// Trae las actualizaciones (fotos del día a día) dirigidas a los hijos de
// esta familia -- por estudiante puntual, o por su grado/sección
// (students.grade_level). Las fotos viven en un bucket privado, así que
// siempre se generan URLs firmadas con el cliente admin, sin importar
// quién las pida.
export async function getFamilyClassUpdates(): Promise<{ ok: boolean; updates?: ClassUpdateItem[]; error?: string }> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const admin = createAdminClient()
  const { data: students } = await admin
    .from('students')
    .select('id, grade_level')
    .eq('family_id', identity.familyId)
    .is('deleted_at', null)

  const studentIds = (students ?? []).map((s) => s.id as string)
  const gradeLevels = Array.from(new Set((students ?? []).map((s) => s.grade_level as string | null).filter((g): g is string => !!g)))

  if (studentIds.length === 0 && gradeLevels.length === 0) return { ok: true, updates: [] }

  const orFilter = [
    studentIds.length ? `student_id.in.(${studentIds.join(',')})` : null,
    gradeLevels.length ? `grade_level.in.(${gradeLevels.map((g) => `"${g}"`).join(',')})` : null,
  ].filter(Boolean).join(',')

  const { data: rows } = await admin
    .from('class_updates')
    .select('id, caption, photo_path, student_id, grade_level, created_at, students(first_name, last_name)')
    .eq('school_id', identity.schoolId)
    .is('deleted_at', null)
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(30)

  type Row = {
    id: string
    caption: string | null
    photo_path: string
    grade_level: string | null
    created_at: string
    students: { first_name: string; last_name: string } | null
  }

  const updates = await Promise.all(
    ((rows ?? []) as unknown as Row[]).map(async (r) => {
      const { data: signed } = await admin.storage.from(CLASS_UPDATES_BUCKET).createSignedUrl(r.photo_path, SIGNED_URL_TTL)
      return {
        id: r.id,
        caption: r.caption,
        photoUrl: signed?.signedUrl ?? null,
        targetLabel: r.students ? `${r.students.first_name} ${r.students.last_name}` : (r.grade_level ?? 'Colegio'),
        createdAt: r.created_at,
      }
    })
  )

  return { ok: true, updates }
}
