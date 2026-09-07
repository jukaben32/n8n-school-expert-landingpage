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

function addDaysToIsoDate(dateIso: string, days: number): Date {
  const date = new Date(dateIso + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return date
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
  // El calendario del año escolar ya no se asume aquí (antes se daba por
  // hecho que arranca el 1 de agosto): el gráfico de flujo lo toma de
  // `school_years.start_date`, que es lo que de verdad usa el motor de mora.

  const [
    { data: studentsInRange, error: studentsRangeError },
    { data: enrolledStudents, error: enrolledError },
    { data: allGuardians, error: guardiansError },
    { data: accessProfiles, error: accessError },
    { data: billingSettings, error: billingSettingsError },
    { data: paymentsInRange, error: paymentsRangeError },
    { data: receivablesRaw, error: receivablesError },
    { data: attendanceInRange, error: attendanceRangeError },
    { data: attendancePrevRange, error: attendancePrevError },
    { data: attendance4Weeks, error: attendance4WeeksError },
    { data: cashflowRaw, error: cashflowError },
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
    supabase.from('schools').select('tuition_grace_days').eq('id', schoolId).single(),
    supabase.from('payments').select('amount_paid').eq('school_id', schoolId).gte('paid_at', rangeStart.toISOString()),
    // Misma funcion que usa /dashboard/tesoreria/cuentas-por-cobrar --
    // un solo motor de mora para las dos pantallas (ver bloque "Cartera
    // vencida" mas abajo para por que la vieja consulta a `invoices` no
    // servia). Si la RPC falla, `data` viene null y las tarjetas quedan en
    // cero con el aviso de QueryErrorBanner, sin tumbar el panel.
    supabase.rpc('list_school_receivables', { p_school_id: schoolId }),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(rangeStart)),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(prevStart)).lt('date', isoDate(rangeStart)),
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', isoDate(twentyEightDaysAgo)),
    supabase.rpc('list_school_monthly_cashflow', { p_school_id: schoolId }),
    supabase.from('students').select('created_at').eq('school_id', schoolId).is('deleted_at', null).gte('created_at', new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', todayIso).eq('status', 'ausente'),
    supabase.from('payment_receipts').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pendiente'),
    supabase.from('staff_registrations').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pendiente'),
    supabase.from('authorization_requests').select('id, title, event_date, grade_level').eq('school_id', schoolId).is('closed_at', null).order('event_date', { ascending: true }),
  ])

  const formatDOP = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0, notation: n >= 1_000_000 ? 'compact' : 'standard' }).format(n)
  // Igual pero sin notación compacta: en el tooltip del gráfico una cuota
  // de un millón no puede quedar como "RD$ 1 M".
  const exactDOP = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
  const graceDays = Number(billingSettings?.tuition_grace_days ?? 5)

  // ── Estudiantes inscritos ──────────────────────────────────────────
  // La tarjeta dice "inscritos", asi que cuenta solo `enrollment_status =
  // 'inscrito'` -- antes contaba todo estudiante no borrado (incluidos
  // admitidos y retirados), y por eso nunca cuadraba con Cuentas por
  // Cobrar, que si filtra por inscrito.
  const totalStudentsAll = (enrolledStudents ?? []).length
  const totalStudents = (enrolledStudents ?? []).filter((s) => s.enrollment_status === 'inscrito').length
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
  // La "meta mensual" era lo facturado en el rango -- pero cada factura de
  // este colegio se crea ya pagada (Registrar pago), asi que cobrado y
  // facturado eran siempre el mismo numero y la tarjeta decia 100% pasara
  // lo que pasara. Ahora el porcentaje es cuantos estudiantes estan al dia
  // segun Cuentas por Cobrar (se calcula mas abajo, con los datos del RPC).
  const cobradoRango = (paymentsInRange ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)

  // ── Cartera vencida -- mismo motor que Cuentas por Cobrar ─────────────
  // Hasta 2026-09-07 esta tarjeta contaba facturas con `status = 'vencido'`.
  // Nada en todo el sistema escribe jamas ese estado: no hay trigger ni
  // cron, y la unica escritura de estado en la app es -> 'pagado'. Encima
  // este colegio no factura por adelantado (contabilidad por lo percibido),
  // asi que produccion tenia 44 facturas y las 44 pagadas. Resultado: la
  // tarjeta estaba condenada a RD$0 mientras Cuentas por Cobrar mostraba
  // RD$422,540 de deuda real. Ahora las dos pantallas leen la misma
  // funcion, `list_school_receivables`, que calcula la deuda implicita por
  // mensualidad (no necesita que exista ninguna factura) y su recargo por
  // etapas segun el manual de familia.
  type ReceivableRow = {
    student_id: string; first_name: string; last_name: string; family_id: string
    monthly_amount: number | null; expected_to_date: number | null
    overdue_amount: number; late_fee_amount: number; collected_amount: number
    oldest_overdue_due_date: string | null; days_overdue: number | null
    aging_bucket: string | null
  }
  const receivables = (receivablesRaw ?? []) as ReceivableRow[]
  // La RPC devuelve overdue_amount tambien para cuotas corrientes:
  // ya vencio la fecha nominal (dia 1), pero la familia aun puede pagar
  // sin mora hasta el dia 5. Para cartera vencida solo cuentan las filas
  // que salieron de ese periodo de gracia.
  const conDeuda = receivables.filter((r) => Number(r.overdue_amount) > 0 && r.aging_bucket !== 'corriente')
  const deudaVencida = conDeuda.reduce((sum, r) => sum + Number(r.overdue_amount), 0)
  const recargoAcumulado = conDeuda.reduce((sum, r) => sum + Number(r.late_fee_amount ?? 0), 0)
  // Lo que el panel debe reflejar: deuda + mora al dia de hoy, siempre.
  const carteraVencida = deudaVencida + recargoAcumulado
  const estudiantesConDeuda = conDeuda.length
  const familiasConMora = new Set(conDeuda.map((r) => r.family_id)).size
  const estudiantesAlDia = Math.max(0, receivables.length - estudiantesConDeuda)
  const alDiaPercent = receivables.length > 0
    ? Math.round((estudiantesAlDia / receivables.length) * 100)
    : 0

  // Top 5 familias por saldo. La deuda se calcula por estudiante, asi que
  // los hermanos se suman en una sola fila de la familia.
  type FamiliaMora = { monto: number; nombres: string[]; moraDesde: string | null; dias: number | null; diasMora: number | null }
  const porFamilia = new Map<string, FamiliaMora>()
  for (const r of conDeuda) {
    const row = porFamilia.get(r.family_id) ?? { monto: 0, nombres: [], moraDesde: null, dias: null, diasMora: null }
    row.monto += Number(r.overdue_amount) + Number(r.late_fee_amount ?? 0)
    row.nombres.push(r.first_name)
    if (r.oldest_overdue_due_date) {
      const moraDesdeIso = isoDate(addDaysToIsoDate(r.oldest_overdue_due_date, graceDays))
      if (row.moraDesde === null || moraDesdeIso < row.moraDesde) {
        row.moraDesde = moraDesdeIso
      }
    }
    row.dias = Math.max(row.dias ?? 0, Number(r.days_overdue ?? 0))
    const diasMora = r.days_overdue === null ? null : Math.max(1, Number(r.days_overdue) - graceDays + 1)
    row.diasMora = diasMora === null ? row.diasMora : Math.max(row.diasMora ?? 0, diasMora)
    porFamilia.set(r.family_id, row)
  }
  const top5Familias = [...porFamilia.entries()].sort((a, b) => b[1].monto - a[1].monto).slice(0, 5)
  const { data: top5FamilyNames } = top5Familias.length
    ? await supabase.from('families').select('id, name').in('id', top5Familias.map(([id]) => id))
    : { data: [] }
  const familyNameById = new Map((top5FamilyNames ?? []).map((f) => [f.id as string, f.name as string]))
  const overdueRows = top5Familias.map(([familyId, row]) => ({
    family: familyNameById.get(familyId) ?? 'Familia',
    students: row.nombres.join(', ') || '—',
    // `moraDesde` es un DATE: se le pega la hora para que el navegador no
    // lo corra un dia hacia atras por zona horaria.
    due: row.moraDesde ? new Date(row.moraDesde + 'T00:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '—',
    amount: formatDOP(row.monto),
    days: row.dias,
    moraDays: row.diasMora,
  }))

  // ── Flujo de cobranza -- cuota por cuota del año escolar ──────────────
  // Cada barra es la CUOTA de ese mes: cuánto se debía y cuánto se ha
  // cobrado hasta hoy, sin depender de que se haya emitido factura alguna
  // (antes esto leía `invoices` y salía siempre en cero, ver AGENTS.md).
  //
  // Aquí NO hay nada de lógica de cuotas. El reparto mes a mes lo hace
  // `list_school_monthly_cashflow` en SQL, que consume el mismo
  // `student_installment_schedule` que `calculate_receivable_status` -- o
  // sea, la misma y única definición de la regla de cobro que usa Cuentas
  // por Cobrar. La primera versión de este gráfico (2026-09-07) sí repartía
  // en TypeScript y por tanto duplicaba esa regla; se movió a SQL el mismo
  // día justamente para que no pueda desviarse.
  type CashflowRow = {
    period_month: string; is_due: boolean; is_overdue: boolean
    expected_amount: number; collected_amount: number
    pending_amount: number; overdue_amount: number
  }
  const cuotas = ((cashflowRaw ?? []) as CashflowRow[]).map((c) => ({
    // es-DO abrevia septiembre como "sept" (4 letras) y descuadra la fila
    // de etiquetas: se recortan todas a 3.
    label: new Date(c.period_month + 'T00:00:00')
      .toLocaleDateString('es-DO', { month: 'short' }).replace('.', '').slice(0, 3),
    exigible: Number(c.expected_amount ?? 0),
    cobrado: Number(c.collected_amount ?? 0),
    pendiente: Number(c.pending_amount ?? 0),
    vencido: Number(c.overdue_amount ?? 0),
    yaVencio: Boolean(c.is_overdue),
  }))

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
  const enProcesoCount = Math.max(0, totalStudentsAll - inscritosCount - retiradosCount)

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
  // Antes este hallazgo dependia de la brecha entre facturado y cobrado --
  // siempre cero aqui, porque toda factura se crea ya pagada. Ahora se
  // calcula sobre la cartera real: que tan concentrada esta la deuda.
  if (carteraVencida > 0 && porFamilia.size > 0) {
    const montos = [...porFamilia.values()].map((f) => f.monto).sort((a, b) => b - a)
    const mitad = carteraVencida / 2
    let acc = 0, n = 0
    for (const monto of montos) { acc += monto; n++; if (acc >= mitad) break }
    insights.push({
      text: `${n} familia${n !== 1 ? 's' : ''} de ${porFamilia.size} concentra${n !== 1 ? 'n' : ''} la mitad de la cartera vencida (${formatDOP(acc)} de ${formatDOP(carteraVencida)}).`,
      href: '/dashboard/tesoreria/cuentas-por-cobrar', action: 'Ver cuentas por cobrar →',
    })
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
  const maxMonthTotal = Math.max(1, ...cuotas.map((c) => c.exigible))
  const cashflowNormalized = cuotas.map((c) => ({
    label: c.label,
    paid: Math.round((c.cobrado / maxMonthTotal) * 100),
    pending: Math.round((c.pendiente / maxMonthTotal) * 100),
    overdue: Math.round((c.vencido / maxMonthTotal) * 100),
    hint: `${c.label}: ${exactDOP(c.exigible)} de cuota · ${exactDOP(c.cobrado)} cobrado`
      + (c.vencido > 0 ? ` · ${exactDOP(c.vencido)} vencido` : '')
      + (!c.yaVencio ? ' · aún no vence' : ''),
  }))
  const overdueRowsMapped: OverdueRow[] = overdueRows.map((r) => ({
    family: r.family,
    students: r.students,
    due: r.due,
    amount: r.amount,
    status: r.moraDays !== null ? `+${r.moraDays} día${r.moraDays !== 1 ? 's' : ''}` : '—',
    level: r.moraDays === null ? 'bajo' : r.moraDays > 9 ? 'alto' : 'medio',
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <QueryErrorBanner errors={[
        { label: 'estudiantes', error: studentsRangeError || enrolledError || last10DaysError },
        { label: 'familias y acceso', error: guardiansError || accessError },
        { label: 'configuración de cobro', error: billingSettingsError },
        { label: 'cobros', error: paymentsRangeError },
        { label: 'cartera vencida', error: receivablesError },
        { label: 'asistencia', error: attendanceRangeError || attendancePrevError || attendance4WeeksError || ausenciasHoyError },
        { label: 'flujo de cobranza', error: cashflowError },
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
        collected={{
          amount: formatDOP(cobradoRango),
          pctOfGoal: alDiaPercent,
          note: receivables.length > 0
            ? `${estudiantesAlDia} de ${receivables.length} estudiantes al día`
            : 'Sin mensualidad configurada',
        }}
        overdue={{
          amount: formatDOP(carteraVencida),
          students: estudiantesConDeuda,
          families: familiasConMora,
          lateFee: recargoAcumulado > 0 ? formatDOP(recargoAcumulado) : undefined,
        }}
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
