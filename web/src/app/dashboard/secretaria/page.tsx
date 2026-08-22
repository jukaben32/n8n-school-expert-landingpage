import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import StackedBarChart from '@/components/charts/StackedBarChart'
import TrendChart from '@/components/charts/TrendChart'
import DonutChart from '@/components/charts/DonutChart'
import { CHART_SEMANTIC } from '@/lib/chartColors'

export const metadata: Metadata = {
  title: 'Centro de control — MentorIApp',
  description: 'Panel de gestión escolar para el equipo administrativo.',
}

const RANGE_OPTIONS = ['hoy', 'semana', 'mes'] as const
type RangeOption = (typeof RANGE_OPTIONS)[number]
const RANGE_LABELS: Record<RangeOption, string> = { hoy: 'Hoy', semana: 'Semana', mes: 'Mes' }

function resolveRange(range: RangeOption) {
  const now = new Date()
  if (range === 'hoy') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    return { start, spanMs: now.getTime() - start.getTime(), label: 'hoy' }
  }
  if (range === 'semana') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { start, spanMs: 7 * 24 * 60 * 60 * 1000, label: 'esta semana' }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { start, spanMs: now.getTime() - start.getTime(), label: 'este mes' }
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

const enrollmentLabels: Record<string, string> = {
  prospecto: 'Prospecto', solicitud: 'Solicitud', evaluacion: 'Evaluación',
  admitido: 'Admitido', inscrito: 'Inscrito', retirado: 'Retirado',
}

/**
 * Centro de Control — Vista principal para administradores, dirección y recepción.
 * Rediseño agosto 2026 (Claude Design) sobre el tema oscuro/menta del
 * dashboard. El selector Hoy/Semana/Mes mueve la ventana de tiempo de
 * "Estudiantes inscritos" y "Cobrado" -- Asistencia (7 días), Flujo de
 * cobranza (año escolar) y Asistencia diaria (4 semanas) usan ventanas
 * fijas, tal como dice su propio título, sin importar el filtro.
 */
