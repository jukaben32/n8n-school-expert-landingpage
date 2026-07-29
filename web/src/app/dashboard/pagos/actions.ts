'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveGuardianIdentity } from '@/lib/auth/resolveGuardianIdentity'
import { buildAzulPaymentForm, type AzulPaymentForm } from '@/lib/payments/azul'

const RECEIPT_BUCKET = 'comprobantes-pago'
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

interface ActionResult {
  ok: boolean
  error?: string
}

export type StartAzulPaymentResult =
  | { ok: true; form: AzulPaymentForm }
  | { ok: false; error: string }

/**
 * Arma el formulario que el navegador de la familia debe enviar a Azul
 * (Parte A del pago con tarjeta). No procesa el pago aquí -- eso pasa del
 * lado de Azul y vuelve por /api/pagos/azul/resultado.
 */
export async function startAzulPayment(invoiceId: string): Promise<StartAzulPaymentResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) return { ok: false, error: 'Falta configurar NEXT_PUBLIC_SITE_URL.' }

  return buildAzulPaymentForm({
    schoolId: identity.schoolId,
    familyId: identity.familyId,
    invoiceId,
    siteUrl,
  })
}

/**
 * Parte B: la familia sube un comprobante de transferencia. Esto SOLO crea
 * un registro "pendiente" -- nunca marca la factura como pagada. Confirmar
 * o rechazar es una acción exclusiva de Tesorería (ver
 * web/src/app/dashboard/tesoreria/actions.ts).
 */
export async function uploadPaymentReceipt(formData: FormData): Promise<ActionResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const invoiceId = formData.get('invoiceId')
  const amountRaw = formData.get('amount')
  const file = formData.get('file')

  if (typeof invoiceId !== 'string' || !invoiceId) {
    return { ok: false, error: 'Falta indicar la factura.' }
  }
  const amount = Number(amountRaw)
  if (!amount || amount <= 0) {
    return { ok: false, error: 'Indica el monto transferido.' }
  }
  if (!(file instanceof File)) {
    return { ok: false, error: 'Adjunta una foto o PDF del comprobante.' }
  }
  if (file.size === 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return { ok: false, error: 'El archivo es demasiado grande (máximo 10MB).' }
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
    return { ok: false, error: 'Solo se aceptan imágenes (JPG/PNG/WEBP) o PDF.' }
  }

  const admin = createAdminClient()

  // Filtrado explícito: la factura debe pertenecer a la familia y colegio
  // ya resueltos por la sesión -- no se confía en el invoiceId del cliente
  // por sí solo.
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .eq('school_id', identity.schoolId)
    .eq('family_id', identity.familyId)
    .is('deleted_at', null)
    .single()

  if (!invoice) return { ok: false, error: 'No se encontró la factura.' }
  if (invoice.status === 'pagado') return { ok: false, error: 'Esta factura ya está pagada.' }

  const extension = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
  const receiptId = crypto.randomUUID()
  const path = `${identity.schoolId}/${identity.familyId}/${receiptId}.${extension}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return { ok: false, error: `No se pudo subir el comprobante: ${uploadError.message}` }
  }

  const { error: insertError } = await admin.from('payment_receipts').insert({
    id: receiptId,
    school_id: identity.schoolId,
    family_id: identity.familyId,
    invoice_id: invoiceId,
    guardian_id: identity.guardianId,
    amount,
    storage_path: path,
    status: 'pendiente',
  })

  if (insertError) {
    // El archivo ya se subió -- se intenta limpiar para no dejar huérfanos.
    await admin.storage.from(RECEIPT_BUCKET).remove([path])
    return { ok: false, error: `No se pudo registrar el comprobante: ${insertError.message}` }
  }

  return { ok: true }
}

export interface MyReceipt {
  id: string
  invoice_id: string
  amount: number
  status: 'pendiente' | 'confirmado' | 'rechazado'
  rejection_reason: string | null
  created_at: string
}

export async function getMyReceipts(): Promise<MyReceipt[]> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('payment_receipts')
    .select('id, invoice_id, amount, status, rejection_reason, created_at')
    .eq('family_id', identity.familyId)
    .order('created_at', { ascending: false })

  return (data ?? []) as MyReceipt[]
}
