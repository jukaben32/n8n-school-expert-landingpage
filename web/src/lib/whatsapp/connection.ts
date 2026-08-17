import { createAdminClient } from '@/lib/supabase/admin'
import {
  evolutionCreateInstance,
  evolutionGetQrCode,
  evolutionGetConnectionState,
  evolutionSetWebhook,
  evolutionSendText,
  evolutionDeleteInstance,
} from '@/lib/evolutionApi'

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WhatsAppConnectionRow {
  id: string
  school_id: string
  provider: string
  assistant_name: string
  phone_number: string | null
  instance_name: string | null
  instance_token: string | null
  status: WhatsAppConnectionStatus
  is_enabled: boolean
  created_at: string
  updated_at: string
}

type AdminClient = ReturnType<typeof createAdminClient>

export async function getWhatsappConnection(admin: AdminClient, schoolId: string): Promise<WhatsAppConnectionRow | null> {
  const { data, error } = await admin
    .from('whatsapp_connections')
    .select('id, school_id, provider, assistant_name, phone_number, instance_name, instance_token, status, is_enabled, created_at, updated_at')
    .eq('school_id', schoolId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Instance names are used in URL paths, so keep them filesystem/URL-safe.
// Prefixed so instances from different MentorIApp/real-estate colegios
// sharing the same Evolution API VPS are easy to tell apart.
function slugifyInstanceName(schoolId: string): string {
  return `mentoriapp-${schoolId}`
}

// Creates (or re-creates) the Evolution API instance for this school, wires
// its webhook back to /api/whatsapp/webhook/[schoolId], and returns the QR
// code to scan. Safe to call again while status is 'connecting'.
export async function connectWhatsapp(
  admin: AdminClient,
  schoolId: string,
  appUrl: string
): Promise<{ connection: WhatsAppConnectionRow; qrCode: string | null }> {
  const instanceName = slugifyInstanceName(schoolId)
  const { instanceToken } = await evolutionCreateInstance(instanceName)
  if (!instanceToken) throw new Error('Evolution API no devolvió un token de instancia')

  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/whatsapp/webhook/${schoolId}`
  await evolutionSetWebhook(instanceName, instanceToken, webhookUrl)
  const qrCode = await evolutionGetQrCode(instanceName, instanceToken)

  const { data, error } = await admin
    .from('whatsapp_connections')
    .upsert(
      {
        school_id: schoolId,
        provider: 'evolution_api',
        instance_name: instanceName,
        instance_token: instanceToken,
        status: 'connecting',
        is_enabled: true,
      },
      { onConflict: 'school_id' }
    )
    .select('id, school_id, provider, assistant_name, phone_number, instance_name, instance_token, status, is_enabled, created_at, updated_at')
    .single()
  if (error) throw error

  return { connection: data, qrCode }
}

// Polled by the dashboard while status is 'connecting' to detect once the
// director/secretaria has actually scanned the QR code.
export async function refreshWhatsappStatus(admin: AdminClient, connection: WhatsAppConnectionRow): Promise<WhatsAppConnectionRow> {
  if (!connection.instance_name || !connection.instance_token) return connection
  const state = await evolutionGetConnectionState(connection.instance_name, connection.instance_token)
  const status: WhatsAppConnectionStatus = state === 'open' ? 'connected' : state === 'connecting' ? 'connecting' : 'disconnected'
  if (status === connection.status) return connection

  const { data, error } = await admin
    .from('whatsapp_connections')
    .update({ status })
    .eq('id', connection.id)
    .select('id, school_id, provider, assistant_name, phone_number, instance_name, instance_token, status, is_enabled, created_at, updated_at')
    .single()
  if (error) throw error
  return data
}

export async function setWhatsappEnabled(admin: AdminClient, schoolId: string, isEnabled: boolean): Promise<WhatsAppConnectionRow> {
  const { data, error } = await admin
    .from('whatsapp_connections')
    .update({ is_enabled: isEnabled })
    .eq('school_id', schoolId)
    .select('id, school_id, provider, assistant_name, phone_number, instance_name, instance_token, status, is_enabled, created_at, updated_at')
    .single()
  if (error) throw error
  return data
}

export async function disconnectWhatsapp(admin: AdminClient, connection: WhatsAppConnectionRow): Promise<void> {
  if (connection.instance_name) {
    await evolutionDeleteInstance(connection.instance_name)
  }
  const { error } = await admin.from('whatsapp_connections').delete().eq('id', connection.id)
  if (error) throw error
}

export async function sendWhatsappMessage(connection: WhatsAppConnectionRow, toNumber: string, text: string): Promise<void> {
  if (!connection.instance_name || !connection.instance_token) {
    throw new Error('Esta conexión de WhatsApp no tiene instancia activa')
  }
  await evolutionSendText(connection.instance_name, connection.instance_token, toNumber, text)
}
