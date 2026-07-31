import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Academia — MentorIApp',
  description: 'Video-lecciones y cuestionarios interactivos.',
}

type LessonRow = {
  id: string
  title: string
  description: string | null
  subject_id: string
  subjects: { name: string } | null
}

type AttemptRow = {
  lesson_id: string
  score: number
  max_score: number
  completed_at: string | null
}

type BadgeRow = {
  badge_id: string
  badges: { name: string; icon: string; description: string | null } | null
}

/**
 * Academia (vista del estudiante) — lecciones publicadas del grado en el
 * que el estudiante está inscrito, con su progreso, puntos, racha e
 * insignias ganadas.
 */
export default async function AcademiaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, student_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (!profile) redirect('/login')

  // Staff/profesor: los mandamos a las herramientas de gestión, no a la vista de alumno
  if (canAccess(profile?.role, 'academia_gestionar')) {
    redirect('/dashboard/academia/progreso')
  }

  if (!profile.student_id) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-3">
        <p className="text-4xl" aria-hidden="true">🎓</p>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Academia</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tu cuenta todavía no está vinculada a un estudiante. Pídele a la administración del colegio que la vincule para poder ver tus lecciones.
        </p>
      </div>
    )
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('grade_level_id')
    .eq('student_id', profile.student_id)
    .eq('status', 'inscrito')
    .maybeSingle()

  const [{ data: lessonsRaw, error: lessonsRawError }, { data: attemptsRaw, error: attemptsRawError }, { data: points, error: pointsError }, { data: earnedBadgesRaw, error: earnedBadgesRawError }] = await Promise.all([
    enrollment?.grade_level_id
      ? supabase
          .from('lessons')
          .select('id, title, description, subject_id, subjects(name)')
          .eq('grade_level_id', enrollment.grade_level_id)
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as LessonRow[], error: null }),
    supabase.from('quiz_attempts').select('lesson_id, score, max_score, completed_at').eq('student_id', profile.student_id),
    supabase.from('student_points').select('total_points, current_streak_days, longest_streak_days').eq('student_id', profile.student_id).maybeSingle(),
    supabase.from('student_badges').select('badge_id, badges(name, icon, description)').eq('student_id', profile.student_id),
  ])

  const lessons = (lessonsRaw ?? []) as unknown as LessonRow[]
  const attempts = (attemptsRaw ?? []) as AttemptRow[]
  const earnedBadges = (earnedBadgesRaw ?? []) as unknown as BadgeRow[]
  const attemptByLesson = new Map(attempts.filter((a) => a.completed_at).map((a) => [a.lesson_id, a]))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[
        { label: 'tu inscripción', error: enrollmentError },
        { label: 'las lecciones', error: lessonsRawError },
        { label: 'tus intentos', error: attemptsRawError },
        { label: 'tus puntos', error: pointsError },
        { label: 'tus insignias', error: earnedBadgesRawError },
      ]} />

      {/* Encabezado con gamificación */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Academia</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tus lecciones y cuestionarios</p>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-black text-primary dark:text-accent-light">{points?.total_points ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Puntos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-orange-500">🔥 {points?.current_streak_days ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Racha</p>
          </div>
        </div>
      </div>

      {/* Insignias */}
      {earnedBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {earnedBadges.map((b) => (
            <div
              key={b.badge_id}
              title={b.badges?.description ?? ''}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"
            >
              <span>{b.badges?.icon}</span> {b.badges?.name}
            </div>
          ))}
        </div>
      )}

      {/* Lecciones */}
      {lessons.length > 0 ? (
        <div className="grid gap-3">
          {lessons.map((lesson) => {
            const attempt = attemptByLesson.get(lesson.id)
            return (
              <Link
                key={lesson.id}
                href={`/dashboard/academia/${lesson.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between gap-4 hover:border-primary/40 transition"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-dark dark:text-accent-light">
                    {lesson.subjects?.name ?? 'Materia'}
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{lesson.title}</p>
                  {lesson.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{lesson.description}</p>
                  )}
                </div>
                {attempt ? (
                  <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1.5">
                    ✓ {attempt.score}/{attempt.max_score}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-primary text-white text-xs font-bold px-3 py-1.5 shadow-glow">
                    Ver lección
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🎬</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Todavía no hay lecciones publicadas para tu grado.
          </p>
        </div>
      )}
    </div>
  )
}
