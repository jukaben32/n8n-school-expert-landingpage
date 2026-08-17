import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappConnection, sendWhatsappMessage } from '@/lib/whatsapp/connection'
import { resolveGuardianByPhone } from '@/lib/whatsapp/resolveGuardianByPhone'
import { answerFamilyQuestion, answerGeneralQuestion } from '@/lib/ai/answerFamilyQuestion'

// This is the "Fase 2" endpoint AGENTS.md describes: resolves
// phone -> guardian_id -> family_id explicitly (no Supabase session, since
// WhatsApp has no JWT) and calls the same answerFamilyQuestion() core the
// Portal Familiar text chat and voice call already use — no duplicated
// business logic, same daily limit, same data-isolation rules.
//
// No signature verification: Evolution API's webhook has no built-in HMAC
// signing, so the schoolId in the URL (paired with checking the connection
// row exists + is enabled) is the trust boundary — same accepted risk as
// the real-estate-multi-ai-agent-saas reference project. This URL isn't
// guessable without already knowing a valid school_id, and the worst a
// forged POST can do is trigger a spurious AI reply.

function extractInboundText(data: Record<string, unknown>): string | null {
  const message = data.message as Record<string, unknown> | undefined
  if (!message) return null
  if (typeof message.conversation === 'string') return message.conversation
  const extended = message.extendedTextMessage as { text?: string } | undefined
  return extended?.text ?? null
}

export async function POST(request: Request, props: { params: Promise<{ schoolId: string }> }) {
  const params = await props.params
  const payload = await request.json().catch(() => null)
  if (!payload) return NextResponse.json({ ok: true })

  const event = String(payload.event ?? '').toUpperCase()
  if (event && event !== 'MESSAGES_UPSERT') {
    return NextResponse.json({ ok: true })
  }

  const data = payload.data as Record<string, unknown> | undefined
  const key = data?.key as { remoteJid?: string; fromMe?: boolean } | undefined
  if (!data || !key || key.fromMe) {
    return NextResponse.json({ ok: true })
  }

  const remoteJid = key.remoteJid
  const text = extractInboundText(data)
  if (!remoteJid || remoteJid.endsWith('@g.us') || !text) {
    // No text content, or a group chat — group support is out of scope for now.
    return NextResponse.json({ ok: true })
  }

  const phone = remoteJid.split('@')[0]
  const schoolId = params.schoolId
  const admin = createAdminClient()

  const connection = await getWhatsappConnection(admin, schoolId)
  if (!connection || !connection.is_enabled) {
    return NextResponse.json({ ok: true })
  }

  const identity = await resolveGuardianByPhone(schoolId, phone)

  // Randomized human-like pause before replying — instant bot replies are an
  // easy automation signal on WhatsApp and raise ban risk; costs nothing here.
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000))

  let reply: string
  if (!identity.ok) {
    // No coincide con ninguna familia registrada -- "modo recepción
    // general": responde con información pública del colegio únicamente,
    // nunca con datos de una familia (ver answerGeneralQuestion, que a
    // propósito nunca recibe family_id/guardian_id).
    const result = await answerGeneralQuestion({ schoolId, phone, message: text })
    reply = result.ok ? result.reply : result.error
  } else {
    const result = await answerFamilyQuestion({
      schoolId,
      familyId: identity.familyId,
      guardianId: identity.guardianId,
      channel: 'whatsapp',
      message: text,
    })
    reply = result.ok ? result.reply : result.error
  }

  try {
    await sendWhatsappMessage(connection, phone, reply)
  } catch (err) {
    console.error('[whatsapp webhook] failed to send reply', err)
  }

  return NextResponse.json({ ok: true })
}
