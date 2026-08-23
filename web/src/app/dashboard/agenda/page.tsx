import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { todaySchoolDate } from '@/lib/schoolDate'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import DeleteEventButton from './DeleteEventButton'

export const metadata: Metadata = {
  title: 'Agenda — MentorIApp',
  description: 'Eventos y fechas importantes del colegio.',
}

const categoryLabels: Record<string, string> = {
  general: 'General',
  academico: 'Académico',
  feriado: 'Feriado',
  reunion: 'Reunión',
  extracurricular: 'Extracurricular',
  evaluacion: 'Evaluación',
}

const categoryStyles: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  academico: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  feriado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  reunion: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  extracurricular: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  evaluacion: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

type EventRow = {
  id: string
  title: string
  description: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  category: string
  grade_level: string | null
}

/**
 * Página de Agenda digital — Para staff y familias.
 * Staff ve y gestiona todos los eventos del colegio (o los de su grado
 * asignado, si es teacher -- ver restricción en actions.ts). Las familias
 * ven, vía RLS, solo los eventos "todo el colegio" o los de el/los grados
 * de sus hijos -- mismo modelo que class_updates.
 */
export default async function AgendaPage() {
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
  const isStaff = ['director', 'school_admin', 'teacher', 'reception', 'super_admin'].includes(profile?.role ?? '')
  const canCreate = canAccess(profile?.role ?? '', 'agenda_nuevo')

  const { data: eventsRaw, error: eventsError } = await supabase
    .from('calendar_events')
    .select('id, title, description, event_date, start_time, end_time, location, category, grade_level')
    .eq('school_id', schoolId)
    .gte('event_date', todaySchoolDate())
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  const events = (eventsRaw ?? []) as EventRow[]

  const formatDate = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
  const formatTime = (t: string | null) => (t ? t.slice(0, 5) : null)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los eventos', error: eventsError }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Agenda</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isStaff ? 'Próximos eventos del colegio' : 'Próximas fechas importantes'}
          </p>
        </div>
        {canCreate && (
          <Link
            id="btn-nuevo-evento"
            href="/dashboard/agenda/nuevo"
            className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo evento
          </Link>
        )}
      </div>

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="dash-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold font-barlow uppercase tracking-wide" style={{ color: 'var(--dash-accent)' }}>
                    {formatDate(e.event_date)}
                    {formatTime(e.start_time) && ` · ${formatTime(e.start_time)}${formatTime(e.end_time) ? `–${formatTime(e.end_time)}` : ''}`}
                  </p>
                  <p className="font-semibold mt-1" style={{ color: 'var(--dash-text)' }}>{e.title}</p>
                  {e.description && <p className="text-sm mt-1" style={{ color: 'var(--dash-text-muted)' }}>{e.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${categoryStyles[e.category] ?? categoryStyles.general}`}>
                      {categoryLabels[e.category] ?? e.category}
                    </span>
                    {e.grade_level && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(110,231,183,.15)', color: 'var(--dash-accent-light)' }}>
                        {e.grade_level}
                      </span>
                    )}
                    {e.location && <span className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>📍 {e.location}</span>}
                  </div>
                </div>
                {canCreate && <DeleteEventButton eventId={e.id} />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🗓️</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>No hay eventos próximos.</p>
        </div>
      )}
    </div>
  )
}