export default async function SecretariaPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams
  const range: RangeOption = RANGE_OPTIONS.includes(rangeParam as RangeOption) ? (rangeParam as RangeOption) : 'mes'
  const { start: rangeStart, spanMs, label: rangeLabel } = resolveRange(range)
  const prevStart = new Date(rangeStart.getTime() - spanMs)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('school_id, role')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId

  if (profile && !canAccess(profile.role, 'secretaria')) {
    redirect('/dashboard')
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [
    { data: studentsInRange, error: studentsRangeError },
    { data: studentsPrevRange, error: studentsPrevError },
    { data: enrolledStudents, error: enrolledError },
    { data: allGuardians, error: guardiansError },
    { data: accessProfiles, error: accessError },
    { data: paymentsInRange, error: paymentsRangeError },
    { data: invoicedInRange, error: invoicedRangeError },
    { data: overdueInvoices, error: overdueError },
    { data: attendanceWeek, error: attendanceWeekError },
    { data: attendancePrevWeek, error: attendancePrevError },
    { data: attendance4Weeks, error: attendance4WeeksError },
    { data: invoicesYear, error: invoicesYearError },
    { data: last10DaysStudents, error: last10DaysError },
  ] = await Promise.all([
    supabase.from('students').select('id').eq('school_id', schoolId).is('deleted_at', null).gte('created_at', rangeStart.toISOString()),
    supabase.from('students').select('id').eq('school_id', schoolId).is('deleted_at', null).gte('created_at', prevStart.toISOString()).lt('created_at', rangeStart.toISOString()),
    supabase.from('students').select('id, enrollment_status').eq('school_id', schoolId).is('deleted_at', null),
    supabase.from('guardians').select('id, family_id').eq('school_id', schoolId),
    supabase.from('users_profiles').select('guardian_id').eq('school_id', schoolId).not('guardian_id', 'is', null),
    supabase.from('payments').select('amount_paid').eq('school_id', schoolId).gte('paid_at', rangeStart.toISOString()),
    supabase.from('invoices').select('total_amount').eq('school_id', schoolId).is('deleted_at', null).gte('issued_at', rangeStart.toISOString()),
    supabase.from('invoices').select('id, total_amount, family_id').eq('school_id', schoolId).eq('status', 'vencido').is('deleted_at', null),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(sevenDaysAgo)),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(fourteenDaysAgo)).lt('date', isoDate(sevenDaysAgo)),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(twentyEightDaysAgo)),
    supabase.from('invoices').select('status, total_amount, issued_at').eq('school_id', schoolId).is('deleted_at', null).gte('issued_at', twelveMonthsAgo.toISOString()),
    supabase.from('students').select('created_at').eq('school_id', schoolId).is('deleted_at', null).gte('created_at', new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const formatDOP = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0, notation: n >= 1_000_000 ? 'compact' : 'standard' }).format(n)

  // ── Estudiantes inscritos ──────────────────────────────────────────
  const totalStudents = (enrolledStudents ?? []).length
  const newStudentsInRange = (studentsInRange ?? []).length
  const studentsSparkline = Array.from({ length: 10 }, (_, i) => {
    const day = isoDate(new Date(now.getTime() - (9 - i) * 24 * 60 * 60 * 1000))
    return (last10DaysStudents ?? []).filter((s) => isoDate(new Date(s.created_at as string)) === day).length
  })
  const sparkMax = Math.max(1, ...studentsSparkline)

  // ── Familias / acceso al portal ─────────────────────────────────────
  const guardianIdsWithAccess = new Set((accessProfiles ?? []).map((p) => p.guardian_id as string))
  const familiesWithAccess = new Set(
    (allGuardians ?? []).filter((g) => guardianIdsWithAccess.has(g.id as string)).map((g) => g.family_id as string)
  )
  const totalFamilies = new Set((allGuardians ?? []).map((g) => g.family_id as string)).size
  const accessPercent = totalFamilies > 0 ? Math.round((familiesWithAccess.size / totalFamilies) * 100) : 0

  // ── Asistencia (7 días) + delta vs. semana previa ────────────────────
  function attendancePercent(rows: { status: string }[] | null): number | null {
    const list = rows ?? []
    if (list.length === 0) return null
    return Math.round((list.filter((a) => a.status === 'presente').length / list.length) * 1000) / 10
  }
  const asistenciaPercent = attendancePercent(attendanceWeek)
  const asistenciaPrevPercent = attendancePercent(attendancePrevWeek)
  const asistenciaDelta = asistenciaPercent !== null && asistenciaPrevPercent !== null
    ? Math.round((asistenciaPercent - asistenciaPrevPercent) * 10) / 10
    : null

  // ── Cobrado en el rango seleccionado ─────────────────────────────────
  const cobradoRango = (paymentsInRange ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const facturadoRango = (invoicedInRange ?? []).reduce((sum, i) => sum + Number(i.total_amount), 0)
  const cobradoPercent = facturadoRango > 0 ? Math.min(100, Math.round((cobradoRango / facturadoRango) * 100)) : 0

  // ── Cartera vencida ───────────────────────────────────────────────────
  const overdue = overdueInvoices ?? []
  const carteraVencida = overdue.reduce((sum, i) => sum + Number(i.total_amount), 0)
  const familiasConMora = new Set(overdue.map((i) => i.family_id as string)).size

  // ── Flujo de cobranza -- año escolar (12 meses) ──────────────────────
  type InvoiceRow = { status: string; total_amount: number; issued_at: string }
  const invoiceRows = (invoicesYear ?? []) as InvoiceRow[]
  const monthKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const byMonth = new Map(monthKeys.map((k) => [k, { cobrado: 0, pendiente: 0, vencido: 0 }]))
  for (const inv of invoiceRows) {
    const d = new Date(inv.issued_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const row = byMonth.get(key)
    if (!row) continue
    if (inv.status === 'pagado') row.cobrado += Number(inv.total_amount)
    else if (inv.status === 'vencido') row.vencido += Number(inv.total_amount)
    else row.pendiente += Number(inv.total_amount)
  }
  const flujoCobranza = monthKeys.map((key) => {
    const [y, m] = key.split('-')
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-DO', { month: 'short' }).replace('.', '')
    const row = byMonth.get(key)!
    return { label, cobrado: Math.round(row.cobrado), pendiente: Math.round(row.pendiente), vencido: Math.round(row.vencido) }
  })

  // ── Asistencia diaria -- últimas 4 semanas ───────────────────────────
  type AttendanceRow = { date: string; status: string }
  const attendance4 = (attendance4Weeks ?? []) as AttendanceRow[]
  const byDay = new Map<string, { presente: number; total: number }>()
  for (const a of attendance4) {
    const row = byDay.get(a.date) ?? { presente: 0, total: 0 }
    row.total += 1
    if (a.status === 'presente') row.presente += 1
    byDay.set(a.date, row)
  }
  const dailyEntries = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))
  const asistenciaDiaria = dailyEntries.map(([date, { presente, total }]) => ({
    label: new Date(date + 'T00:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }),
    dateObj: date,
    asistencia: total > 0 ? Math.round((presente / total) * 1000) / 10 : 0,
  }))
  const validDays = asistenciaDiaria.filter((d) => d.asistencia > 0 || byDay.get(d.dateObj)!.total > 0)
  const promedio4Semanas = validDays.length > 0 ? Math.round((validDays.reduce((s, d) => s + d.asistencia, 0) / validDays.length) * 10) / 10 : null
  const minimo4Semanas = validDays.length > 0 ? validDays.reduce((min, d) => (d.asistencia < min.asistencia ? d : min)) : null

  // ── Estado de matrícula ───────────────────────────────────────────────
  const enrollmentCounts = (enrolledStudents ?? []).reduce((acc, s) => {
    const key = (s.enrollment_status as string | null) ?? 'prospecto'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const enrollmentDonut = Object.entries(enrollmentCounts).map(([status, value]) => ({ name: enrollmentLabels[status] ?? status, value }))
  const inscritosCount = enrollmentCounts['inscrito'] ?? 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <QueryErrorBanner errors={[
        { label: 'estudiantes', error: studentsRangeError || studentsPrevError || enrolledError || last10DaysError },
        { label: 'familias y acceso', error: guardiansError || accessError },
        { label: 'cobros', error: paymentsRangeError || invoicedRangeError },
        { label: 'cartera vencida', error: overdueError },
        { label: 'asistencia', error: attendanceWeekError || attendancePrevError || attendance4WeeksError },
        { label: 'facturación del año', error: invoicesYearError },
      ]} />

      {/* Encabezado + selector de rango */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold font-barlow text-dash-text tracking-tight">Centro de control</h1>
        <div className="dash-chip flex overflow-hidden">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r}
              href={`/dashboard/secretaria?range=${r}`}
              className="px-3.5 py-1.5 text-[13px] font-barlow uppercase tracking-[0.06em] transition"
              style={range === r ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' } : { color: 'var(--dash-text-muted)' }}
            >
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dash-card p-4">
          <p className="text-[11px] font-barlow uppercase tracking-[0.16em] text-dash-text-muted">Estudiantes inscritos</p>
          <div className="flex items-end gap-2 mt-2">
            <p className="text-[38px] leading-none font-bold font-barlow text-dash-text">{totalStudents}</p>
            <p className="text-xs text-dash-accent pb-1 whitespace-nowrap">+{newStudentsInRange} {rangeLabel}</p>
          </div>
          <div className="flex items-end gap-[3px] h-7 mt-3" aria-hidden="true">
            {studentsSparkline.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{ height: `${Math.max(8, (v / sparkMax) * 100)}%`, background: 'linear-gradient(180deg,#6ee7b7,#10b981)' }}
              />
            ))}
          </div>
        </div>

        <div className="dash-card p-4">
          <p className="text-[11px] font-barlow uppercase tracking-[0.16em] text-dash-text-muted">Familias registradas</p>
          <div className="flex items-end gap-2 mt-2">
            <p className="text-[38px] leading-none font-bold font-barlow text-dash-text">{totalFamilies}</p>
            <p className="text-xs text-dash-text-muted pb-1 whitespace-nowrap">{familiesWithAccess.size} con acceso</p>
          </div>
          <div className="h-[7px] rounded-full mt-3.5 overflow-hidden" style={{ background: 'rgba(150,225,196,.12)' }}>
            <div className="h-full rounded-full" style={{ width: `${accessPercent}%`, background: 'linear-gradient(90deg,#10b981,#6ee7b7)' }} />
          </div>
          <p className="text-[11px] text-dash-text-muted mt-1.5">{accessPercent}% activo el portal</p>
        </div>

        <div className="dash-card p-4">
          <p className="text-[11px] font-barlow uppercase tracking-[0.16em] text-dash-text-muted">Asistencia (7 días)</p>
          <div className="flex items-end gap-2 mt-2">
            <p className="text-[38px] leading-none font-bold font-barlow text-dash-text">{asistenciaPercent !== null ? `${asistenciaPercent}%` : '—'}</p>
            {asistenciaDelta !== null && (
              <p className="text-xs pb-1 whitespace-nowrap" style={{ color: asistenciaDelta >= 0 ? 'var(--dash-accent)' : 'var(--dash-warning)' }}>
                {asistenciaDelta >= 0 ? '+' : ''}{asistenciaDelta} pts
              </p>
            )}
          </div>
          <div className="flex items-end gap-[3px] h-7 mt-3" aria-hidden="true">
            {validDays.slice(-7).map((d, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{ height: `${Math.max(8, d.asistencia)}%`, background: 'linear-gradient(180deg,#6ee7b7,#10b981)' }}
              />
            ))}
          </div>
        </div>

        <div className="dash-card p-4">
          <p className="text-[11px] font-barlow uppercase tracking-[0.16em] text-dash-text-muted">Cobrado {rangeLabel}</p>
          <p className="text-[36px] leading-none font-bold font-barlow text-dash-text mt-2 whitespace-nowrap">{formatDOP(cobradoRango)}</p>
          <p className="text-xs text-dash-accent mt-1.5">{cobradoPercent}% de lo facturado {rangeLabel}</p>
          <div className="h-[7px] rounded-full mt-2.5 overflow-hidden" style={{ background: 'rgba(150,225,196,.12)' }}>
            <div className="h-full rounded-full" style={{ width: `${cobradoPercent}%`, background: 'linear-gradient(90deg,#10b981,#6ee7b7)' }} />
          </div>
        </div>
      </div>

      {/* Cartera vencida */}
      {overdue.length > 0 && (
        <div className="dash-card-danger p-5">
          <p className="text-[11px] font-barlow uppercase tracking-[0.16em]" style={{ color: 'var(--dash-danger-strong)' }}>Cartera vencida</p>
          <p className="text-[36px] leading-none font-bold font-barlow mt-2 whitespace-nowrap" style={{ color: 'var(--dash-danger-strong)' }}>{formatDOP(carteraVencida)}</p>
          <p className="text-xs mt-1.5" style={{ color: '#e3a79e' }}>{overdue.length} facturas · {familiasConMora} familias</p>
          <Link
            href="/dashboard/pagos"
            className="inline-block mt-2.5 text-xs font-barlow uppercase tracking-[0.08em]"
            style={{ color: 'var(--dash-danger-strong)', borderBottom: '1px solid rgba(255,157,144,.45)' }}
          >
            Ver gestión de moras
          </Link>
        </div>
      )}

      {/* Flujo de cobranza -- año escolar */}
      <div className="dash-card p-4 sm:p-5">
        <h2 className="text-[18px] font-bold font-barlow tracking-wide text-dash-text mb-3">FLUJO DE COBRANZA · AÑO ESCOLAR</h2>
        <StackedBarChart
          data={flujoCobranza}
          series={[
            { key: 'cobrado', label: 'Cobrado', color: CHART_SEMANTIC.success },
            { key: 'pendiente', label: 'Pendiente', color: CHART_SEMANTIC.neutral },
            { key: 'vencido', label: 'Vencido', color: CHART_SEMANTIC.danger },
          ]}
          horizontal={false}
          valueFormat="currency-dop"
          emptyMessage="Aún no hay facturación registrada."
        />
      </div>

      {/* Asistencia diaria + estado de matrícula */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="dash-card p-4 sm:p-5">
          <h2 className="text-base font-bold font-barlow tracking-wide text-dash-text">ASISTENCIA DIARIA · ÚLTIMAS 4 SEMANAS</h2>
          <p className="text-xs text-dash-text-muted mb-3.5">
            {promedio4Semanas !== null ? `Promedio ${promedio4Semanas}%` : 'Sin datos'}{minimo4Semanas ? ` · mínimo ${minimo4Semanas.asistencia}% el ${minimo4Semanas.label}` : ''}
          </p>
          <TrendChart
            data={asistenciaDiaria}
            series={[{ key: 'asistencia', label: '% presente', color: CHART_SEMANTIC.success }]}
            valueFormat="percent"
          />
        </div>
        <div className="dash-card p-4 sm:p-5">
          <h2 className="text-base font-bold font-barlow tracking-wide text-dash-text mb-3.5">ESTADO DE MATRÍCULA</h2>
          <DonutChart data={enrollmentDonut} centerLabel={`Inscritos ${inscritosCount}`} emptyMessage="Aún no hay estudiantes registrados." />
        </div>
      </div>

      {/* Acciones rápidas */}
      <div>
        <h2 className="text-[11px] font-barlow uppercase tracking-[0.16em] text-dash-text-muted mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/dashboard/estudiantes/nuevo', label: 'Nuevo Estudiante', icon: '➕' },
            { href: '/dashboard/comunicados/nuevo', label: 'Nuevo Comunicado', icon: '📝' },
            { href: '/dashboard/familias',           label: 'Ver Familias',     icon: '👨‍👩‍👧' },
            { href: '/dashboard/asistencia',         label: 'Registrar Asistencia', icon: '📅' },
            { href: '/dashboard/pagos',              label: 'Ver Pagos',        icon: '💳' },
            { href: '/dashboard/reportes',           label: 'Analíticas',       icon: '📊' },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              id={`action-${action.label.toLowerCase().replace(/\s/g, '-')}`}
              className="dash-card flex items-center gap-3 p-4 hover:border-dash-accent/40 transition group"
            >
              <span className="text-xl" aria-hidden="true">{action.icon}</span>
              <span className="text-sm font-medium text-dash-text-muted group-hover:text-dash-text transition">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
