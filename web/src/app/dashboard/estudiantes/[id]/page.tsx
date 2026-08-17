import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect, notFound } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import EnrollmentStatusSelect from './EnrollmentStatusSelect'
import GradeLevelInput from './GradeLevelInput'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Ficha del estudiante — MentorIApp',
}

const attendanceLabels: Record<string, string> = {
  presente: 'Presentes', ausente: 'Ausentes', tardanza: 'Tardanzas', justificado: 'Justificados',
}

function calculateAge(birthDate: string): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
}

export default async function EstudianteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const { schoolId } = await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')

  if (!profile || !canAccess(profile.role, 'estudiantes')) {
    redirect('/dashboard')
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, birth_date, gender, enrollment_status, grade_level, family_id, families(id, name)')
    .eq('id', id)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .single()

  if (!student) notFound()

  const family = student.families as unknown as { id: string; name: string } | null

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: enrollmentsRaw, error: enrollmentsRawError },
    { data: attendanceRaw, error: attendanceRawError },
    { data: attemptsRaw, error: attemptsRawError },
    { data: points, error: pointsError },
  ] = await Promise.all([
    supabase.from('enrollments').select('id, status, enrollment_date, withdrawal_date, grade_levels(name)').eq('student_id', id).order('enrollment_date', { ascending: false }),
    supabase.from('attendance').select('status').eq('student_id', id).gte('date', thirtyDaysAgo.toISOString().split('T')[0]),
    supabase.from('quiz_attempts').select('id, score, max_score, completed_at, lessons(title, subjects(name))').eq('student_id', id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(10),
    supabase.from('student_points').select('total_points, current_streak_days, longest_streak_days').eq('student_id', id).maybeSingle(),
  ])

  type Enrollment = { id: string; status: string; enrollment_date: string; withdrawal_date: string | null; grade_levels: { name: string } | null }
  const enrollments = (enrollmentsRaw ?? []) as unknown as Enrollment[]
  const attendance = (attendanceRaw ?? []) as { status: string }[]
  type Attempt = { id: string; score: number; max_score: number; completed_at: string; lessons: { title: string; subjects: { name: string } | null } | null }
  const attempts = (attemptsRaw ?? []) as unknown as Attempt[]

  const attendanceCounts = attendance.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
  const age = calculateAge(student.birth_date)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'el estudiante', error: studentError }, { label: 'el historial de inscripción', error: enrollmentsRawError }, { label: 'la asistencia', error: attendanceRawError }, { label: 'el progreso en academia', error: attemptsRawError }, { label: 'los puntos', error: pointsError }]} />
      <div>
        <Link href="/dashboard/estudiantes" className="text-xs font-semibold text-slate-400 hover:text-primary dark:hover:text-accent-light transition">
          ← Estudiantes
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap mt-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {age} años · {formatDate(student.birth_date)}
              {family && (
                <> · <Link href={`/dashboard/familias/${family.id}`} className="text-primary dark:text-accent-light hover:underline">{family.name}</Link></>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <EnrollmentStatusSelect studentId={student.id} initialStatus={student.enrollment_status} />
            <GradeLevelInput studentId={student.id} initialValue={student.grade_level} />
          </div>
        </div>
      </div>

      {/* Progreso en Academia */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Academia</p>
        <div className="flex gap-8 mb-4">
          <div>
            <p className="text-2xl font-black text-primary dark:text-accent-light">{points?.total_points ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Puntos</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-500">🔥 {points?.current_streak_days ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Racha actual</p>
          </div>
        </div>
        {attempts.length > 0 ? (
          <div className="space-y-2">
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2 first:border-0 first:pt-0">
                <div>
                  <span className="text-slate-700 dark:text-slate-200">{a.lessons?.title ?? '—'}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{a.lessons?.subjects?.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{a.score}/{a.max_score}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Aún no ha completado ninguna lección.</p>
        )}
      </div>

      {/* Asistencia */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Asistencia (30 días)</p>
        {attendance.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(attendanceLabels).map(([status, label]) => (
              <div key={status}>
                <p className="text-xl font-black text-slate-900 dark:text-white">{attendanceCounts[status] ?? 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin registros en este período.</p>
        )}
      </div>

      {/* Historial de inscripción */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Historial de inscripción</p>
        {enrollments.length > 0 ? (
          <div className="space-y-2">
            {enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2 first:border-0 first:pt-0">
                <span className="text-slate-700 dark:text-slate-200">{e.grade_levels?.name ?? 'Sin grado asignado'}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{e.status} · desde {formatDate(e.enrollment_date)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin registros de inscripción todavía.</p>
        )}
      </div>
    </div>
  )
}
