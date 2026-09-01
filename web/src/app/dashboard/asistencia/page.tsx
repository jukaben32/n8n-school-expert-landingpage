import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { todaySchoolDate } from '@/lib/schoolDate'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Asistencia — MentorIApp',
  description: 'Registro y seguimiento de asistencia estudiantil.',
}

const statusConfig = {
  presente:    { label: 'Presente',    color: 'var(--dash-accent)' },
  ausente:     { label: 'Ausente',     color: 'var(--dash-danger-strong)' },
  tardanza:    { label: 'Tardanza',    color: 'var(--dash-warning)' },
  justificado: { label: 'Justificado', color: '#6ee7b7' },
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

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, guardian_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId

  const isStaff = ['director', 'school_admin', 'teacher', 'reception', 'super_admin']
    .includes(profile?.role ?? '')

  const today = todaySchoolDate()

  // El aviso automático de ausencia/tardanza depende de que WhatsApp
  // (Evolution API) esté conectado para este colegio — sin eso, el
  // aviso siempre queda en "no enviado" aunque todo lo demás funcione.
  // Solo le importa a staff, así que no se consulta para un guardian.
  let whatsappConnected = false
  if (isStaff) {
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('status')
      .eq('school_id', schoolId)
      .maybeSingle()
    whatsappConnected = connection?.status === 'connected'
  }

  let records: { id: string; date: string; status: string; student: { first_name: string; last_name: string } | null; subject: { name: string } | null; notified_at: string | null }[] = []
  let recordsError: { message: string } | null = null

  if (isStaff) {
    // Staff: registros de asistencia de HOY en este colegio
    const { data, error } = await supabase
      .from('attendance')
      .select('id, date, status, notified_at, student:students(first_name, last_name), subject:subjects(name)')
      .eq('school_id', schoolId)
      .eq('date', today)
      .order('created_at', { ascending: false })

    records = ((data as unknown) as typeof records) ?? []
    recordsError = error
  } else if (profile?.guardian_id) {
    // Guardian: historial de asistencia de sus hijos (últimos 30 días)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: studentIdsData } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_id', profile.guardian_id)

    const { data, error } = await supabase
      .from('attendance')
      .select('id, date, status, notified_at, student:students(first_name, last_name), subject:subjects(name)')
      .in('student_id', studentIdsData?.map((r: { student_id: string }) => r.student_id) ?? [])
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })

    records = ((data as unknown) as typeof records) ?? []
    recordsError = error
  }

  const hasUnnotifiedAbsence = isStaff && !whatsappConnected &&
    records.some((r) => ['ausente', 'tardanza'].includes(r.status) && !r.notified_at)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'la asistencia', error: recordsError }]} />

      {hasUnnotifiedAbsence && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2.5"
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="font-semibold">Los avisos automáticos por WhatsApp no están activos</p>
            <p className="mt-0.5">
              Todavía no se ha contratado el VPS de Evolution API, así que las ausencias/tardanzas de hoy marcadas
              con &quot;—&quot; en Notificado no llegaron al tutor. Avísales manualmente mientras tanto.
            </p>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
            Asistencia
          </h1>
          <p className="text-sm text-slate-500 mt-1">
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
            className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
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
        <div className="dash-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Estudiante</th>
                <th className="text-left px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Materia</th>
                <th className="text-left px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Fecha</th>
                <th className="text-left px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Estado</th>
                <th className="text-left px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Notificado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
              {records.map((r) => {
                const cfg = statusConfig[r.status as keyof typeof statusConfig]
                return (
                  <tr key={r.id} className="transition hover:bg-white/5">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--dash-text)' }}>
                      {r.student?.first_name} {r.student?.last_name}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>
                      {r.subject?.name ?? 'General'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>
                      {new Date(r.date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold font-barlow uppercase px-2.5 py-1 rounded-full border"
                        style={{ color: cfg?.color, borderColor: 'currentColor' }}
                      >
                        {cfg?.label ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.notified_at ? (
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--dash-accent)' }}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Enviado
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📅</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            {isStaff ? 'No hay registros de asistencia para hoy.' : 'No hay registros en los últimos 30 días.'}
          </p>
        </div>
      )}
    </div>
  )
}
