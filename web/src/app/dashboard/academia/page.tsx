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
 * Academia (vista del estudiante) — su portal de clases.
 *
 * Las lecciones se buscan por `students.grade_level` (el mismo texto libre
 * que usan Horarios, Notas, Asistencia y Encuestas). ANTES se resolvía el
 * curso con la tabla `enrollments`, que NINGUNA pantalla de la app escribe
 * jamás -- estando vacía, esta página le decía "todavía no hay lecciones"
 * a todos los estudiantes por igual. Ver la migración
 * 20260909000000_academia_curso_texto.sql.
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
        <h1 className="text-xl font-bold font-barlow text-slate-900">Academia</h1>
        <p className="text-sm text-slate-500">
          Tu cuenta todavía no está vinculada a un estudiante. Pídele a la administración del colegio que la vincule para poder ver tus lecciones.
        </p>
      </div>
    )
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('first_name, grade_level')
    .eq('id', profile.student_id)
    .maybeSingle()

  const [{ data: lessonsRaw, error: lessonsRawError }, { data: attemptsRaw, error: attemptsRawError }, { data: points, error: pointsError }, { data: earnedBadgesRaw, error: earnedBadgesRawError }] = await Promise.all([
    student?.grade_level
      ? supabase
          .from('lessons')
          .select('id, title, description, subject_id, subjects(name)')
          .eq('grade_level', student.grade_level)
          .eq('is_published', true)
          .is('deleted_at', null)
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

  // La que sigue: la primera sin cuestionario contestado, en el orden que
  // el profesor definió. Es lo único que el estudiante ve arriba del todo,
  // para que entre y le dé play sin decidir nada.
  const nextLesson = lessons.find((l) => !attemptByLesson.has(l.id)) ?? null

  // Agrupadas por materia, respetando el orden en que llegaron.
  const bySubject = new Map<string, { name: string; lessons: LessonRow[] }>()
  for (const lesson of lessons) {
    const key = lesson.subject_id
    if (!bySubject.has(key)) bySubject.set(key, { name: lesson.subjects?.name ?? 'Materia', lessons: [] })
    bySubject.get(key)!.lessons.push(lesson)
  }
  const subjectGroups = Array.from(bySubject.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const doneCount = lessons.filter((l) => attemptByLesson.has(l.id)).length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[
        { label: 'tus datos de estudiante', error: studentError },
        { label: 'las lecciones', error: lessonsRawError },
        { label: 'tus intentos', error: attemptsRawError },
        { label: 'tus puntos', error: pointsError },
        { label: 'tus insignias', error: earnedBadgesRawError },
      ]} />

      {/* Encabezado con gamificación */}
      <div className="dash-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-barlow tracking-tight" style={{ color: 'var(--dash-text)' }}>
            {student?.first_name ? `Hola, ${student.first_name}` : 'Academia'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-text-muted)' }}>
            {student?.grade_level ? `${student.grade_level} · ` : ''}
            {lessons.length > 0 ? `${doneCount} de ${lessons.length} lecciones completadas` : 'Tus lecciones y cuestionarios'}
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold font-barlow" style={{ color: 'var(--dash-accent)' }}>{points?.total_points ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--dash-text-faint)' }}>Puntos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold font-barlow" style={{ color: 'var(--dash-warning)' }}>🔥 {points?.current_streak_days ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--dash-text-faint)' }}>Racha</p>
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

      {/* La que sigue -- entrada directa al video, sin elegir nada */}
      {nextLesson && (
        <Link
          href={`/dashboard/academia/${nextLesson.id}`}
          className="dash-card block p-6 border-2 transition"
          style={{ borderColor: 'var(--dash-accent)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-accent-light)' }}>
            Continuar · {nextLesson.subjects?.name ?? 'Materia'}
          </p>
          <p className="text-xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{nextLesson.title}</p>
          {nextLesson.description && (
            <p className="text-sm mt-1" style={{ color: 'var(--dash-text-muted)' }}>{nextLesson.description}</p>
          )}
          <span className="inline-flex items-center gap-2 mt-4 rounded-full bg-primary text-white text-sm font-bold px-5 py-2.5 shadow-glow">
            ▶ Ver el video
          </span>
        </Link>
      )}

      {/* Todas sus lecciones, agrupadas por materia */}
      {subjectGroups.length > 0 ? (
        subjectGroups.map((group) => (
          <section key={group.name} className="space-y-2">
            <h2 className="text-sm font-bold font-barlow uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>
              {group.name}
            </h2>
            <div className="grid gap-3">
              {group.lessons.map((lesson) => {
                const attempt = attemptByLesson.get(lesson.id)
                return (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/academia/${lesson.id}`}
                    className="dash-card p-5 flex items-center justify-between gap-4 transition"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{lesson.title}</p>
                      {lesson.description && (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>{lesson.description}</p>
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
          </section>
        ))
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🎬</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            {student?.grade_level
              ? `Todavía no hay lecciones publicadas para ${student.grade_level}.`
              : 'Tu ficha no tiene un curso asignado todavía. Pídele a la administración del colegio que lo complete.'}
          </p>
        </div>
      )}
    </div>
  )
}
