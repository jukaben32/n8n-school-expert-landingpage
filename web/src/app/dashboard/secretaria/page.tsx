import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Secretaría — SchoolOS',
  description: 'Panel de gestión escolar para el equipo administrativo.',
}

function daysAgoDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

/**
 * Portal de Secretaría — Vista principal para administradores, dirección y recepción.
 * Muestra: métricas rápidas (total estudiantes, comunicados pendientes, pagos).
 */
export default async function SecretariaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener el school_id del perfil
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

  // Rango del mes en curso, para el conteo de comunicados publicados
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const sevenDaysAgo = daysAgoDate(7)

  // Métricas básicas
  const [
    { count: totalStudents, error: studentsCountError },
    { count: totalFamilies, error: familiesCountError },
    { count: messagesThisMonth, error: messagesCountError },
    { count: pendingInvoices, error: invoicesCountError },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('families').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('published_at', startOfMonth)
      .not('published_at', 'is', null),
    supabase.from('invoices').select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .in('status', ['pendiente', 'vencido']),
  ])

  // ── Financiero: cobrado este mes / pendiente / vencido ────────────────
  const [
    { data: paymentsThisMonth, error: paymentsError },
    { data: pendingInvoiceRows, error: pendingRowsError },
    { data: overdueInvoiceRows, error: overdueRowsError },
  ] = await Promise.all([
    supabase.from('payments').select('amount_paid').eq('school_id', schoolId).gte('paid_at', startOfMonth),
    supabase.from('invoices').select('total_amount').eq('school_id', schoolId).eq('status', 'pendiente').is('deleted_at', null),
    supabase.from('invoices').select('total_amount').eq('school_id', schoolId).eq('status', 'vencido').is('deleted_at', null),
  ])
  const cobradoMes = (paymentsThisMonth ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const pendienteTotal = (pendingInvoiceRows ?? []).reduce((sum, i) => sum + Number(i.total_amount), 0)
  const vencidoTotal = (overdueInvoiceRows ?? []).reduce((sum, i) => sum + Number(i.total_amount), 0)

  // ── Académico: asistencia de los últimos 7 días, participación en Academia ──
  const [
    { data: attendanceWeek, error: attendanceWeekError },
    { data: studentIdsForAcademia, error: studentIdsError },
    { data: activeAttemptsMonth, error: attemptsError },
  ] = await Promise.all([
    supabase.from('attendance').select('status').eq('school_id', schoolId).gte('date', sevenDaysAgo),
    supabase.from('students').select('id').eq('school_id', schoolId).eq('enrollment_status', 'inscrito').is('deleted_at', null),
    supabase.from('quiz_attempts').select('student_id').gte('completed_at', startOfMonth).not('completed_at', 'is', null),
  ])
  const totalAttendanceRecords = (attendanceWeek ?? []).length
  const presentRecords = (attendanceWeek ?? []).filter((a) => a.status === 'presente').length
  const asistenciaPercent = totalAttendanceRecords > 0 ? Math.round((presentRecords / totalAttendanceRecords) * 100) : null

  const enrolledStudentIds = new Set((studentIdsForAcademia ?? []).map((s) => s.id))
  const studentsWithAttemptsThisSchool = new Set(
    (activeAttemptsMonth ?? []).map((a) => a.student_id).filter((id) => enrolledStudentIds.has(id))
  )
  const academiaParticipacionPercent = enrolledStudentIds.size > 0
    ? Math.round((studentsWithAttemptsThisSchool.size / enrolledStudentIds.size) * 100)
    : null

  // ── Comunicación: comunicados leídos vs. enviados este mes ────────────
  const { data: messagesThisMonthRows, error: messagesRowsError } = await supabase
    .from('messages')
    .select('id')
    .eq('school_id', schoolId)
    .gte('published_at', startOfMonth)
    .not('published_at', 'is', null)
  const messageIdsThisMonth = (messagesThisMonthRows ?? []).map((m) => m.id)
  const { count: readsThisMonth, error: readsError } = messageIdsThisMonth.length
    ? await supabase.from('message_reads').select('*', { count: 'exact', head: true }).in('message_id', messageIdsThisMonth)
    : { count: 0, error: null }

  // ── Asistente de IA: preguntas de familias en los últimos 7 días ──────
  const { count: aiMessagesWeek, error: aiCountError } = await supabase
    .from('ai_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('role', 'user')
    .gte('created_at', sevenDaysAgo)

  const formatDOP = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

  const metrics = [
    { label: 'Estudiantes inscritos', value: totalStudents ?? 0, icon: '🎒', color: 'text-primary dark:text-accent-light' },
    { label: 'Familias registradas',  value: totalFamilies ?? 0, icon: '👨‍👩‍👧', color: 'text-primary dark:text-accent-light' },
    { label: 'Comunicados este mes',  value: messagesThisMonth ?? 0, icon: '📬', color: 'text-primary dark:text-accent-light' },
    { label: 'Pagos pendientes',      value: pendingInvoices ?? 0, icon: '💳', color: 'text-primary dark:text-accent-light' },
  ]

  return (
    <div className="space-y-8">
      <QueryErrorBanner errors={[
        { label: 'estudiantes', error: studentsCountError },
        { label: 'familias', error: familiesCountError },
        { label: 'comunicados', error: messagesCountError },
        { label: 'pagos pendientes', error: invoicesCountError },
        { label: 'cobros del mes', error: paymentsError },
        { label: 'facturas pendientes', error: pendingRowsError },
        { label: 'facturas vencidas', error: overdueRowsError },
        { label: 'asistencia de la semana', error: attendanceWeekError },
        { label: 'estudiantes inscritos (academia)', error: studentIdsError },
        { label: 'intentos de academia', error: attemptsError },
        { label: 'comunicados del mes', error: messagesRowsError },
        { label: 'lecturas de comunicados', error: readsError },
        { label: 'uso del asistente de IA', error: aiCountError },
      ]} />

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Panel de Secretaría
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Vista general del colegio
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
          >
            <p className="text-2xl mb-2" aria-hidden="true">{m.icon}</p>
            <p className={`text-3xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Financiero */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Financiero
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Cobrado este mes</p>
            <p className="text-2xl font-black text-green-600 dark:text-green-400">{formatDOP(cobradoMes)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Pendiente (sin vencer)</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatDOP(pendienteTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Vencido</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400">{formatDOP(vencidoTotal)}</p>
          </div>
        </div>
      </div>

      {/* Académico */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Académico
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Asistencia (últimos 7 días)</p>
            <p className="text-2xl font-black text-primary dark:text-accent-light">
              {asistenciaPercent !== null ? `${asistenciaPercent}%` : 'Sin registros'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Participación en Academia (mes)</p>
            <p className="text-2xl font-black text-primary dark:text-accent-light">
              {academiaParticipacionPercent !== null ? `${academiaParticipacionPercent}%` : 'Sin estudiantes inscritos'}
            </p>
          </div>
        </div>
      </div>

      {/* Comunicación + Asistente de IA */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Comunicación y Asistente de IA
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Comunicados leídos este mes</p>
            <p className="text-2xl font-black text-primary dark:text-accent-light">
              {readsThisMonth ?? 0} <span className="text-sm font-normal text-slate-400">de {messageIdsThisMonth.length} enviados</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Preguntas al asistente (últimos 7 días)</p>
            <p className="text-2xl font-black text-primary dark:text-accent-light">{aiMessagesWeek ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/dashboard/estudiantes/nuevo', label: 'Nuevo Estudiante', icon: '➕' },
            { href: '/dashboard/comunicados/nuevo', label: 'Nuevo Comunicado', icon: '📝' },
            { href: '/dashboard/familias',           label: 'Ver Familias',     icon: '👨‍👩‍👧' },
            { href: '/dashboard/asistencia',         label: 'Registrar Asistencia', icon: '📅' },
            { href: '/dashboard/pagos',              label: 'Ver Pagos',        icon: '💳' },
            { href: '/dashboard/reportes',           label: 'Reportes',         icon: '📊' },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              id={`action-${action.label.toLowerCase().replace(/\s/g, '-')}`}
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30 dark:hover:border-accent/30 hover:shadow-soft transition group"
            >
              <span className="text-xl" aria-hidden="true">{action.icon}</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-accent-light transition">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
