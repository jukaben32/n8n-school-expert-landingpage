import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { looksLikeAnnualPrepayment } from './annualPrepayNote'

/**
 * Descuento por pago adelantado dado en CAJA (Alegra o "Registrar pago").
 *
 * El colegio hace descuento a quien paga meses por adelantado (5%, 10%,
 * hasta 20% visto en Alegra). La plataforma convierte el dinero en cuotas a
 * precio completo, así que sin esto a esa familia le "faltaba" el descuento
 * y más adelante aparecía con deuda, recargo y hasta bloqueo (reporte real,
 * 2026-11-17). El descuento se registra en `invoices.prepay_discount_amount`
 * de la factura del pago: cubre cuotas sin efectivo (mismo campo que ya usa
 * el adelanto con tarjeta del Portal Familiar, ver 20261101000000).
 *
 * Dos caminos, en este orden:
 *
 * 1. EXPLÍCITO (preferido): caja anotó el descuento en la propia factura
 *    (línea de Alegra con % de descuento, o el campo "Descuento por pago
 *    adelantado" de Registrar pago). Se toma ese monto exacto -- no se
 *    adivina nada --, con tope en lo que le falta al año (nunca deja saldo a
 *    favor inventado).
 *
 * 2. AÑO COMPLETO (respaldo, cuando caja cobró el neto sin anotar el %):
 *    la nota dice año completo / 10.5 meses / "AGO-JUN" / "hasta junio",
 *    antes del pago no había deuda vieja (a lo sumo la cuota del mes en
 *    curso, que el propio pago incluye) y lo que falta para el año es como
 *    mucho el 25% del año. Así nunca se perdona deuda real.
 *
 * Si ninguno aplica, el pago se registra igual, sin crédito, y una persona
 * decide. Devuelve el crédito aplicado (0 si no aplicó).
 */
export async function applyPrepayDiscountCredit(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    invoiceId: string
    studentId: string
    invoiceDate: string
    invoiceAmount: number
    note: string | null | undefined
    /** Descuento que caja anotó explícitamente (Alegra o Registrar pago). */
    explicitDiscount?: number
  },
): Promise<number> {
  const explicit = Math.round(Math.max(Number(params.explicitDiscount ?? 0), 0) * 100) / 100
  if (explicit <= 0 && !looksLikeAnnualPrepayment(params.note)) return 0

  const [{ data: yearRaw }, { data: statusRaw }] = await Promise.all([
    admin.rpc('student_tuition_year_status', { p_student_id: params.studentId }).maybeSingle(),
    admin.rpc('calculate_receivable_status', { p_student_id: params.studentId, p_as_of: params.invoiceDate }).maybeSingle(),
  ])
  const year = yearRaw as { annual_total: number | string; collected_total: number | string; year_paid: boolean } | null
  const status = statusRaw as { expected_to_date: number | string | null; monthly_amount: number | string | null } | null
  if (!year || year.year_paid) return 0

  const annual = Number(year.annual_total)
  const collected = Number(year.collected_total)
  const remaining = Math.round((annual - collected) * 100) / 100
  if (remaining <= 0) return 0

  let credit = 0
  if (explicit > 0) {
    credit = Math.min(explicit, remaining)
  } else {
    if (!status) return 0
    const monthly = Number(status.monthly_amount ?? 0)
    const expectedAtPayment = Number(status.expected_to_date ?? 0)
    const collectedBefore = collected - params.invoiceAmount
    // Había deuda vieja antes de este pago: no es (solo) un adelanto.
    if (expectedAtPayment - collectedBefore > monthly + 0.01) return 0
    if (remaining > annual * 0.25) return 0
    credit = remaining
  }
  credit = Math.round(credit * 100) / 100
  if (credit <= 0) return 0

  const { data: updated, error } = await admin
    .from('invoices')
    .update({ prepay_discount_amount: credit, updated_at: new Date().toISOString() })
    .eq('id', params.invoiceId)
    .eq('prepay_discount_amount', 0)
    .select('id')
  if (error) {
    console.error('[prepayDiscountCredit]', error.message)
    return 0
  }
  return (updated ?? []).length > 0 ? credit : 0
}
