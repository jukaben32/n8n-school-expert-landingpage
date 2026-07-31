import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { enterSchool } from './actions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import SchoolsComparisonTable, { type SchoolComparisonRow } from './SchoolsComparisonTable'

export const metadata: Metadata = {
  title: 'Plataforma — MentorIApp',
  description: 'Todos los colegios de la plataforma.',
}

type SchoolRow = { id: string; name: string; subdomain: string; created_at: string }

function daysAgoDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Plataforma — Solo para super_admin.
 * Lista TODOS los colegios (RLS lo permite vía is_super_admin()),
 * con estudiantes y staff registrados en cada uno.
 */
export default async function PlataformaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard/secretaria')
  }

  const { data: schoolsRaw, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name, subdomain, created_at')
    .order('created_at', { ascending: false })

  const schools = (schoolsRaw ?? []) as SchoolRow[]

  // Conteos y métricas comparativas por colegio (una consulta por colegio;
  // la plataforma normalmente maneja pocos colegios, así que esto es
  // aceptable para el MVP -- revisar si el rendimiento se vuelve un
  // problema real con muchos más colegios afiliados).
  const thirtyDaysAgo = daysAgoDate(30)
  const sevenDaysAgoIso = daysAgoIso(7)

  const counts = await Promise.all(
    schools.map(async (school) => {
      const [
        { count: students },
        { count: staffCount },
        { data: pendingRows },
        { data: overdueRows },
        { data: attendanceMonth },
        { count: aiMessagesWeek },
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school.id).is('deleted_at', null),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', school.id).is('deleted_at', null),
        supabase.from('invoices').select('total_amount').eq('school_id', school.id).eq('status', 'pendiente').is('deleted_at', null),
        supabase.from('invoices').select('total_amount').eq('school_id', school.id).eq('status', 'vencido').is('deleted_at', null),
        supabase.from('attendance').select('status').eq('school_id', school.id).gte('date', thirtyDaysAgo),
        supabase.from('ai_conversations').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'user').gte('created_at', sevenDaysAgoIso),
      ])

      const pendienteSum = (pendingRows ?? []).reduce((s, i) => s + Number(i.total_amount), 0)
      const vencidoSum = (overdueRows ?? []).reduce((s, i) => s + Number(i.total_amount), 0)
      const morosidadPercent = pendienteSum + vencidoSum > 0 ? Math.round((vencidoSum / (pendienteSum + vencidoSum)) * 100) : 0

      const attendanceTotal = (attendanceMonth ?? []).length
      const attendancePresent = (attendanceMonth ?? []).filter((a) => a.status === 'presente').length
      const asistenciaPercent = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null

      return {
        schoolId: school.id,
        students: students ?? 0,
        staff: staffCount ?? 0,
        morosidadPercent,
        asistenciaPercent,
        aiMessagesWeek: aiMessagesWeek ?? 0,
      }
    })
  )
  const countsBySchool = new Map(counts.map((c) => [c.schoolId, c]))
  const comparisonRows: SchoolComparisonRow[] = schools.map((school) => {
    const c = countsBySchool.get(school.id)
    return {
      id: school.id,
      name: school.name,
      subdomain: school.subdomain,
      students: c?.students ?? 0,
      staff: c?.staff ?? 0,
      morosidadPercent: c?.morosidadPercent ?? 0,
      asistenciaPercent: c?.asistenciaPercent ?? null,
      aiMessagesWeek: c?.aiMessagesWeek ?? 0,
    }
  })

  // Métricas de toda la red -- sin filtrar por colegio, el bypass de
  // is_super_admin() en cada tabla es justo lo que hace esto posible.
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: totalStudents },
    { count: totalStaff },
    { data: paidInvoices, error: paidInvoicesError },
    { count: messagesThisMonth },
  ] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('staff').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('invoices').select('total_amount').eq('status', 'pagado').gte('paid_at', startOfMonth.toISOString()),
    supabase.from('messages').select('id', { count: 'exact', head: true }).not('published_at', 'is', null).gte('published_at', startOfMonth.toISOString()),
  ])

  const revenueThisMonth = (paidInvoices ?? []).reduce((sum, i) => sum + Number(i.total_amount), 0)
  const formatDOP = (amount: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(amount)

  const networkStats = [
    { label: 'Colegios afiliados', value: schools.length },
    { label: 'Estudiantes en total', value: totalStudents ?? 0 },
    { label: 'Personal en total', value: totalStaff ?? 0 },
    { label: 'Cobrado este mes', value: formatDOP(revenueThisMonth) },
    { label: 'Comunicados este mes', value: messagesThisMonth ?? 0 },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los colegios', error: schoolsError }, { label: 'los cobros', error: paidInvoicesError }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Plataforma
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {schools.length} colegio{schools.length !== 1 ? 's' : ''} en MentorIApp
          </p>
        </div>
        <Link
          href="/dashboard/plataforma/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
        >
          + Nuevo colegio
        </Link>
      </div>

      {/* Resumen de toda la red */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {networkStats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xl font-black text-primary dark:text-accent-light truncate">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {schoolsError && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <p className="font-semibold">No se pudo cargar la lista de colegios.</p>
          <p className="mt-1 font-mono text-xs">{schoolsError.message}</p>
        </div>
      )}

      {schools.length > 0 ? (
        <SchoolsComparisonTable schools={comparisonRows} enterSchoolAction={enterSchool} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🏫</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Aún no hay colegios registrados.</p>
        </div>
      )}
    </div>
  )
}
