// =========================================================================
// MentorIApp — Edge Function: notify-attendance
// =========================================================================
//
// PROPÓSITO:
//   Cuando se registra una ausencia/tardanza en la tabla `attendance`,
//   esta función:
//   1. Recibe el evento (Database Webhook de Supabase).
//   2. Obtiene el contexto del estudiante y sus tutores.
//   3. Le pide a Claude (Haiku) que redacte un mensaje cálido y personalizado.
//   4. Envía el mensaje por WhatsApp (Meta API) o Email (Resend).
//   5. Actualiza el registro con `notified_at` y el mensaje enviado.
//
// ESTRUCTURA (según AGENTS.md):
//   1. Trigger   → Validación del webhook entrante
//   2. Contexto  → Datos del estudiante, guardians, colegio
//   3. Decisión  → Claude Haiku redacta el mensaje
//   4. Acción    → Envío por WhatsApp / Email
//   5. Observabilidad → Actualización en DB + audit_log
//
// =========================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const PLATFORM_NAME = 'MentorIA'

function getSchoolOrPlatformName(value: string | null | undefined): string {
  const clean = typeof value === 'string' ? value.trim() : ''
  return clean || PLATFORM_NAME
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  school_id: string
  student_id: string
  subject_id: string | null
  status: 'ausente' | 'tardanza' | 'presente' | 'justificado'
  date: string
  notes: string | null
}

interface Guardian {
  first_name: string
  last_name: string
  phone: string
  email: string | null
  is_primary: boolean
}

