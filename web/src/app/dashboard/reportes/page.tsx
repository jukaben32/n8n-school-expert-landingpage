import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import ChartCard from '@/components/charts/ChartCard'
import DonutChart from '@/components/charts/DonutChart'
import SimpleBarChart from '@/components/charts/SimpleBarChart'
import TrendChart from '@/components/charts/TrendChart'
import { CHART_SEMANTIC } from '@/lib/chartColors'

export const metadata: Metadata = {
  title: 'Analíticas — MentorIApp',
  description: 'Analíticas del colegio: estudiantes, asistencia, finanzas, comunicación y Academia.',
}

const enrollmentLabels: Record<string, string> = {
  prospecto: 'Prospecto', solicitud: 'Solicitud', evaluacion: 'Evaluación',
  admitido: 'Admitido', inscrito: 'Inscrito', retirado: 'Retirado',
}

function daysAgoStr(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}
function monthsAgoIso(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Analíticas — Solo para staff con el módulo `reportes` (dirección/admin/
 * finanzas/super_admin -- no profesor ni recepción). Todo agregado y
 * visualizado con gráficos reales (Recharts) en vez de números sueltos.
 */
export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId
  if (!profile || !canAccess(profile.role, 'reportes')) {
    redirect('/dashboard/secretaria')
  }

  const thirtyDaysAgoStr = daysAgoStr(30)
  const thirtyDaysAgoIso = daysAgoIso(30)
  const sixMonthsAgoIso = monthsAgoIso(6)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { data: attendanceRaw, error: attendanceError },
    { data: invoicesMonthRaw, error: invoicesMonthError },
    { data: invoicesTrendRaw, error: invoicesTrendError },
    { data: studentsRaw, error: studentsError },
    { data: messagesRaw, error: messagesError },
    { data: aiConversationsRaw, error: aiError },
    { data: directConvRaw, error: directConvError },
    { data: quizAttemptsRaw, error: quizError },
    { count: updatesCount },
  ] = await Promise.all([
    supabase.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', thirtyDaysAgoStr),
    supabase.from('invoices').select('status, total_amount').eq('school_id', schoolId).is('deleted_at', null).gte('issued_at', startOfMonth.toISOString()),
    supabase.from('invoices').select('status, total_amount, issued_at').eq('school_id', schoolId).is('deleted_at', null).gte('issued_at', sixMonthsAgoIso),
    supabase.from('students').select('enrollment_status, grade_level').eq('school_id', schoolId).is('deleted_at', null),
    supabase.from('messages').select('id, title, published_at, message_reads(user_id)').eq('school_id', schoolId).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(8),
    supabase.from('ai_conversations').select('channel').eq('school_id', schoolId).eq('role', 'user').gte('created_at', thirtyDaysAgoIso),
    supabase.from('direct_conversations').select('id, staff_last_read_at, direct_messages(sender_type, created_at)').eq('school_id', schoolId),
    supabase.from('quiz_attempts').select('score, max_score, lesson_id, lessons(title)').eq('school_id', schoolId).not('completed_at', 'is', null),
    supabase.from('class_updates').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).is('deleted_at', null).gte('created_at', thirtyDaysAgoIso),
  ])

  // ── Estudiantes ─────────────────────────────────────────────────────
  const students = (studentsRaw ?? []) as { enrollment_status: string | null; grade_level: string | null }[]
  const enrollmentCounts = students.reduce((acc, s) => {
    const key = s.enrollment_status ?? 'prospecto'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const enrollmentDonut = Object.entries(enrollmentCounts).map(([status, value]) => ({ name: enrollmentLabels[status] ?? status, value }))

  const gradeCounts = students.reduce((acc, s) => {
    const key = s.grade_level?.trim() || 'Sin asignar'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const gradeBar = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  // ── Asistencia ──────────────────────────────────────────────────────
  const attendance = (attendanceRaw ?? []) as { date: string; status: string }[]
  const attendanceByDay = new Map<string, { presente: number; total: number }>()
  for (const a of attendance) {
    const row = attendanceByDay.get(a.date) ?? { presente: 0, total: 0 }
    row.total += 1
    if (a.status === 'presente') row.presente += 1
    attendanceByDay.set(a.date, row)
  }
  const attendanceTrend = Array.from(attendanceByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { presente, total }]) => ({
      label: new Date(date + 'T00:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }),
      asistencia: total > 0 ? Math.round((presente / total) * 100) : 0,
    }))

  const attendanceLabels: Record<string, string> = { presente: 'Presente', ausente: 'Ausente', tardanza: 'Tardanza', justificado: 'Justificado' }
  const attendanceSemanticColors: Record<string, string> = {
    presente: CHART_SEMANTIC.success, ausente: CHART_SEMANTIC.danger, tardanza: CHART_SEMANTIC.warning, justificado: CHART_SEMANTIC.info,
  }
  const attendanceCounts = attendance.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
  const attendanceDonut = Object.entries(attendanceLabels).map(([status, name]) => ({ name, value: attendanceCounts[status] ?? 0, color: attendanceSemanticColors[status] }))

  // ── Finanzas ────────────────────────────────────────────────────────
  const invoicesMonth = (invoicesMonthRaw ?? []) as { status: string; total_amount: number }[]
  const totalInvoiced = invoicesMonth.reduce((sum, i) => sum + Number(i.total_amount), 0)
  const totalPaid = invoicesMonth.filter((i) => i.status === 'pagado').reduce((sum, i) => sum + Number(i.total_amount), 0)
  const totalPending = invoicesMonth.filter((i) => i.status === 'pendiente' || i.status === 'vencido').reduce((sum, i) => sum + Number(i.total_amount), 0)
  const formatDOP = (amount: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(amount)

  const invoicesTrendRows = (invoicesTrendRaw ?? []) as { status: string; total_amount: number; issued_at: string }[]
  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const revenueByMonth = new Map(monthKeys.map((k) => [k, { facturado: 0, cobrado: 0 }]))
  for (const inv of invoicesTrendRows) {
    const d = new Date(inv.issued_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const row = revenueByMonth.get(key)
    if (!row) continue
    row.facturado += Number(inv.total_amount)
    if (inv.status === 'pagado') row.cobrado += Number(inv.total_amount)
  }
  const revenueTrend = monthKeys.map((key) => {
    const [y, m] = key.split('-')
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-DO', { month: 'short' })
    const row = revenueByMonth.get(key)!
    return { label, facturado: Math.round(row.facturado), cobrado: Math.round(row.cobrado) }
  })

  // ── Comunicación ────────────────────────────────────────────────────
  type MessageRow = { id: string; title: string; published_at: string; message_reads: { user_id: string }[] }
  const messages = (messagesRaw ?? []) as unknown as MessageRow[]
  const readsBar = messages
    .map((m) => ({ name: m.title.length > 22 ? `${m.title.slice(0, 22)}…` : m.title, value: m.message_reads.length }))
    .reverse()

  const aiChannelLabels: Record<string, string> = { widget: 'Chat / voz (Portal)', whatsapp: 'WhatsApp', voice: 'Llamada en vivo' }
  const aiConversations = (aiConversationsRaw ?? []) as { channel: string }[]
  const aiChannelCounts = aiConversations.reduce((acc, c) => { acc[c.channel] = (acc[c.channel] ?? 0) + 1; return acc }, {} as Record<string, number>)
  const aiDonut = Object.entries(aiChannelCounts).map(([ch, value]) => ({ name: aiChannelLabels[ch] ?? ch, value }))

  type ConvRow = { id: string; staff_last_read_at: string | null; direct_messages: { sender_type: string; created_at: string }[] }
  const directConversations = (directConvRaw ?? []) as unknown as ConvRow[]
  const totalConversations = directConversations.length
  const totalDirectMessages = directConversations.reduce((sum, c) => sum + c.direct_messages.length, 0)
  const unreadConversations = directConversations.filter((c) =>
    c.direct_messages.some((m) => m.sender_type === 'guardian' && (!c.staff_last_read_at || m.created_at > c.staff_last_read_at))
  ).length

  // ── Academia ────────────────────────────────────────────────────────
  type AttemptRow = { score: number; max_score: number; lesson_id: string; lessons: { title: string } | null }
  const attempts = (quizAttemptsRaw ?? []) as unknown as AttemptRow[]
  const passThreshold = 0.6
  const passed = attempts.filter((a) => a.max_score > 0 && a.score / a.max_score >= passThreshold).length
  const failed = attempts.length - passed
  const academiaDonut = [
    { name: 'Aprobado (≥60%)', value: passed, color: CHART_SEMANTIC.success },
    { name: 'Por reforzar (<60%)', value: failed, color: CHART_SEMANTIC.warning },
  ]

  const byLesson = new Map<string, { title: string; totalPct: number; count: number }>()
  for (const a of attempts) {
    if (a.max_score === 0) continue
    const title = a.lessons?.title ?? 'Lección'
    const row = byLesson.get(a.lesson_id) ?? { title, totalPct: 0, count: 0 }
    row.totalPct += (a.score / a.max_score) * 100
    row.count += 1
    byLesson.set(a.lesson_id, row)
  }
  const lessonBar = Array.from(byLesson.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((r) => ({ name: r.title.length > 20 ? `${r.title.slice(0, 20)}…` : r.title, value: Math.round(r.totalPct / r.count) }))

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <QueryErrorBanner errors={[
        { label: 'la asistencia', error: attendanceError },
        { label: 'los cobros', error: invoicesMonthError || invoicesTrendError },
        { label: 'los estudiantes', error: studentsError },
        { label: 'los comunicados', error: messagesError },
        { label: 'el asistente de IA', error: aiError },
        { label: 'los mensajes directos', error: directConvError },
        { label: 'Academia', error: quizError },
      ]} />

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Analíticas
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Estudiantes, asistencia, finanzas, comunicación y Academia — de un vistazo.
        </p>
      </div>

      {/* ── Estudiantes ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-primary dark:text-accent-light">Estudiantes</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <ChartCard title="Por estado de inscripción">
            <DonutChart data={enrollmentDonut} centerLabel="Estudiantes" emptyMessage="Aún no hay estudiantes registrados." />
          </ChartCard>
          <ChartCard title="Por grado/sección">
            <SimpleBarChart data={gradeBar} horizontal emptyMessage="Asigna 'Grado/sección' en la ficha de cada estudiante para ver esto." />
          </ChartCard>
        </div>
      </section>

      {/* ── Asistencia ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-primary dark:text-accent-light">Asistencia (30 días)</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <ChartCard title="% de presentes por día" subtitle="Últimos 30 días" className="sm:col-span-2">
            <TrendChart
              data={attendanceTrend}
              series={[{ key: 'asistencia', label: '% presente', color: CHART_SEMANTIC.success }]}
              valueFormat="percent"
            />
          </ChartCard>
          <ChartCard title="Distribución">
            <DonutChart data={attendanceDonut} centerLabel="Registros" />
          </ChartCard>
        </div>
      </section>

      {/* ── Finanzas ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-primary dark:text-accent-light">Finanzas</h2>
        <ChartCard title="Cobros del mes en curso">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{formatDOP(totalInvoiced)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Facturado</p>
            </div>
            <div>
              <p className="text-2xl font-black text-green-600 dark:text-green-400 tabular-nums">{formatDOP(totalPaid)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cobrado</p>
            </div>
            <div>
              <p className="text-2xl font-black text-orange-600 dark:text-orange-400 tabular-nums">{formatDOP(totalPending)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pendiente / vencido</p>
            </div>
          </div>
        </ChartCard>
        <ChartCard title="Facturado vs. cobrado" subtitle="Últimos 6 meses">
          <TrendChart
            data={revenueTrend}
            series={[
              { key: 'facturado', label: 'Facturado', color: CHART_SEMANTIC.neutral },
              { key: 'cobrado', label: 'Cobrado', color: CHART_SEMANTIC.success },
            ]}
            valueFormat="currency-dop"
          />
        </ChartCard>
      </section>

      {/* ── Comunicación ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-primary dark:text-accent-light">Comunicación</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <ChartCard title="Lecturas por comunicado" subtitle="Últimos publicados">
            <SimpleBarChart data={readsBar} horizontal emptyMessage="Aún no has publicado ningún comunicado." />
          </ChartCard>
          <ChartCard title="Asistente de IA — uso por canal" subtitle="Últimos 30 días">
            <DonutChart data={aiDonut} centerLabel="Preguntas" emptyMessage="Sin actividad del asistente en este período." />
          </ChartCard>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{totalConversations}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">Conversaciones (Mensajes)</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{totalDirectMessages}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">Mensajes intercambiados</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xl font-black text-coral tabular-nums">{unreadConversations}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">Sin responder</p>
          </div>
        </div>
      </section>

      {/* ── Academia ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-primary dark:text-accent-light">Academia</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <ChartCard title="Desempeño en cuestionarios">
            <DonutChart data={academiaDonut} centerLabel="Intentos" emptyMessage="Aún no hay cuestionarios completados." />
          </ChartCard>
          <ChartCard title="Promedio por lección" subtitle="Top 8 por cantidad de intentos">
            <SimpleBarChart data={lessonBar} horizontal valueFormat="percent" emptyMessage="Aún no hay intentos de cuestionario." />
          </ChartCard>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {updatesCount ?? 0} actualizaciones con foto publicadas en los últimos 30 días.
        </p>
      </section>
    </div>
  )
}
