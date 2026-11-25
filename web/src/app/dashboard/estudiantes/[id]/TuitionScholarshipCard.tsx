'use client'

import { useState, useTransition } from 'react'
import { setStudentScholarshipAction, type ScholarshipInput } from './actions'

interface Props {
  studentId: string
  /** Solo Dirección puede asignar o quitar una beca. */
  canEdit: boolean
  /** Mensualidad del nivel del estudiante (sin beca ni hermanos), o null si no está configurada. */
  levelAmount: number | null
  /** Cuota propia fija (plan especial), o null. */
  overrideAmount: number | null
  /** Beca en % sobre la mensualidad del nivel, o null. Excluyente con overrideAmount. */
  discountPercent: number | null
  overrideReason: string | null
  overrideSetAt: string | null
  /** % de descuento por hermanos que le toca hoy (0 si no aplica). */
  siblingPercent: number
  /** Cuota mensual que la plataforma le exige hoy (ya con beca y hermanos). */
  finalMonthly: number | null
}

const dop = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)

/**
 * Mensualidad de un estudiante en su ficha: de dónde sale su cuota (nivel,
 * beca, descuento por hermanos) y, para Dirección, cargar o quitar una beca
 * con su motivo. La regla de cálculo vive en SQL (student_tuition_basis);
 * aquí solo se muestra lo que ya calculó.
 */
export default function TuitionScholarshipCard(props: Props) {
  const [editing, setEditing] = useState(false)
  const hasScholarship = props.overrideAmount != null || props.discountPercent != null
  const [kind, setKind] = useState<'percent' | 'amount'>(props.overrideAmount != null ? 'amount' : 'percent')
  const [amount, setAmount] = useState(
    props.overrideAmount != null ? String(props.overrideAmount)
      : props.discountPercent != null ? String(props.discountPercent) : '',
  )
  const [reason, setReason] = useState(props.overrideReason ?? '')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const save = (remove: boolean) => {
    setMessage(null)
    startTransition(async () => {
      try {
        const value = Number(amount)
        if (!remove && (amount.trim() === '' || !Number.isFinite(value))) {
          setMessage({ ok: false, text: kind === 'percent' ? 'Escribe el porcentaje de la beca.' : 'Escribe la cuota mensual de la beca.' })
          return
        }
        const input: ScholarshipInput = remove ? null : { kind, value }
        const result = await setStudentScholarshipAction(props.studentId, input, reason)
        setMessage({ ok: result.ok, text: result.message })
        if (result.ok) setEditing(false)
      } catch {
        setMessage({ ok: false, text: 'El servidor no respondió y no se guardó nada. Recarga la página e inténtalo de nuevo.' })
      }
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-slate-800 dark:text-slate-100 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Mensualidad</h2>
        {props.finalMonthly != null && (
          <span className="text-lg font-black">{dop(props.finalMonthly)}<span className="text-xs font-medium text-slate-500"> / mes</span></span>
        )}
      </div>

      <dl className="text-sm space-y-1">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Mensualidad del nivel</dt>
          <dd>{props.levelAmount != null ? dop(props.levelAmount) : 'Sin configurar'}</dd>
        </div>
        {props.discountPercent != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-emerald-700 dark:text-emerald-400 font-medium">Beca</dt>
            <dd className="text-emerald-700 dark:text-emerald-400 font-semibold">−{props.discountPercent}%</dd>
          </div>
        )}
        {props.overrideAmount != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-emerald-700 dark:text-emerald-400 font-medium">Cuota especial</dt>
            <dd className="text-emerald-700 dark:text-emerald-400 font-semibold">{dop(props.overrideAmount)}</dd>
          </div>
        )}
        {props.siblingPercent > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-emerald-700 dark:text-emerald-400 font-medium">Descuento por hermanos</dt>
            <dd className="text-emerald-700 dark:text-emerald-400 font-semibold">−{props.siblingPercent}%</dd>
          </div>
        )}
      </dl>

      {hasScholarship && props.overrideReason && (
        <p className="text-xs text-slate-500">
          Motivo: {props.overrideReason}
          {props.overrideSetAt ? ` · ${new Date(props.overrideSetAt).toLocaleDateString('es-DO')}` : ''}
        </p>
      )}

      {props.canEdit && !editing && (
        <button
          type="button" onClick={() => setEditing(true)}
          className="text-xs font-semibold text-primary dark:text-accent-light hover:underline"
        >
          {hasScholarship ? 'Cambiar o quitar beca' : 'Asignar beca / cuota especial'}
        </button>
      )}

      {props.canEdit && editing && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
          <div className="flex gap-1 text-xs" role="radiogroup" aria-label="Tipo de beca">
            {([['percent', 'Porcentaje (%)'], ['amount', 'Cuota fija (RD$)']] as const).map(([k, label]) => (
              <button
                key={k} type="button" role="radio" aria-checked={kind === k}
                onClick={() => { setKind(k); setAmount('') }}
                className={`rounded-full px-3 py-1 font-semibold border ${kind === k ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {kind === 'percent' ? 'Porcentaje de beca (%)' : 'Cuota mensual con la beca (RD$)'}
            <input
              type="number" min="0" max={kind === 'percent' ? 100 : undefined} step={kind === 'percent' ? '1' : '0.01'}
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={kind === 'percent' ? 'Ej. 50'
                : props.levelAmount != null ? `Ej. ${Math.round(props.levelAmount / 2)} (la mitad)` : 'Monto'}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
            />
          </label>
          {kind === 'percent' && props.levelAmount != null && Number(amount) > 0 && Number(amount) <= 100 && (
            <p className="text-[11px] text-emerald-700">
              Cuota con la beca: {dop(Math.round(props.levelAmount * (1 - Number(amount) / 100) * 100) / 100)} / mes
              {props.siblingPercent > 0 ? ` (antes del ${props.siblingPercent}% por hermanos)` : ''}.
            </p>
          )}
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Motivo y quién la aprobó
            <input
              type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Beca 50% aprobada por el dueño, 2026-11-17"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Si el estudiante tiene descuento por hermanos, se aplica encima de esta cuota. Al guardar se
            recalcula todo el año, también lo ya pagado: si caja venía cobrando con este descuento, la
            deuda que no existía desaparece.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button" disabled={pending} onClick={() => save(false)}
              className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar beca'}
            </button>
            {hasScholarship && (
              <button
                type="button" disabled={pending} onClick={() => save(true)}
                className="rounded-full border border-red-200 bg-white text-red-700 text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                Quitar beca
              </button>
            )}
            <button
              type="button" onClick={() => setEditing(false)}
              className="rounded-full border border-slate-200 bg-white text-slate-600 text-xs font-semibold px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={`text-xs ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  )
}
