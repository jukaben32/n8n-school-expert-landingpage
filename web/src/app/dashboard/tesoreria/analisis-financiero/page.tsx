import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { todaySchoolDate } from '@/lib/schoolDate'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Análisis Financiero — MentorIApp',
  description: 'Ingreso proyectado vs. real del colegio.',
}

type ProjectionRow = {
  school_level: string
  students_count: number
  scholarship_count: number
  unconfigured_count: number
  list_price: number | null
  gross_monthly: number
  net_monthly: number
  net_annual: number
}

type CashflowRow = {
  period_month: string
  expected_amount: number
  collected_amount: number
  pending_amount: number
  overdue_amount: number
}

const LEVEL_LABELS: Record<string, string> = {
  parvulo: 'Párvulo',
  inicial: 'Inicial (Kinder / Pre Primario)',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  sin_nivel: 'Sin nivel reconocido',
}

const formatDOP = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null)

function monthLabel(iso: string) {
  const label = new Date(iso + 'T00:00:00').toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function semaphore(p: number | null) {
  if (p === null) return 'var(--dash-text-muted)'
  if (p >= 90) return 'var(--dash-accent)'
  if (p >= 75) return 'var(--dash-warning)'
  return 'var(--dash-danger-strong)'
}

/** Primer día del mes siguiente a YYYY-MM-01 (para el rango de caja). */
function nextMonthStart(monthStart: string) {
  const [y, m] = monthStart.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 1))
  return d.toISOString().slice(0, 10)
}

/**
 * Análisis Financiero — Fase 1 (secciones A y B). Solo dirección.
 *
 * SOLO LEE: no escribe nada y no recalcula la regla de cuotas -- el neto y
 * el anual salen de `school_income_projection_by_level` y lo cobrado por
 * cuota de `list_school_monthly_cashflow` (la misma función que alimenta el
 * Panel), así que las cifras cuadran con las demás pantallas.
 */
