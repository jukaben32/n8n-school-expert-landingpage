'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { getPublicSiteUrl } from '@/lib/siteUrl'
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappConnection,
  refreshWhatsappStatus,
  setWhatsappEnabled,
  type WhatsAppConnectionRow,
} from '@/lib/whatsapp/connection'
import { EvolutionApiNotConfiguredError } from '@/lib/evolutionApi'

interface ActionResult {
  ok: boolean
  connection?: WhatsAppConnectionRow | null
  qrCode?: string | null
  error?: string
  notConfigured?: boolean
}

async function resolveSchoolAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'whatsapp')) {
    return { ok: false as const, error: 'No tienes permiso para configurar WhatsApp.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

export async function connectWhatsappAction(): Promise<ActionResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const appUrl = getPublicSiteUrl()
  if (!appUrl) {
    return { ok: false, error: 'Falta configurar NEXT_PUBLIC_SITE_URL para poder recibir mensajes de WhatsApp.' }
  }

  try {
    const admin = createAdminClient()
    const { connection, qrCode } = await connectWhatsapp(admin, resolved.schoolId, appUrl)
    revalidatePath('/dashboard/whatsapp')
    return { ok: true, connection, qrCode }
  } catch (err) {
    if (err instanceof EvolutionApiNotConfiguredError) {
      return { ok: false, error: err.message, notConfigured: true }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo conectar WhatsApp' }
  }
}

export async function disconnectWhatsappAction(): Promise<ActionResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  const connection = await getWhatsappConnection(admin, resolved.schoolId)
  if (!connection) return { ok: true, connection: null }

  try {
    await disconnectWhatsapp(admin, connection)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo desconectar' }
  }

  revalidatePath('/dashboard/whatsapp')
  return { ok: true, connection: null }
}

export async function refreshWhatsappStatusAction(): Promise<ActionResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  let connection = await getWhatsappConnection(admin, resolved.schoolId)
  if (connection && connection.status !== 'connected') {
    try {
      connection = await refreshWhatsappStatus(admin, connection)
    } catch {
      // Evolution API unreachable (e.g. VPS not up yet) — fall back to the
      // last known state instead of failing the whole request.
    }
  }
  return { ok: true, connection }
}

export async function toggleWhatsappEnabledAction(isEnabled: boolean): Promise<ActionResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  const connection = await setWhatsappEnabled(admin, resolved.schoolId, isEnabled)
  revalidatePath('/dashboard/whatsapp')
  return { ok: true, connection }
}

// Evolution API no expone de forma confiable el número ya vinculado tras
// escanear el QR (ni siquiera el proyecto de referencia lo resuelve --
// también le queda "Número aún no sincronizado" sin rellenar). En vez de
// adivinar el endpoint/formato exacto contra un servicio que no se puede
// probar en vivo desde aquí, el colegio simplemente confirma su propio
// número -- lo sabe de memoria, es el celular que usó para escanear.
export async function updateWhatsappPhoneNumberAction(phoneNumber: string): Promise<ActionResult> {
  const resolved = await resolveSchoolAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('whatsapp_connections')
    .update({ phone_number: phoneNumber.trim() || null })
    .eq('school_id', resolved.schoolId)
    .select('id, school_id, provider, assistant_name, phone_number, instance_name, instance_token, status, is_enabled, created_at, updated_at')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/whatsapp')
  return { ok: true, connection: data }
}
