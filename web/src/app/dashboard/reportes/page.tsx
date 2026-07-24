import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Reportes — SchoolOS',
  description: 'Reportes agregados de asistencia, pagos e inscripción.',
}

const attendanceLabels: Record<string, string> = {
  presente: 'Presentes', ausente: 'Ausentes', tardanza: 'Tardanzas', justificado: 'Justificados',
}
const attendanceColors: Record<string, string> = {
  presente: 'bg-green-500', ausente: 'bg-red-500', tardanza: 'bg-yellow-500', justificado: 'bg-blue-500',
}
const enrollmentLabels: Record<string, string> = {
  prospecto: 'Prospecto', solicitud: 'Solicitud', evaluacion: 'Evaluación',
  admitido: 'Admitido', inscrito: 'Inscrito', retirado: 'Retirado',
}

/**
 * Página de Reportes — Solo para staff.
 * Resume, sobre los últimos 30 días: asistencia, cobros (facturado vs
 * cobrado vs pendiente) y la distribución de estudiantes por estado.
 */
export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId
  if (!profile || !canAccess(profile.role, 'reportes')) {
    redirect('/dashboard/secretaria')
  }

    const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [{ data: attendanceRaw }, { data: invoicesRaw }, { data: studentsRaw }] = await Promise.all([
    supabase.from('attendance').select('status').eq('school_id', schoolId).gte('date', thirtyDaysAgoStr),
    supabase.from('invoices').select('status, total_amount').eq('school_id', schoolId).is('deleted_at', null).gte('issued_at', startOfMonth.toISOString()),
    supabase.from('students').select('enrollment_status').eq('school_id', schoolId).is('deleted_at', null),
  ])

  const attendance = (attendanceRaw ?? []) as { status: string }[]
  const invoices = (invoicesRaw ?? []) as { status: string; total_amount: number }[]
  const students = (studentsRaw ?? []) as { enrollment_status: string | null }[]

  // Conteos de asistencia (últimos 30 días)
  const attendanceCounts = attendance.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const totalAttendance = attendance.length || 1

  // Facturación del mes en curso
  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total_amount), 0)
  const totalPaid = invoices.filter((i) => i.status === 'pagado').reduce((sum, i) => sum + Number(i.total_amount), 0)
  const totalPending = invoices.filter((i) => i.status === 'pendiente' || i.status === 'vencido').reduce((sum, i) => sum + Number(i.total_amount), 0)

  // Distribución de estudiantes por estado
  const enrollmentCounts = students.reduce((acc, s) => {
    const key = s.enrollment_status ?? 'prospecto'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const formatDOP = (amount: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Reportes
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Resumen de los últimos 30 días
        </p>
      </div>

      {/* Asistencia */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Asistencia (30 días)
        </h2>
        {attendance.length > 0 ? (
          <>
            <div className="flex h-3 rounded-full overflow-hidden">
              {Object.entries(attendanceCounts).map(([status, count]) => (
                <div
                  key={status}
                  className={attendanceColors[status] ?? 'bg-slate-300'}
                  style={{ width: `${(count / totalAttendance) * 100}%` }}
                  title={`${attendanceLabels[status] ?? status}: ${count}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(attendanceLabels).map(([status, label]) => (
                <div key={status}>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{attendanceCounts[status] ?? 0}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Sin registros de asistencia en este período.</p>
        )}
      </section>

      {/* Pagos */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Cobros del mes en curso
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{formatDOP(totalInvoiced)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Facturado</p>
          </div>
          <div>
            <p className="text-2xl font-black text-green-600 dark:text-green-400">{formatDOP(totalPaid)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cobrado</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{formatDOP(totalPending)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pendiente / vencido</p>
          </div>
        </div>
      </section>

      {/* Estudiantes por estado */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Estudiantes por estado de inscripción
        </h2>
        {students.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(enrollmentCounts).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <p className="text-xl font-black text-primary dark:text-accent-light">{count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{enrollmentLabels[status] ?? status}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay estudiantes registrados.</p>
        )}
      </section>
    </div>
  )
}