export default async function AnalisisFinancieroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'tesoreria_analisis')) {
    redirect('/dashboard/tesoreria')
  }
  const schoolId = (await getActiveSchool(profile.role, profile.school_id ?? '')).schoolId

  const [{ data: projectionRaw, error: projectionError }, { data: cashflowRaw, error: cashflowError }] =
    await Promise.all([
      supabase.rpc('school_income_projection_by_level', { p_school_id: schoolId }),
      supabase.rpc('list_school_monthly_cashflow', { p_school_id: schoolId }),
    ])

  const projection = (projectionRaw ?? []) as ProjectionRow[]
  const cashflow = (cashflowRaw ?? []) as CashflowRow[]

  // Mes seleccionado: el pedido si es válido y pertenece al año escolar;
  // si no, el mes actual (hora del colegio) o, fuera de año escolar, el último.
  const todayMonth = todaySchoolDate().slice(0, 7) + '-01'
  const months = cashflow.map((c) => c.period_month)
  const requested = mes && /^\d{4}-\d{2}$/.test(mes) ? mes + '-01' : null
  const selected =
    (requested && months.includes(requested) && requested) ||
    (months.includes(todayMonth) && todayMonth) ||
    months[months.length - 1] ||
    todayMonth

  // Caja del mes: lo que entró por pagos en ese mes (mismo origen que el
  // Panel: payments.amount_paid por paid_at). Incluye todos los conceptos.
  // Frontera con -04:00 = hora de RD, para no correr pagos de la noche.
  const { data: paymentsRaw, error: paymentsError } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('school_id', schoolId)
    .gte('paid_at', `${selected}T00:00:00-04:00`)
    .lt('paid_at', `${nextMonthStart(selected)}T00:00:00-04:00`)
  const cajaMes = ((paymentsRaw ?? []) as { amount_paid: number }[]).reduce((s, p) => s + Number(p.amount_paid), 0)

  const totals = projection.reduce(
    (t, r) => ({
      students: t.students + r.students_count,
      gross: t.gross + Number(r.gross_monthly),
      net: t.net + Number(r.net_monthly),
      annual: t.annual + Number(r.net_annual),
      unconfigured: t.unconfigured + r.unconfigured_count,
    }),
    { students: 0, gross: 0, net: 0, annual: 0, unconfigured: 0 },
  )

  const cuotaSel = cashflow.find((c) => c.period_month === selected)
  const cumplCuota = cuotaSel ? pct(Number(cuotaSel.collected_amount), Number(cuotaSel.expected_amount)) : null
  const cumplCaja = pct(cajaMes, totals.net)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <QueryErrorBanner
        errors={[
          { label: 'la proyección por nivel', error: projectionError },
          { label: 'las cuotas del año escolar', error: cashflowError },
          { label: 'los pagos del mes', error: paymentsError },
        ]}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Análisis Financiero</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ingreso proyectado frente al cobrado. Solo dirección. Gastos y comparativa con 2025-2026 llegan en una fase siguiente.
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="mes" className="text-sm text-slate-600">Mes</label>
          <select
            id="mes"
            name="mes"
            defaultValue={selected.slice(0, 7)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {months.map((m) => (
              <option key={m} value={m.slice(0, 7)}>{monthLabel(m)}</option>
            ))}
          </select>
          <button type="submit" className="dash-btn-primary text-sm px-4 py-2">Ver</button>
        </form>
      </div>

      {totals.unconfigured > 0 && (
        <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {totals.unconfigured} estudiante(s) inscrito(s) no tienen mensualidad configurada (nivel sin tarifa o sin año escolar en curso)
          y no suman al ingreso neto. Se corrige en Configuración del colegio.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Proyectado neto / mes</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{formatDOP(totals.net)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-text-faint)' }}>
            Bruto de lista: {formatDOP(totals.gross)} · {totals.students} inscritos
          </p>
        </div>
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Proyectado neto del año</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{formatDOP(totals.annual)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-text-faint)' }}>Con las cuotas del año escolar (agosto parcial, sin julio)</p>
        </div>
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Cobrado en caja · {monthLabel(selected)}</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{formatDOP(cajaMes)}</p>
          <p className="text-xs mt-1" style={{ color: semaphore(cumplCaja) }}>
            {cumplCaja === null ? 'Sin proyección' : `${cumplCaja.toFixed(1)}% de la proyección mensual`}
          </p>
        </div>
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Cumplimiento de la cuota</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: semaphore(cumplCuota) }}>
            {cumplCuota === null ? '—' : `${cumplCuota.toFixed(1)}%`}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-text-faint)' }}>
            Cuota de {monthLabel(selected)} cobrada hasta hoy
          </p>
        </div>
      </div>

      {/* A. Proyección por nivel */}
      <section>
        <h2 className="text-xs font-barlow uppercase tracking-widest mb-3" style={{ color: 'var(--dash-text-faint)' }}>
          A · Ingreso proyectado por nivel
        </h2>
        <div className="dash-card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <tr>
                {['Nivel', 'Inscritos', 'Tarifa', 'Bruto / mes', 'Neto / mes', 'Neto del año'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 font-barlow uppercase tracking-wide text-xs ${i > 0 ? 'text-right' : ''}`} style={{ color: 'var(--dash-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
              {projection.map((r) => (
                <tr key={r.school_level}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--dash-text)' }}>
                    {LEVEL_LABELS[r.school_level] ?? r.school_level}
                    {r.scholarship_count > 0 && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--dash-text-faint)' }}>({r.scholarship_count} con beca)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--dash-text)' }}>{r.students_count}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--dash-text-muted)' }}>
                    {r.list_price === null ? 'Sin tarifa' : formatDOP(Number(r.list_price))}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--dash-text-muted)' }}>{formatDOP(Number(r.gross_monthly))}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--dash-text)' }}>{formatDOP(Number(r.net_monthly))}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--dash-text)' }}>{formatDOP(Number(r.net_annual))}</td>
                </tr>
              ))}
              {projection.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--dash-text-muted)' }}>No hay estudiantes inscritos.</td></tr>
              )}
            </tbody>
            {projection.length > 0 && (
              <tfoot className="border-t" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
                <tr>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--dash-text)' }}>Total</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--dash-text)' }}>{totals.students}</td>
                  <td />
                  <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--dash-text)' }}>{formatDOP(totals.gross)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--dash-text)' }}>{formatDOP(totals.net)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--dash-text)' }}>{formatDOP(totals.annual)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Bruto = inscritos × tarifa de lista. Neto = lo que de verdad corresponde cobrar tras becas y descuento por hermanos.
        </p>
      </section>

      {/* B. Real vs proyectado, cuota por cuota */}
      <section>
        <h2 className="text-xs font-barlow uppercase tracking-widest mb-3" style={{ color: 'var(--dash-text-faint)' }}>
          B · Cobrado vs. exigible, cuota por cuota
        </h2>
        <div className="dash-card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <tr>
                {['Cuota', 'Exigible', 'Cobrado', 'Falta', '% cobrado', ''].map((h, i) => (
                  <th key={h + i} className={`px-4 py-3 font-barlow uppercase tracking-wide text-xs ${i > 0 && i < 5 ? 'text-right' : ''}`} style={{ color: 'var(--dash-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
              {cashflow.map((c) => {
                const exp = Number(c.expected_amount)
                const col = Number(c.collected_amount)
                const p = pct(col, exp)
                return (
                  <tr key={c.period_month} style={c.period_month === selected ? { background: 'rgba(150,225,196,.06)' } : undefined}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--dash-text)' }}>{monthLabel(c.period_month)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--dash-text-muted)' }}>{formatDOP(exp)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--dash-text)' }}>{formatDOP(col)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--dash-text-muted)' }}>{formatDOP(Math.max(exp - col, 0))}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: semaphore(p) }}>{p === null ? '—' : `${p.toFixed(1)}%`}</td>
                    <td className="px-4 py-3 w-40">
                      <div className="h-2 rounded-full" style={{ background: 'rgba(150,225,196,.12)' }}>
                        <div className="h-2 rounded-full" style={{ width: `${Math.min(p ?? 0, 100)}%`, background: semaphore(p) }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {cashflow.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--dash-text-muted)' }}>No hay cuotas calculadas (falta año escolar en curso o mensualidades configuradas).</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          El cobrado por cuota usa la misma regla que Cuentas por Cobrar (cada pago cubre primero la cuota más vieja). El cobrado en caja del
          recuadro superior suma todos los pagos del mes, incluidos atrasos de meses anteriores y otros conceptos.
        </p>
      </section>
    </div>
  )
}
