import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { looksLikeAnnualPrepayment } from './annualPrepayNote'

/**
 * Trato VIP a quien paga el año por adelantado con descuento.
 *
 * El colegio hace descuento (5%, 10%, hasta 20%) a quien paga el año
 * completo. La plataforma convierte el dinero en cuotas a precio completo,
 * así que sin esto a esa familia le "faltaba" el descuento al final del año
 * y en mayo aparecía con deuda, recargo y hasta bloqueo. Aquí ese faltante
 * se registra como `invoices.prepay_discount_amount` en la factura del
 * pago anual: cubre cuotas sin efectivo (mismo campo que ya usa el pago
 * adelantado del Portal Familiar, ver 20261101000000).
 *
 * Solo se da el crédito si TODO esto se cumple -- nunca se perdona deuda
 * real:
 *   - la nota dice que es el año completo / hasta junio;
 *   - antes de este pago el estudiante no tenía deuda vieja (a lo sumo la
 *     cuota del mes en curso, que el propio pago anual incluye);
 *   - lo que falta para el año completo es como mucho el 25% del año
 *     (el descuento más alto visto en Alegra fue ~20%).
 * Si no, el pago se registra igual, sin crédito, y una persona decide.
 *
 * Devuelve el crédito aplicado (0 si no aplicó).
 */
export async function applyAnnualPrepayCredit(
  admin: ReturnType<typeof createAdminClient>,
  params: { invoiceId: string; studentId: string; invoiceDate: string; invoiceAmount: number; note: string | null | undefined },
): Promise<number> {
  if (!looksLikeAnnualPrepayment(params.note)) return 0

  const [{ data: yearRaw }, { data: statusRaw }] = await Promise.all([
    admin.rpc('student_tuition_year_status', { p_student_id: params.studentId }).maybeSingle(),
    admin.rpc('calculate_receivable_status', { p_student_id: params.studentId, p_as_of: params.invoiceDate }).maybeSingle(),
  ])
  const year = yearRaw as { annual_total: number | string; collected_total: number | string; year_paid: boolean } | null
  const status = statusRaw as { expected_to_date: number | string | null; monthly_amount: number | string | null } | null
  if (!year || !status || year.year_paid) return 0

  const annual = Number(year.annual_total)
  const collected = Number(year.collected_total)
  const monthly = Number(status.monthly_amount ?? 0)
  const expectedAtPayment = Number(status.expected_to_date ?? 0)
  const collectedBefore = collected - params.invoiceAmount

  // Había deuda vieja antes de este pago: no es (solo) un adelanto.
  if (expectedAtPayment - collectedBefore > monthly + 0.01) return 0

  const gap = Math.round((annual - collected) * 100) / 100
  if (gap <= 0 || gap > annual * 0.25) return 0

  const { data: updated, error } = await admin
    .from('invoices')
    .update({ prepay_discount_amount: gap, updated_at: new Date().toISOString() })
    .eq('id', params.invoiceId)
    .eq('prepay_discount_amount', 0)
    .select('id')
  if (error) {
    console.error('[annualPrepayCredit]', error.message)
    return 0
  }
  return (updated ?? []).length > 0 ? gap : 0
}
