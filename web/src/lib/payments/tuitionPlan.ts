/**
 * Cálculo del pago de mensualidad desde el Portal Familiar.
 *
 * Funciones PURAS (sin base de datos): las usa el servidor para fijar el
 * monto que se cobra en Azul y la pantalla para mostrar el mismo total
 * antes de pagar. El monto que vale es siempre el que calcula el servidor.
 *
 * Reglas (las mismas del motor SQL de Cuentas por Cobrar):
 * - La cuota del mes X "entra" (se debe) desde el día 25 de X.
 * - Lo cobrado cubre primero las cuotas más viejas (FIFO). Si ya se pagó
 *   de más, ese saldo a favor cubre las cuotas futuras en orden.
 * - El descuento por pago adelantado solo se aplica a los meses futuros,
 *   nunca a lo atrasado ni al recargo.
 */

export interface Installment {
  /** Primer día del mes de la cuota, 'YYYY-MM-DD'. */
  periodMonth: string
  amount: number
}

export interface PrepayTier {
  /** Mínimo de meses adelantados para que aplique este nivel. */
  months: number
  percent: number
}

export interface FutureInstallment {
  periodMonth: string
  /** Lo que falta por pagar de esa cuota (puede estar cubierta en parte). */
  amount: number
}

export interface TuitionQuote {
  /** Cuotas ya debidas (corriente + vencido), sin recargo. */
  principalDue: number
  lateFee: number
  monthsAhead: number
  /** Suma de las cuotas futuras elegidas, antes del descuento. */
  prepayGross: number
  discountPercent: number
  prepayDiscount: number
  total: number
  /** Meses futuros incluidos, en orden. */
  months: FutureInstallment[]
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** 'YYYY-MM-DD' del día en que la cuota empieza a deberse (día 25 del mes). */
function installmentEntryDate(periodMonth: string): string {
  return `${periodMonth.slice(0, 7)}-25`
}

/**
 * Cuotas del año que todavía no se deben (antes del día 25 de su mes) y
 * que no están cubiertas por lo ya cobrado.
 */
export function futureUnpaidInstallments(schedule: Installment[], collected: number, asOf: string): FutureInstallment[] {
  let remaining = Math.max(collected, 0)
  const result: FutureInstallment[] = []
  for (const cuota of [...schedule].sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))) {
    const applied = Math.min(remaining, cuota.amount)
    remaining = round2(remaining - applied)
    const unpaid = round2(cuota.amount - applied)
    if (installmentEntryDate(cuota.periodMonth) > asOf && unpaid > 0) {
      result.push({ periodMonth: cuota.periodMonth, amount: unpaid })
    }
  }
  return result
}

/** Limpia los niveles que vienen de la base (jsonb) y los ordena. */
export function normalizePrepayTiers(raw: unknown): PrepayTier[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => ({ months: Math.floor(Number(t?.months)), percent: Number(t?.percent) }))
    .filter((t) => Number.isFinite(t.months) && t.months >= 1 && Number.isFinite(t.percent) && t.percent > 0 && t.percent <= 100)
    .sort((a, b) => a.months - b.months)
}

/** El nivel más alto que alcanza esa cantidad de meses (0 si ninguno). */
export function prepayDiscountPercent(monthsAhead: number, tiers: PrepayTier[]): number {
  let percent = 0
  for (const tier of tiers) {
    if (monthsAhead >= tier.months) percent = Math.max(percent, tier.percent)
  }
  return percent
}

export function buildTuitionQuote(input: {
  principalDue: number
  lateFee: number
  future: FutureInstallment[]
  monthsAhead: number
  tiers: PrepayTier[]
}): TuitionQuote {
  const monthsAhead = Math.max(0, Math.min(Math.floor(input.monthsAhead) || 0, input.future.length))
  const months = input.future.slice(0, monthsAhead)
  const prepayGross = round2(months.reduce((sum, m) => sum + m.amount, 0))
  const discountPercent = monthsAhead > 0 ? prepayDiscountPercent(monthsAhead, input.tiers) : 0
  const prepayDiscount = round2(prepayGross * discountPercent / 100)
  const principalDue = round2(Math.max(input.principalDue, 0))
  const lateFee = round2(Math.max(input.lateFee, 0))
  return {
    principalDue,
    lateFee,
    monthsAhead,
    prepayGross,
    discountPercent,
    prepayDiscount,
    total: round2(principalDue + lateFee + prepayGross - prepayDiscount),
    months,
  }
}

/** "noviembre 2026" a partir de '2026-11-01'. */
export function formatPeriodMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split('-').map(Number)
  const name = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('es-DO', { month: 'long', timeZone: 'UTC' })
  return `${name} ${year}`
}

/** Fecha de hoy en República Dominicana, 'YYYY-MM-DD'. */
export function todayInDominicanRepublic(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
