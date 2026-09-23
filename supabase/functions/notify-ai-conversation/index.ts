// =========================================================================
// MentorIApp — Edge Function: notify-ai-conversation
// =========================================================================
//
// PROPÓSITO:
//   Avisa por correo a dirección/administración del colegio cuando una
//   familia le escribe al Asistente de IA del Portal Familiar -- el
//   problema real que resuelve (ver AGENTS.md / conversación con el
//   usuario, 2026-09-22): antes nadie se enteraba de una conversación
//   nueva a menos que entrara manualmente a /dashboard/asistente-ia, así
//   que casos como "mi hijo faltó por cita médica" o "la asistencia no se
//   actualiza" solo se resolvían si alguien del colegio se acordaba de
//   revisar.
//
//   No avisa por CADA mensaje: el trigger en Postgres
//   (notify_ai_conversation_webhook, ver migración) ya filtra para que
//   esta función solo se invoque en el PRIMER mensaje de una familia en
//   las últimas 24h (ventana móvil, mismo criterio que
//   answerFamilyQuestion.ts usa para su límite diario) -- así una
//   conversación de varios mensajes seguidos genera un solo correo, no uno
//   por mensaje.
//
// ESTRUCTURA (según AGENTS.md):
//   1. Trigger   → Validación del webhook entrante
//   2. Contexto  → Familia + colegio + destinatarios (dirección/admin)
//   3. Acción    → Envío por Email (Resend)
//   4. Observabilidad → audit_logs
// =========================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface AiConversationRecord {
  id: string
  school_id: string
  family_id: string
  channel: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

Deno.serve(async (req: Request) => {
  // ── 1. TRIGGER ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  const incomingSecret = req.headers.get('x-webhook-secret')
  if (webhookSecret && incomingSecret !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let record: AiConversationRecord
  try {
    const body = await req.json()
    record = body.record as AiConversationRecord
    if (!record?.id || !record?.family_id || !record?.school_id) {
      return new Response('Invalid payload', { status: 400 })
    }
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Defensa en profundidad: el trigger de Postgres ya filtra role='user',
  // pero si algún día se reusa este webhook para otra tabla/evento, esto
  // evita mandar un aviso por la respuesta del propio asistente.
  if (record.role !== 'user') {
    return new Response('OK — no notification needed', { status: 200 })
  }

  // ── 2. CONTEXTO ─────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const [familyRes, schoolRes, recipientsRes] = await Promise.all([
    supabase.from('families').select('name').eq('id', record.family_id).single(),
    supabase.from('schools').select('name').eq('id', record.school_id).single(),
    supabase
      .from('users_profiles')
      .select('auth_id, staff_id, staff(email)')
      .eq('school_id', record.school_id)
      .in('role', ['director', 'school_admin', 'super_admin']),
  ])

  const familyName = familyRes.data?.name ?? 'Una familia'
  const schoolName = schoolRes.data?.name ?? 'el colegio'

  type Recipient = { auth_id: string; staff_id: string | null; staff: { email: string } | null }
  const profiles = (recipientsRes.data ?? []) as unknown as Recipient[]

  // La mayoría ya tiene email en `staff` (vía staff_id). Los que no tienen
  // staff_id (ej. cuenta de administración creada sin ficha de personal)
  // se resuelven contra auth.users -- mismo patrón que
  // web/src/lib/auth/findAuthUserByEmail.ts usa en el resto del proyecto.
  const emails = new Set<string>()
  for (const p of profiles) {
    if (p.staff?.email) {
      emails.add(p.staff.email)
      continue
    }
    const { data: authUser } = await supabase.auth.admin.getUserById(p.auth_id)
    if (authUser?.user?.email) emails.add(authUser.user.email)
  }

  if (emails.size === 0) {
    console.warn('No hay destinatarios (director/school_admin/super_admin) para el colegio:', record.school_id)
    return new Response('No recipients found', { status: 200 })
  }

  // ── 3. ACCIÓN ───────────────────────────────────────────────────────────
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const { data: resendFromAddressSetting } = await supabase
    .schema('private')
    .rpc('get_app_setting', { setting_key: 'resend_from_address' })
  const resendFromAddress =
    (typeof resendFromAddressSetting === 'string' && resendFromAddressSetting.trim()) ||
    Deno.env.get('RESEND_FROM_ADDRESS')?.trim() ||
    'onboarding@resend.dev'

  const { data: appSiteUrlSetting } = await supabase
    .schema('private')
    .rpc('get_app_setting', { setting_key: 'app_site_url' })
  const appSiteUrl = (typeof appSiteUrlSetting === 'string' && appSiteUrlSetting.trim()) || ''
  const conversationUrl = appSiteUrl
    ? `${appSiteUrl.replace(/\/$/, '')}/dashboard/asistente-ia/${record.family_id}`
    : null

  const preview = record.content.length > 200 ? `${record.content.slice(0, 200)}…` : record.content

  const emailText = `La familia ${familyName} le escribió al Asistente de IA del Portal Familiar de ${schoolName}.

Mensaje: "${preview}"

${conversationUrl ? `Ver la conversación completa: ${conversationUrl}` : 'Entra a Asistente de IA en el panel para ver la conversación completa.'}

Este es un aviso único por familia cada 24 horas, aunque escriban varios mensajes seguidos.`

  let notificationChannel = 'none'
  if (resendApiKey) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${schoolName} <${resendFromAddress}>`,
          to: Array.from(emails),
          subject: `Nuevo mensaje de ${familyName} al Asistente de IA`,
          text: emailText,
        }),
      })
      if (emailRes.ok) {
        notificationChannel = 'email'
        console.log(`Aviso de conversación enviado a ${emails.size} destinatario(s)`)
      } else {
        console.error('Resend error:', await emailRes.text())
      }
    } catch (e) {
      console.error('Resend fetch error:', e)
    }
  } else {
    console.warn('RESEND_API_KEY no configurada -- no se pudo enviar el aviso.')
  }

  // ── 4. OBSERVABILIDAD ──────────────────────────────────────────────────
  await supabase.from('audit_logs').insert({
    school_id: record.school_id,
    action: 'ai_conversation_notification',
    table_name: 'ai_conversations',
    record_id: record.id,
    after_state: {
      family: familyName,
      recipients: Array.from(emails),
      channel: notificationChannel,
    },
  })

  return new Response(
    JSON.stringify({ success: true, channel: notificationChannel, recipients: emails.size }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 }
  )
})
