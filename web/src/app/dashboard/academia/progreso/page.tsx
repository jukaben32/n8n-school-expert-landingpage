import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Progreso — Academia — MentorIApp',
}

type AttemptRow = {
  id: string
  score: number
  max_score: number
  completed_at: string
  lessons: { title: string; subjects: { name: string } | null } | null
  students: { first_name: string; last_name: string } | null
}

/**
 * Panel de progreso — Solo para staff/profesores.
 * Muestra los intentos de cuestionario completados, con el puntaje
 * obtenido, para dar seguimiento al avance de cada estudiante.
 */
export default async function ProgresoAcademiaPage() {
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
  if (!profile || !canAccess(profile.role, 'academia_gestionar')) {
    redirect('/dashboard/academia')
  }

  const { data: attemptsRaw, error: attemptsRawError } = await supabase
    .from('quiz_attempts')
    .select('id, score, max_score, completed_at, lessons(title, subjects(name)), students(first_name, last_name)')
    .eq('school_id', schoolId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(100)

  const { count: lessonsCount } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  const attempts = (attemptsRaw ?? []) as unknown as AttemptRow[]
  const lowScoreThreshold = 0.6

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los intentos', error: attemptsRawError }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
            Progreso — Academia
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lessonsCount ?? 0} lecciones creadas · {attempts.length} cuestionarios completados
          </p>
        </div>
        <Link
          href="/dashboard/academia/nueva"
          className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
        >
          + Nueva lección
        </Link>
      </div>

      {attempts.length > 0 ? (
        <div className="dash-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <tr>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Estudiante</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Lección</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Materia</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs text-center" style={{ color: 'var(--dash-text-muted)' }}>Puntaje</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
              {attempts.map((a) => {
                const ratio = a.max_score > 0 ? a.score / a.max_score : 0
                const isLow = ratio < lowScoreThreshold
                return (
                  <tr key={a.id} className="transition hover:bg-white/5">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--dash-text)' }}>
                      {a.students ? `${a.students.last_name}, ${a.students.first_name}` : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>{a.lessons?.title ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--dash-text-faint)' }}>{a.lessons?.subjects?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold border"
                        style={{ color: isLow ? 'var(--dash-danger-strong)' : 'var(--dash-accent)', borderColor: 'currentColor' }}
                      >
                        {a.score}/{a.max_score} {isLow && '⚠️'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📊</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            Aún no hay cuestionarios completados. Crea tu primera lección para empezar.
          </p>
        </div>
      )}
    </div>
  )
}
