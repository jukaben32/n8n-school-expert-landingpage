import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import PanelCentroControl, { type AlertRow, type OverdueRow, type Insight } from '@/components/dashboard/PanelCentroControl'

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

/**
 * Centro de Control — Vista principal para administradores, dirección y recepción.
 * Rediseño agosto 2026 (Claude Design), corregido contra el código fuente
 * real del diseño (no solo las capturas) el 22 de agosto. El selector
 * Hoy/Semana/Mes mueve la ventana de "Estudiantes inscritos", "Cobrado" y
 * "Asistencia" (esta última hasta el 2026-09-01 tenía una ventana fija de 7
 * días sin importar el selector -- confundía porque el selector está justo
 * encima de la tarjeta). El gráfico de "Asistencia diaria · últimas 4
 * semanas" más abajo sí sigue siendo una ventana fija a propósito -- lo
 * dice su propio título.
 *
 * "Lectura del día" del diseño original estaba narrada por IA con datos de
 * ejemplo -- aquí es una versión real pero más simple: 1-2 hallazgos
 * calculados de los datos que ya se consultan en esta página, no texto
 * generado. Ver nota junto a esa sección.
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
  const todayIso = isoDate(now)
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  // El período escolar de este colegio inicia el 17 de agosto y corre hasta
  // junio -- julio es de vacaciones colectivas, sin cobro. Si "ahora" cae
  // entre enero y julio, el año escolar en curso empezó en agosto del año
  // calendario anterior.
  const schoolYearStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const schoolYearStart = new Date(schoolYearStartYear, 7, 1) // 1 de agosto

  const [
    { data: studentsInRange, error: studentsRangeError },
    { data: enrolledStudents, error: enrolledError },
    { data: allGuardians, error: guardiansError },
    { data: accessProfiles, error: accessError },
    { data: paymentsInRange, error: paymentsRangeError },
    { data: invoicedInRange, error: invoicedRangeError },
    { data: overdueInvoicesRaw, error: overdueError },
    { data: attendanceInRange, error: attendanceRangeError },
    { data: attendancePrevRange, error: attendancePrevError },
    { data: attendance4Weeks, error: attendance4WeeksError },
    { data: invoicesYear, error: invoicesYearError },
    { data: last10DaysStudents, error: last10DaysError },
    { count: ausenciasHoy, error: ausenciasHoyError },
    { count: comprobantesPendientes, error: comprobantesError },
    { count: personalPendiente, error: personalPendienteError },
    { data: openAuthRequests, error: authRequestsError },
  ] = await Promise.all([
    supabase.from('students').select('id').eq('school_id', schoolId).is('deleted_at', null).gte('created_at', rangeStart.toISOString()),
    supabase.from('students').select('id, enrollment_status').eq('school_id', schoolId).is('deleted_at', null),
    supabase.from('guardians').select('id, family_id').eq('school_id', schoolId),
    supabase.from('users_profiles').select('guardian_id').eq('school_id', schoolId).not('guardian_id', 'is', null),
    supabase.from('payments').select('amount_paid').eq('school_id', schoolId).gte('paid_at', rangeStart.toISOString()),
    supabase.from('invoices').select('total_amount').eq('school_id', schoolId).is('deleted_at', null).gte('issued_at', rangeStart.toISOString()),
    supabase.from('invoices').select('id, total_amount, family_id, due_date, families(name)').eq('school_id', schoolId).eq('status', 'vencido').is('deleted_at', null).order('due_date', { ascending: true }).limit(5),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(rangeStart)),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(prevStart)).lt('date', isoDate(rangeStart)),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(twentyEightDaysAgo)),
    supabase.from('invoices').select('status, total_amount, issued_at').eq('school_id', schoolId).is('deleted_at', null).gte('issued_at', schoolYearStart.toISOString()),
    supabase.from('students').select('created_at').eq('school_id', schoolId).is('deleted_at', null).gte('created_at', new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', todayIso).eq('status', 'ausente'),
    supabase.from('payment_receipts').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pendiente'),
    supabase.from('staff_registrations').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pendiente'),
    supabase.from('authorization_requests').select('id, title, event_date, grade_level').eq('school_id', schoolId).is('closed_at', null).order('event_date', { ascending: true }),
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

  // ── Asistencia en el rango seleccionado + delta vs. período anterior de
  // igual duración ── antes esta tarjeta ignoraba el selector Hoy/Semana/Mes
  // y siempre mostraba una ventana fija de 7 días, aunque el título del
  // selector daba a entender que controlaba toda la página.
  function attendancePercent(rows: { status: string }[] | null): number | null {
    const list = rows ?? []
    if (list.length === 0) return null
    return Math.round((list.filter((a) => a.status === 'presente').length / list.length) * 1000) / 10
  }
  const asistenciaPercent = attendancePercent(attendanceInRange)
  const asistenciaPrevPercent = attendancePercent(attendancePrevRange)
  const asistenciaDelta = asistenciaPercent !== null && asistenciaPrevPercent !== null
    ? Math.round((asistenciaPercent - asistenciaPrevPercent) * 10) / 10
    : null

  // ── Cobrado en el rango seleccionado ─────────────────────────────────
  const cobradoRango = (paymentsInRange ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const facturadoRango = (invoicedInRange ?? []).reduce((sum, i) => sum + Number(i.total_amount), 0)
  const cobradoPercent = facturadoRango > 0 ? Math.min(100, Math.round((cobradoRango / facturadoRango) * 100)) : 0
  const brechaCobro = Math.max(0, facturadoRango - cobradoRango)

  // ── Cartera vencida ───────────────────────────────────────────────────
  type OverdueInvoice = { id: string; total_amount: number; family_id: string; due_date: string | null; families: { name: string } | null }
  const overdueTop5 = (overdueInvoicesRaw ?? []) as unknown as OverdueInvoice[]
  const { count: overdueCountTotal } = await supabase
    .from('invoices').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'vencido').is('deleted_at', null)
  const { data: overdueAllForSum } = await supabase
    .from('invoices').select('total_amount, family_id').eq('school_id', schoolId).eq('status', 'vencido').is('deleted_at', null)
  const carteraVencida = (overdueAllForSum ?? []).reduce((sum, i) => sum + Number(i.total_amount), 0)
  const familiasConMora = new Set((overdueAllForSum ?? []).map((i) => i.family_id as string)).size

  const overdueTop5FamilyIds = overdueTop5.map((i) => i.family_id)
  const { data: studentsForOverdue } = overdueTop5FamilyIds.length
    ? await supabase.from('students').select('first_name, family_id').in('family_id', overdueTop5FamilyIds).is('deleted_at', null)
    : { data: [] }
  const studentNamesByFamily = new Map<string, string[]>()
  for (const s of studentsForOverdue ?? []) {
    const list = studentNamesByFamily.get(s.family_id as string) ?? []
    list.push(s.first_name as string)
    studentNamesByFamily.set(s.family_id as string, list)
  }
  const overdueRows = overdueTop5.map((inv) => {
    const days = inv.due_date ? Math.max(0, Math.round((now.getTime() - new Date(inv.due_date).getTime()) / (24 * 60 * 60 * 1000))) : null
    return {
      family: inv.families?.name ?? 'Familia',
      students: (studentNamesByFamily.get(inv.family_id) ?? []).join(', ') || '—',
      due: inv.due_date ? new Date(inv.due_date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '—',
      amount: formatDOP(Number(inv.total_amount)),
      days,
    }
  })

  // ── Flujo de cobranza -- año escolar (agosto a junio, sin julio) ──────
  // Agosto es medio mes (el período inicia el 17) -- el año escolar completo
  // son 10.5 meses de cobro, nunca 12: julio queda fuera por las vacaciones
  // colectivas de los estudiantes.
  type InvoiceRow = { status: string; total_amount: number; issued_at: string }
  const invoiceRows = (invoicesYear ?? []) as InvoiceRow[]
  const monthKeys: string[] = []
  for (let i = 0; i < 11; i++) {
    const d = new Date(schoolYearStartYear, 7 + i, 1) // ago(7)..jun(18 -> 6 del año siguiente), Date normaliza el año
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

  // ── Estado de matrícula (3 grupos, como el diseño) ───────────────────
  const enrollmentCounts = (enrolledStudents ?? []).reduce((acc, s) => {
    const key = (s.enrollment_status as string | null) ?? 'prospecto'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const inscritosCount = enrollmentCounts['inscrito'] ?? 0
  const retiradosCount = enrollmentCounts['retirado'] ?? 0
  const enProcesoCount = Math.max(0, totalStudents - inscritosCount - retiradosCount)

  // ── Autorizaciones sin respuesta (abiertas) ──────────────────────────
  let autorizacionesSinResponder = 0
  let autorizacionDetalle = 'Sin campañas abiertas'
  if (openAuthRequests && openAuthRequests.length > 0) {
    const perRequest = await Promise.all(
      openAuthRequests.map(async (r) => {
        const studentsQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).is('deleted_at', null)
        const { count: total } = r.grade_level ? await studentsQuery.eq('grade_level', r.grade_level) : await studentsQuery
        const { count: respondidos } = await supabase.from('authorization_responses').select('id', { count: 'exact', head: true }).eq('authorization_request_id', r.id)
        return { title: r.title, event_date: r.event_date as string | null, pendientes: Math.max((total ?? 0) - (respondidos ?? 0), 0) }
      })
    )
    autorizacionesSinResponder = perRequest.reduce((sum, r) => sum + r.pendientes, 0)
    const soonest = perRequest.filter((r) => r.pendientes > 0).sort((a, b) => (a.event_date ?? '9999').localeCompare(b.event_date ?? '9999'))[0]
    if (soonest) {
      autorizacionDetalle = soonest.event_date
        ? `${soonest.title} · cierra ${new Date(soonest.event_date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}`
        : soonest.title
    }
  }

  // ── Requiere atención ─────────────────────────────────────────────────
  const alerts: AlertRow[] = [
    { title: 'Ausencias sin justificar', detail: 'Hoy · requieren llamada a la familia', count: String(ausenciasHoy ?? 0), level: 'alto' as const },
    { title: 'Autorizaciones sin respuesta', detail: autorizacionDetalle, count: String(autorizacionesSinResponder), level: 'medio' as const },
    { title: 'Comprobantes por validar', detail: 'Transferencias subidas por familias', count: String(comprobantesPendientes ?? 0), level: 'medio' as const },
    { title: 'Registros de personal pendientes', detail: 'Formulario público de contratación', count: String(personalPendiente ?? 0), level: 'bajo' as const },
  ].filter((a) => Number(a.count) > 0)

  // ── Lectura del día -- hallazgos reales calculados aquí mismo, no
  // narrados por IA como en el diseño original (ver nota junto al panel). ──
  const insights: Insight[] = []
  if (brechaCobro > 0 && overdueAllForSum && overdueAllForSum.length > 0) {
    const sorted = [...overdueAllForSum].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
    let acc = 0, n = 0
    for (const inv of sorted) { acc += Number(inv.total_amount); n++; if (acc >= brechaCobro) break }
    if (n > 0) {
      insights.push({
        text: `Si se cobra la mora de las ${n} familia${n !== 1 ? 's' : ''} con mayor saldo, se cierra la meta ${rangeLabel} sin gestionar el resto.`,
        href: '/dashboard/pagos', action: 'Ver gestión de moras →',
      })
    }
  }
  if (asistenciaDelta !== null && asistenciaDelta <= -1) {
    insights.push({
      text: `La asistencia bajó ${Math.abs(asistenciaDelta)} puntos ${rangeLabel} frente al período anterior.`,
      href: '/dashboard/asistencia', action: 'Ver asistencia →',
    })
  }

  // ── Mapeo final hacia PanelCentroControl ─────────────────────────────
  const studentsSpark = studentsSparkline.map((v) => Math.max(8, Math.round((v / sparkMax) * 100)))
  const asistenciaSpark = validDays.slice(-7).map((d) => Math.max(4, Math.round(d.asistencia)))
  // PanelCentroControl asume que los valores de la línea de asistencia
  // están entre 85-100% (su fórmula de escala en Y no se ajusta a otro
  // rango) y divide por (largo del arreglo - 1) para ubicar cada punto en
  // el eje X -- con un solo punto eso es una división entre cero (NaN).
  // Sin datos reales, un [0, 0] se sale tan lejos de esa escala que el
  // polígono del área se dibuja gigante y tapa el resto de la página
  // (el SVG tiene overflow:visible a propósito, para el trazo/puntito).
  // Con cero o un solo día de datos, se manda una línea plana dentro del
  // rango esperado -- "Sin datos todavía" ya lo dice en el texto de al lado.
  const asistenciaSeriesRaw = validDays.map((d) => d.asistencia)
  const asistenciaSeries = asistenciaSeriesRaw.length >= 2 ? asistenciaSeriesRaw : [asistenciaSeriesRaw[0] ?? 95, asistenciaSeriesRaw[0] ?? 95]
  const maxMonthTotal = Math.max(1, ...flujoCobranza.map((m) => m.cobrado + m.pendiente + m.vencido))
  const cashflowNormalized = flujoCobranza.map((m) => ({
    label: m.label,
    paid: Math.round((m.cobrado / maxMonthTotal) * 100),
    pending: Math.round((m.pendiente / maxMonthTotal) * 100),
    overdue: Math.round((m.vencido / maxMonthTotal) * 100),
  }))
  const overdueRowsMapped: OverdueRow[] = overdueRows.map((r) => ({
    family: r.family,
    students: r.students,
    due: r.due,
    amount: r.amount,
    status: r.days !== null ? `+${r.days} días` : '—',
    level: r.days === null ? 'bajo' : r.days > 14 ? 'alto' : r.days >= 6 ? 'medio' : 'bajo',
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <QueryErrorBanner errors={[
        { label: 'estudiantes', error: studentsRangeError || enrolledError || last10DaysError },
        { label: 'familias y acceso', error: guardiansError || accessError },
        { label: 'cobros', error: paymentsRangeError || invoicedRangeError },
        { label: 'cartera vencida', error: overdueError },
        { label: 'asistencia', error: attendanceRangeError || attendancePrevError || attendance4WeeksError || ausenciasHoyError },
        { label: 'facturación del año', error: invoicesYearError },
        { label: 'comprobantes', error: comprobantesError },
        { label: 'registros de personal', error: personalPendienteError },
        { label: 'autorizaciones', error: authRequestsError },
      ]} />

      {/* Encabezado + selector de rango -- van sobre el plato claro
          (dash-main en el <main> del layout), no sobre la concha oscura,
          así que usan colores oscuros, no los dash-text-* claros. */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold font-barlow text-slate-900 tracking-tight">Centro de control</h1>
        <div className="flex overflow-hidden rounded-[11px] border border-slate-200 bg-white">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r}
              href={`/dashboard/secretaria?range=${r}`}
              className="px-3.5 py-1.5 text-[13px] font-barlow uppercase tracking-[0.06em] transition"
              style={range === r ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' } : { color: '#5f7a70' }}
            >
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </div>
      </div>

      {/* PanelCentroControl ya arma sus propias tarjetas oscuras -- el
          plato claro donde flotan lo pone el <main> compartido del layout
          (dash-main), no hace falta duplicarlo aquí. */}
      <PanelCentroControl
        students={{ total: totalStudents, delta: `+${newStudentsInRange} ${rangeLabel}`, spark: studentsSpark }}
        families={{ total: totalFamilies, withAccess: familiesWithAccess.size, pct: accessPercent }}
        attendance={{
          pct: asistenciaPercent !== null ? `${asistenciaPercent}%` : '—',
          delta: asistenciaDelta !== null ? `${asistenciaDelta >= 0 ? '+' : ''}${asistenciaDelta} pts` : 'Sin datos previos',
          label: RANGE_LABELS[range],
          spark: asistenciaSpark,
          series: asistenciaSeries,
          note: promedio4Semanas !== null
            ? `Promedio ${promedio4Semanas}%${minimo4Semanas ? ` · mínimo ${minimo4Semanas.asistencia}% el ${minimo4Semanas.label}` : ''}`
            : 'Sin datos todavía',
        }}
        collected={{ amount: formatDOP(cobradoRango), pctOfGoal: cobradoPercent }}
        overdue={{ amount: formatDOP(carteraVencida), invoices: overdueCountTotal ?? 0, families: familiasConMora }}
        enrollment={{ enrolled: inscritosCount, inProcess: enProcesoCount, withdrawn: retiradosCount }}
        cashflow={cashflowNormalized}
        overdueRows={overdueRowsMapped}
        alerts={alerts}
        insights={insights}
        showInsights={insights.length > 0}
      />
    </div>
  )
}
