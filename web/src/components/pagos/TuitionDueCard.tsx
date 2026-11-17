'use client'

import { useMemo, useState } from 'react'
import { startTuitionCardPayment } from '@/app/dashboard/pagos/actions'
import type { StudentTuition } from '@/lib/payments/familyTuition'
import { buildTuitionQuote, formatPeriodMonth, prepayDiscountPercent, type PrepayTier } from '@/lib/payments/tuitionPlan'

interface TuitionDueCardProps {
  student: StudentTuition
  prepayEnabled: boolean
  prepayTiers: PrepayTier[]
  cardPaymentEnabled: boolean
}

const formatDOP = (amount: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount)

/**
 * Mensualidad de un hijo en el Estado de Cuenta: lo que se debe hoy (desde
 * el día 25, igual que Cuentas por Cobrar) y la opción de adelantar meses.
 * El total que se ve aquí es una vista previa; el que se cobra lo vuelve a
 * calcular el servidor con las mismas reglas (startTuitionCardPayment).
 */
export default function TuitionDueCard({ student, prepayEnabled, prepayTiers, cardPaymentEnabled }: TuitionDueCardProps) {
  const [monthsAhead, setMonthsAhead] = useState(0)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const principalDue = student.currentAmount + student.overduePrincipal
  const canPrepay = prepayEnabled && cardPaymentEnabled && student.future.length > 0
  const maxMonths = canPrepay ? student.future.length : 0

  const quote = useMemo(() => buildTuitionQuote({
    principalDue,
    lateFee: student.lateFee,
    future: student.future,
    monthsAhead,
    tiers: prepayTiers,
  }), [principalDue, student.lateFee, student.future, monthsAhead, prepayTiers])

  // El próximo nivel de descuento que todavía no alcanza, para animarlo.
  const nextTier = prepayTiers.find((t) => t.months > monthsAhead && t.months <= maxMonths && t.percent > prepayDiscountPercent(monthsAhead, prepayTiers))

  if (principalDue <= 0 && student.lateFee <= 0 && !canPrepay) return null

  async function handlePay() {
    setError(null)
    setPaying(true)
    const result = await startTuitionCardPayment(student.studentId, monthsAhead)
    if (!result.ok) {
      setError(result.error)
      setPaying(false)
      return
    }
    // Azul exige que el POST lo haga el navegador directo a su dominio.
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = result.form.actionUrl
    for (const [name, value] of Object.entries(result.form.fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  const isUpToDate = principalDue <= 0 && student.lateFee <= 0

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Mensualidad</p>
          <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{student.studentName}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cuota mensual: {formatDOP(student.monthlyAmount)}</p>
        </div>
        {isUpToDate ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Al día</span>
        ) : (
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${student.overduePrincipal > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
            {student.overduePrincipal > 0 ? 'Vencido' : 'Pendiente'}
          </span>
        )}
      </div>

      {/* Lo que se debe hoy */}
      {!isUpToDate && (
        <dl className="space-y-1.5 text-sm">
          {student.currentAmount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-300">Cuota del mes</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{formatDOP(student.currentAmount)}</dd>
            </div>
          )}
          {student.overduePrincipal > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-red-700 dark:text-red-400">Cuotas vencidas{student.oldestReference ? ` (desde ${student.oldestReference})` : ''}</dt>
              <dd className="font-semibold text-red-700 dark:text-red-300">{formatDOP(student.overduePrincipal)}</dd>
            </div>
          )}
          {student.lateFee > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-red-700 dark:text-red-400">Recargo por mora</dt>
              <dd className="font-semibold text-red-700 dark:text-red-300">{formatDOP(student.lateFee)}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Adelantar meses */}
      {canPrepay && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Adelantar meses</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Quedan {maxMonths} {maxMonths === 1 ? 'mes' : 'meses'} en este año escolar.</p>
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="Meses por adelantado">
              <button
                type="button"
                onClick={() => setMonthsAhead((m) => Math.max(0, m - 1))}
                disabled={monthsAhead === 0}
                aria-label="Un mes menos"
                className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 text-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition disabled:opacity-40"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-black text-slate-900 dark:text-white" aria-live="polite">{monthsAhead}</span>
              <button
                type="button"
                onClick={() => setMonthsAhead((m) => Math.min(maxMonths, m + 1))}
                disabled={monthsAhead >= maxMonths}
                aria-label="Un mes más"
                className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 text-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {quote.months.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {quote.months.map((m) => (
                <li key={m.periodMonth} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 capitalize">
                  {formatPeriodMonth(m.periodMonth)}
                </li>
              ))}
            </ul>
          )}

          {prepayTiers.length > 0 && (
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
              {prepayTiers.filter((t) => t.months <= maxMonths).map((t) => (
                <li key={t.months} className={quote.discountPercent === t.percent && monthsAhead >= t.months ? 'font-semibold text-green-700 dark:text-green-400' : ''}>
                  {quote.discountPercent === t.percent && monthsAhead >= t.months ? '✓ ' : ''}
                  Adelanta {t.months} {t.months === 1 ? 'mes' : 'meses'} o más: {t.percent}% de descuento en esos meses
                </li>
              ))}
            </ul>
          )}
          {nextTier && (
            <p className="text-xs font-medium text-primary dark:text-accent-light">
              Agrega {nextTier.months - monthsAhead} {nextTier.months - monthsAhead === 1 ? 'mes' : 'meses'} más y obtén {nextTier.percent}% de descuento.
            </p>
          )}
        </div>
      )}

      {/* Resumen y pago */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1.5">
        {quote.monthsAhead > 0 && (
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-300">{quote.monthsAhead} {quote.monthsAhead === 1 ? 'mes' : 'meses'} por adelantado</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatDOP(quote.prepayGross)}</span>
          </div>
        )}
        {quote.prepayDiscount > 0 && (
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-green-700 dark:text-green-400">Descuento por pago adelantado ({quote.discountPercent}%)</span>
            <span className="font-semibold text-green-700 dark:text-green-400">−{formatDOP(quote.prepayDiscount)}</span>
          </div>
        )}
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total a pagar</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{formatDOP(quote.total)}</span>
        </div>
      </div>

      {cardPaymentEnabled ? (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || quote.total <= 0}
            className="text-sm font-semibold px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-full transition shadow-glow disabled:opacity-60"
          >
            {paying ? 'Redirigiendo…' : quote.total > 0 ? `Pagar ${formatDOP(quote.total)} con tarjeta` : 'Elige los meses a adelantar'}
          </button>
          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 text-right">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Puedes pagar en la secretaría del colegio o por transferencia. Para adelantar meses, consulta en secretaría.
        </p>
      )}
    </article>
  )
}
