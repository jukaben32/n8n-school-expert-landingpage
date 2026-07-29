'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

const RECEIPT_BUCKET = 'comprobantes-pago'

interface ActionResult {
  ok: boolean
  error?: string
}

async function resolveTesoreriaStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'tesoreria')) {
    return { ok: false as const, error: 'No tienes permiso para revisar comprobantes.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, staffProfileId: profile.id as string, schoolId }
}

export interface PendingReceipt {
  id: string
  invoice_id: string
  amount: number
  created_at: string
  storage_path: string
  invoices: { description: string; total_amount: number } | null
  families: { name: string } | null
}

export async function listPendingReceipts(): Promise<PendingReceipt[]> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('payment_receipts')
    .select('id, invoice_id, amount, created_at, storage_path, invoices(description, total_amount), families(name)')
    .eq('school_id', staff.schoolId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as PendingReceipt[]
}

/** URL firmada de corta duración -- el bucket es privado, nunca hay una URL pública. */
export async function getReceiptSignedUrl(receiptId: string): Promise<string | null> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return null

  const admin = createAdminClient()
  const { data: receipt } = await admin
    .from('payment_receipts')
    .select('storage_path')
    .eq('id', receiptId)
    .eq('school_id', staff.schoolId)
    .single()

  if (!receipt) return null

  const { data, error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(receipt.storage_path, 300)

  if (error || !data) return null
  return data.signedUrl
}

export async function confirmReceipt(receiptId: string): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { data: receipt } = await admin
    .from('payment_receipts')
    .select('id, school_id, invoice_id, amount, status')
    .eq('id', receiptId)
    .eq('school_id', staff.schoolId)
    .single()

  if (!receipt) return { ok: false, error: 'No se encontró el comprobante.' }
  if (receipt.status !== 'pendiente') return { ok: false, error: 'Este comprobante ya fue revisado.' }

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, total_amount, status')
    .eq('id', receipt.invoice_id)
    .single()
  if (!invoice) return { ok: false, error: 'No se encontró la factura asociada.' }

  const { error: paymentError } = await admin.from('payments').insert({
    school_id: staff.schoolId,
    invoice_id: receipt.invoice_id,
    amount_paid: receipt.amount,
    payment_method: 'transferencia',
    received_by: staff.staffProfileId,
    notes: 'Confirmado desde comprobante subido por la familia (Portal Familiar).',
  })
  if (paymentError) return { ok: false, error: `No se pudo registrar el pago: ${paymentError.message}` }

  if (receipt.amount >= invoice.total_amount && invoice.status !== 'pagado') {
    await admin.from('invoices').update({ status: 'pagado', paid_at: new Date().toISOString() }).eq('id', invoice.id)
  }

  await admin.from('payment_receipts').update({
    status: 'confirmado',
    reviewed_by: staff.staffProfileId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', receiptId)

  revalidatePath('/dashboard/tesoreria/comprobantes')
  return { ok: true }
}

export async function rejectReceipt(receiptId: string, reason: string): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { data: receipt } = await admin
    .from('payment_receipts')
    .select('id, status')
    .eq('id', receiptId)
    .eq('school_id', staff.schoolId)
    .single()

  if (!receipt) return { ok: false, error: 'No se encontró el comprobante.' }
  if (receipt.status !== 'pendiente') return { ok: false, error: 'Este comprobante ya fue revisado.' }

  await admin.from('payment_receipts').update({
    status: 'rechazado',
    reviewed_by: staff.staffProfileId,
    reviewed_at: new Date().toISOString(),
    rejection_reason: reason.trim() || null,
  }).eq('id', receiptId)

  revalidatePath('/dashboard/tesoreria/comprobantes')
  return { ok: true }
}
