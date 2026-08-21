// =========================================================================
// MentorIApp — Edge Function: notify-message
// =========================================================================
//
// PROPÓSITO:
//   Avisa por correo (Resend) a un tutor cuando:
//   1. Personal del colegio le manda un mensaje directo nuevo, o
//   2. Se publica un comunicado marcado como "Urgente".
//
//   No usa Database Webhook (a diferencia de notify-attendance) -- se llama
//   directo desde las Server Actions de Next.js (sendStaffMessageAction /
//   createMessageAction) vía admin.functions.invoke(), que ya autentica
//   con la service_role key. Más simple porque quien llama ya es código
//   de servidor de confianza, no hace falta el esquema de webhook secret.
//
//   Solo correo por ahora -- WhatsApp (Evolution API) vive en el propio
//   Next.js (web/src/lib/whatsapp/), no está portado a Deno todavía, y las
//   credenciales de Evolution no están configuradas en producción aún.
// =========================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const PLATFORM_NAME = 'MentorIA'

function getSchoolOrPlatformName(value: string | null | undefined): string {
  const clean = typeof value === 'string' ? value.trim() : ''
  return clean || PLATFORM_NAME
}

interface NotifyMessageRequest {
  schoolName: string | null
  guardianEmail: string | null
  subject: string
  body: string
}

// Decodifica (sin verificar firma -- Supabase ya la verificó antes de
// invocar esta función, porque el proyecto tiene verify_jwt activado por
// defecto) el claim `role` del JWT del llamador. Sirve para exigir que
// SOLO código de servidor de confianza (que usa la service_role key) pueda
// llamar esta función -- la key `anon` es pública a propósito (cualquier
// visitante del sitio la tiene en el navegador), así que sin esta
// verificación cualquiera podría usarla para mandar correos arbitrarios a
// través de esta cuenta de Resend.
function callerIsServiceRole(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!callerIsServiceRole(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: NotifyMessageRequest
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  if (!payload.guardianEmail) {
    return new Response(JSON.stringify({ success: true, channel: 'none', reason: 'Tutor sin correo registrado' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY no configurado')
    return new Response(JSON.stringify({ success: false, error: 'RESEND_API_KEY no configurado' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: resendFromAddressSetting, error: settingError } = await supabase
    .schema('private')
    .rpc('get_app_setting', { setting_key: 'resend_from_address' })
  if (settingError) {
    console.warn('No se pudo leer resend_from_address:', settingError.message)
  }
  const resendFromAddress =
    (typeof resendFromAddressSetting === 'string' && resendFromAddressSetting.trim()) || 'onboarding@resend.dev'

  const schoolName = getSchoolOrPlatformName(payload.schoolName)

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${schoolName} <${resendFromAddress}>`,
        to: [payload.guardianEmail],
        subject: payload.subject,
        text: payload.body,
      }),
    })

    if (!emailRes.ok) {
      const detail = await emailRes.text()
      console.error('Resend error:', detail)
      return new Response(JSON.stringify({ success: false, error: 'No se pudo enviar el correo' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
  } catch (e) {
    console.error('Resend fetch error:', e)
    return new Response(JSON.stringify({ success: false, error: 'No se pudo conectar con Resend' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  return new Response(JSON.stringify({ success: true, channel: 'email' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