interface StudentContext {
  first_name: string
  last_name: string
  guardians: Guardian[]
  school_name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── 1. TRIGGER ──────────────────────────────────────────────────────────────
  // Solo aceptamos POST desde Supabase Database Webhooks
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verificar el secret del webhook para seguridad
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  const incomingSecret = req.headers.get('x-webhook-secret')
  if (webhookSecret && incomingSecret !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let record: AttendanceRecord
  try {
    const body = await req.json()
    // Los Database Webhooks de Supabase envían { type, table, record, old_record }
    record = body.record as AttendanceRecord
    if (!record?.id || !record?.student_id) {
      return new Response('Invalid payload', { status: 400 })
    }
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Solo notificamos ausencias y tardanzas (no presentes)
  if (!['ausente', 'tardanza'].includes(record.status)) {
    return new Response('OK — no notification needed', { status: 200 })
  }

  // ── 2. CONTEXTO ─────────────────────────────────────────────────────────────
  // Obtener los datos del estudiante, sus guardians y el nombre del colegio

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Datos del estudiante
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('first_name, last_name, school_id')
    .eq('id', record.student_id)
    .single()

  if (studentError || !student) {
    console.error('Error fetching student:', studentError)
    return new Response('Student not found', { status: 404 })
  }

  // Nombre del colegio
  const { data: school } = await supabase
    .from('schools')
    .select('name')
    .eq('id', record.school_id)
    .single()

  // Nombre de la materia (null en registros históricos previos a la
  // migración de asistencia por materia -- el mensaje queda genérico ahí)
  let subjectName: string | null = null
  if (record.subject_id) {
    const { data: subject } = await supabase
      .from('subjects')
      .select('name')
      .eq('id', record.subject_id)
      .single()
    subjectName = subject?.name ?? null
  }

  // Guardians del estudiante (priorizamos el primario)
  const { data: guardianLinks } = await supabase
    .from('student_guardians')
    .select('guardian_id, is_primary')
    .eq('student_id', record.student_id)
    .eq('pickup_auth', true)

  const guardianIds = guardianLinks?.map((g: { guardian_id: string }) => g.guardian_id) ?? []

  const { data: guardians } = await supabase
    .from('guardians')
    .select('first_name, last_name, phone, email, is_primary')
    .in('id', guardianIds)
    .eq('school_id', record.school_id)
    .order('is_primary', { ascending: false }) // primario primero

  const context: StudentContext = {
    first_name: student.first_name,
    last_name: student.last_name,
    guardians: (guardians as Guardian[]) ?? [],
    school_name: getSchoolOrPlatformName(school?.name),
  }

  if (context.guardians.length === 0) {
    console.warn('No guardians found for student:', record.student_id)
    return new Response('No guardians found', { status: 200 })
  }

  // Guardian principal (primer contacto)
  const primaryGuardian = context.guardians[0]

  // ── 3. DECISIÓN (IA) ────────────────────────────────────────────────────────
  // Le pedimos a Claude Haiku que redacte un mensaje cálido y personalizado

  const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  let aiMessage = ''

  if (claudeApiKey) {
    const statusText = record.status === 'ausente' ? 'ausencia' : 'tardanza'
    const dateFormatted = new Date(record.date).toLocaleDateString('es-DO', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

    const prompt = `Eres el sistema de comunicación de ${context.school_name}.
Redacta un mensaje breve (máximo 3 oraciones) y cálido para notificar a ${primaryGuardian.first_name} ${primaryGuardian.last_name} sobre la ${statusText} de su hijo/a ${context.first_name} ${context.last_name} el día ${dateFormatted}${subjectName ? ` en la clase de ${subjectName}` : ''}.
${record.notes ? `Nota adicional del colegio: "${record.notes}"` : ''}
El tono debe ser profesional pero empático. No uses emojis. No incluyas saludos con "Estimado/a". Empieza directamente con la notificación.`

    try {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json()
        aiMessage = claudeData.content?.[0]?.text ?? ''
      } else {
        console.error('Claude API error:', await claudeRes.text())
      }
    } catch (e) {
      console.error('Claude fetch error:', e)
    }
  }

  // Fallback si la IA no está disponible o falla
  if (!aiMessage) {
    const statusText = record.status === 'ausente' ? 'ausencia' : 'tardanza'
    const subjectText = subjectName ? ` en la clase de ${subjectName}` : ''
    aiMessage = `Le informamos que ${context.first_name} ${context.last_name} registró una ${statusText}${subjectText} el día de hoy en ${context.school_name}. Por favor comuníquese con la secretaría si tiene alguna consulta.`
  }

  // ── 4. ACCIÓN ───────────────────────────────────────────────────────────────
  // Enviar por WhatsApp (Meta API) o Email (Resend) según disponibilidad

  let notificationChannel = 'none'
  const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN')
  const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const { data: resendFromAddressSetting, error: resendSettingError } = await supabase
    .schema('private')
    .rpc('get_app_setting', { setting_key: 'resend_from_address' })

  if (resendSettingError) {
    console.warn('No se pudo leer resend_from_address desde private.app_settings:', resendSettingError.message)
  }
  const resendFromAddress =
    (typeof resendFromAddressSetting === 'string' && resendFromAddressSetting.trim()) ||
    Deno.env.get('RESEND_FROM_ADDRESS')?.trim() ||
    'onboarding@resend.dev'

  if (whatsappToken && whatsappPhoneId && primaryGuardian.phone) {
    // ── WhatsApp (Meta Cloud API) ──
    // El número debe estar en formato internacional sin + (ej: 18091234567)
    const cleanPhone = primaryGuardian.phone.replace(/\D/g, '')

    try {
      const waRes = await fetch(
        `https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'text',
            text: { body: aiMessage },
          }),
        }
      )
      if (waRes.ok) {
        notificationChannel = 'whatsapp'
        console.log(`WhatsApp enviado a ${cleanPhone}`)
      } else {
        console.error('WhatsApp error:', await waRes.text())
      }
    } catch (e) {
      console.error('WhatsApp fetch error:', e)
    }
  } else if (resendApiKey && primaryGuardian.email) {
    // ── Email (Resend) — Fallback si no hay WhatsApp configurado ──
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${context.school_name} <${resendFromAddress}>`,
          to: [primaryGuardian.email],
          subject: `Aviso de asistencia — ${context.first_name} ${context.last_name}`,
          text: aiMessage,
        }),
      })
      if (emailRes.ok) {
        notificationChannel = 'email'
        console.log(`Email enviado a ${primaryGuardian.email}`)
      } else {
        console.error('Resend error:', await emailRes.text())
      }
    } catch (e) {
      console.error('Resend fetch error:', e)
    }
  }

  // ── 5. OBSERVABILIDAD ───────────────────────────────────────────────────────
  // Actualizar el registro de asistencia con el resultado de la notificación

  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('attendance')
    .update({
      notified_at: notificationChannel !== 'none' ? now : null,
      notification_channel: notificationChannel,
      ai_message_sent: aiMessage,
    })
    .eq('id', record.id)

  if (updateError) {
    console.error('Error updating attendance record:', updateError)
  }

  // Registrar en audit_logs para trazabilidad completa
  await supabase.from('audit_logs').insert({
    school_id: record.school_id,
    action: 'attendance_notification',
    table_name: 'attendance',
    record_id: record.id,
    after_state: {
      student: `${context.first_name} ${context.last_name}`,
      subject: subjectName,
      status: record.status,
      notified_to: primaryGuardian.phone || primaryGuardian.email,
      channel: notificationChannel,
      ai_used: !!claudeApiKey,
    },
  })

  console.log(`✓ notify-attendance completado. Canal: ${notificationChannel}, Estudiante: ${context.first_name} ${context.last_name}`)

  return new Response(
    JSON.stringify({ success: true, channel: notificationChannel }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 }
  )
})
