'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

const ManualPaymentSchema = z.object({
  invoiceId: z.string().uuid('Factura inválida.'),
  amountPaid: z.number().finite().positive('Indica un monto mayor a cero.'),
  paymentMethod: z.enum(['efectivo', 'transferencia', 'tarjeta', 'azul', 'cheque']),
  notes: z.string().max(500, 'La nota es demasiado larga.').optional(),
})

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
    return { ok: false as const, error: 'No tienes permiso para registrar pagos.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, staffProfileId: profile.id as string, schoolId }
}

/**
 * Registra un pago manual desde Tesorería. El servidor resuelve el colegio
 * y quién recibió el pago desde la sesión; el navegador solo manda la
 * factura, el monto, el método y una nota opcional.
 */
export async function recordManualPayment(input: unknown): Promise<ActionResult> {
  const parsed = ManualPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { invoiceId, amountPaid, paymentMethod, notes } = parsed.data

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, school_id, total_amount, status')
    .eq('id', invoiceId)
    .eq('school_id', staff.schoolId)
    .is('deleted_at', null)
    .single()

  if (!invoice) return { ok: false, error: 'No se encontró la factura.' }
  if (invoice.status !== 'pendiente' && invoice.status !== 'vencido') {
    return { ok: false, error: 'Esta factura ya no está pendiente de pago.' }
  }

  const { data: existingPayments } = await admin
    .from('payments')
    .select('amount_paid')
    .eq('invoice_id', invoice.id)

  const previouslyPaid = (existingPayments ?? []).reduce((sum, payment) => sum + Number(payment.amount_paid ?? 0), 0)
  const roundedAmount = Math.round(amountPaid * 100) / 100

  const { error: paymentError } = await admin.from('payments').insert({
    school_id: staff.schoolId,
    invoice_id: invoice.id,
    amount_paid: roundedAmount,
    payment_method: paymentMethod,
    received_by: staff.staffProfileId,
    notes: notes?.trim() || null,
  })
  if (paymentError) return { ok: false, error: `No se pudo registrar el pago: ${paymentError.message}` }

  // Si el acumulado de pagos cubre la factura, queda pagada. Esto cubre
  // tanto pago único como pagos parciales acumulados.
  if (previouslyPaid + roundedAmount >= Number(invoice.total_amount)) {
    const { error: invoiceError } = await admin
      .from('invoices')
      .update({ status: 'pagado', paid_at: new Date().toISOString() })
      .eq('id', invoice.id)
      .eq('school_id', staff.schoolId)
    if (invoiceError) return { ok: false, error: `El pago se registró, pero no se pudo actualizar la factura: ${invoiceError.message}` }
  }

  revalidatePath('/dashboard/tesoreria')
  revalidatePath('/dashboard/tesoreria/cobrar')
  return { ok: true }
}
