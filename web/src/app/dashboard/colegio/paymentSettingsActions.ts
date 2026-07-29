'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface ActionResult {
  ok: boolean
  error?: string
}

export interface PaymentSettingsDisplay {
  merchantId: string
  merchantName: string
  merchantType: string
  currencyCode: string
  environment: 'test' | 'production'
  hasAuthKey: boolean
}

export interface PaymentSettingsResult {
  ok: boolean
  data?: PaymentSettingsDisplay
  error?: string
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

  if (!profile || !canAccess(profile.role, 'configuracion_colegio')) {
    return { ok: false as const, error: 'No tienes permiso para configurar pagos.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

export async function getPaymentSettingsDisplay(): Promise<PaymentSettingsResult> {
  const admin = await resolveSchoolAdmin()
  if (!admin.ok) return { ok: false, error: admin.error }

  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin
    .rpc('get_school_payment_display', { p_school_id: admin.schoolId })
    .maybeSingle()

  if (error) {
    console.error('[getPaymentSettingsDisplay]', error)
    return { ok: false, error: `No se pudo cargar la configuración de pagos: ${error.message}` }
  }

  if (!data) {
    return { ok: true, data: { merchantId: '', merchantName: '', merchantType: 'ECommerce', currencyCode: '$', environment: 'test', hasAuthKey: false } }
  }

  const row = data as {
    azul_merchant_id: string | null
    azul_merchant_name: string | null
    azul_merchant_type: string | null
    azul_currency_code: string | null
    azul_environment: string | null
    has_auth_key: boolean | null
  }

  return {
    ok: true,
    data: {
      merchantId: row.azul_merchant_id ?? '',
      merchantName: row.azul_merchant_name ?? '',
      merchantType: row.azul_merchant_type ?? 'ECommerce',
      currencyCode: row.azul_currency_code ?? '$',
      environment: row.azul_environment === 'production' ? 'production' : 'test',
      hasAuthKey: !!row.has_auth_key,
    },
  }
}

/**
 * authKey vacío = conservar el secreto ya guardado (nunca se manda el
 * valor actual de vuelta al formulario, así que no hay nada que
 * "reenviar" salvo que la persona escriba uno nuevo).
 */
export async function savePaymentSettings(formData: FormData): Promise<ActionResult> {
  const admin = await resolveSchoolAdmin()
  if (!admin.ok) return { ok: false, error: admin.error }

  const merchantId = String(formData.get('merchantId') ?? '').trim()
  const merchantName = String(formData.get('merchantName') ?? '').trim()
  const merchantType = String(formData.get('merchantType') ?? '').trim() || 'ECommerce'
  const currencyCode = String(formData.get('currencyCode') ?? '').trim() || '$'
  const environment = formData.get('environment') === 'production' ? 'production' : 'test'
  const authKey = String(formData.get('authKey') ?? '').trim()

  if (!merchantId || !merchantName) {
    return { ok: false, error: 'Merchant ID y nombre del comercio son obligatorios.' }
  }

  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.rpc('upsert_school_payment_credentials', {
    p_school_id: admin.schoolId,
    p_azul_merchant_id: merchantId,
    p_azul_merchant_name: merchantName,
    p_azul_merchant_type: merchantType,
    p_azul_currency_code: currencyCode,
    p_azul_environment: environment,
    p_azul_auth_key: authKey,
  })

  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` }

  revalidatePath('/dashboard/colegio')
  return { ok: true }
}
