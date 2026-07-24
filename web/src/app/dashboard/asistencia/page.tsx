import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Asistencia — SchoolOS',
  description: 'Registro y seguimiento de asistencia estudiantil.',
}

const statusConfig = {
  presente:   { label: 'Presente',   color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  ausente:    { label: 'Ausente',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  tardanza:   { label: 'Tardanza',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  justificado:{ label: 'Justificado',color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

/**
 * Página de Asistencia
 * - Staff: ver registros de hoy y registrar asistencia.
 * - Guardians: ver el historial de asistencia de sus hijos.
 */
export default async function AsistenciaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, guardian_id')
    .eq('auth_id', user.id)
    .single()

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId

  const isStaff = ['director', 'school_admin', 'teacher', 'reception', 'super_admin']
    .includes(profile?.role ?? '')

  const today = new Date().toISOString().split('T')[0]

  let records: { id: string; date: string; status: string; student: { first_name: string; last_name: string } | null; notified_at: string | null }[] = []

  if (isStaff) {
    // Staff: registros de asistencia de HOY en este colegio
    const { data } = await supabase
      .from('attendance')
      .select('id, date, status, notified_at, students(first_name, last_name)')
      .eq('school_id', schoolId)
      .eq('date', today)
      .order('created_at', { ascending: false })

    records = ((data as unknown) as typeof records) ?? []
  } else if (profile?.guardian_id) {
    // Guardian: historial de asistencia de sus hijos (últimos 30 días)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data } = await supabase
      .from('attendance')
      .select('id, date, status, notified_at, students(first_name, last_name)')
      .in('student_id', (
        await supabase
          .from('student_guardians')
          .select('student_id')
          .eq('guardian_id', profile.guardian_id)
      ).data?.map((r: { student_id: string }) => r.student_id) ?? [])
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })

    records = ((data as unknown) as typeof records) ?? []
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Asistencia
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isStaff
              ? `Registros del día: ${new Date(today).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}`
              : 'Historial de asistencia (últimos 30 días)'}
          </p>
        </div>

        {/* Botón registrar (solo staff) */}
        {isStaff && (
          <a
            id="btn-registrar-asistencia"
            href="/dashboard/asistencia/registrar"
            className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Registrar
          </a>
        )}
      </div>

      {/* Tabla de registros */}
      {records.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Estudiante</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Notificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.map((r) => {
                const cfg = statusConfig[r.status as keyof typeof statusConfig]
                return (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {r.student?.first_name} {r.student?.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(r.date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg?.color ?? ''}`}>
                        {cfg?.label ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.notified_at ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Enviado
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📅</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {isStaff ? 'No hay registros de asistencia para hoy.' : 'No hay registros en los últimos 30 días.'}
          </p>
        </div>
      )}
    </div>
  )
}
