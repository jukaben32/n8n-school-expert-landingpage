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
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Progreso — Academia
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {lessonsCount ?? 0} lecciones creadas · {attempts.length} cuestionarios completados
          </p>
        </div>
        <Link
          href="/dashboard/academia/nueva"
          className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
        >
          + Nueva lección
        </Link>
      </div>

      {attempts.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Estudiante</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Lección</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Materia</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-center">Puntaje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {attempts.map((a) => {
                const ratio = a.max_score > 0 ? a.score / a.max_score : 0
                const isLow = ratio < lowScoreThreshold
                return (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {a.students ? `${a.students.last_name}, ${a.students.first_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.lessons?.title ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.lessons?.subjects?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${isLow ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
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
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📊</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Aún no hay cuestionarios completados. Crea tu primera lección para empezar.
          </p>
        </div>
      )}
    </div>
  )
}
