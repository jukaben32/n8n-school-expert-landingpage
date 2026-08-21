import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import GradesGrid from './GradesGrid'

export const metadata: Metadata = {
  title: 'Notas — MentorIApp',
}

type GradingPeriod = { id: string; name: string; start_date: string; end_date: string; sort_order: number }
type GradeSubjectOption = { subject_id: string; subject_name: string; grade_level: string }

export default async function NotasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; curso?: string; materia?: string }>
}) {
  const { periodo, curso, materia } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const role = profile?.role ?? ''
  const schoolId = (await getActiveSchool(role, profile?.school_id ?? '')).schoolId
  if (!profile || !canAccess(role, 'notas')) {
    redirect('/dashboard')
  }

  const canEdit = canAccess(role, 'notas_gestionar')
  const isAdmin = ['super_admin', 'school_admin', 'director'].includes(role)

  const { data: periodsRaw } = await supabase
    .from('grading_periods')
    .select('id, name, start_date, end_date, sort_order')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })
  const periods = (periodsRaw ?? []) as GradingPeriod[]
  const selectedPeriod = periodo && periods.some((p) => p.id === periodo) ? periodo : periods[0]?.id

  // Combinaciones curso+materia disponibles: para un profesor, solo las
  // que enseña de verdad (via class_schedules); para admin/reception,
  // cualquier curso con estudiantes × cualquier materia del catálogo.
  let gradeSubjectOptions: GradeSubjectOption[] = []
  if (role === 'teacher') {
    const { data } = await supabase
      .from('class_schedules')
      .select('grade_level, subject_id, subjects(name)')
      .eq('school_id', schoolId)
      .eq('staff_id', profile.staff_id ?? '')
      .not('subject_id', 'is', null)
    type Row = { grade_level: string; subject_id: string; subjects: { name: string } | null }
    const seen = new Set<string>()
    gradeSubjectOptions = ((data ?? []) as unknown as Row[])
      .filter((r) => {
        const key = `${r.grade_level}|${r.subject_id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((r) => ({ subject_id: r.subject_id, subject_name: r.subjects?.name ?? '—', grade_level: r.grade_level }))
  } else {
    const [{ data: studentsWithGrade }, { data: subjectsRaw }] = await Promise.all([
      supabase.from('students').select('grade_level').eq('school_id', schoolId).not('grade_level', 'is', null).is('deleted_at', null),
      supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
    ])
    const grades = Array.from(new Set((studentsWithGrade ?? []).map((s) => s.grade_level as string).filter(Boolean))).sort()
    gradeSubjectOptions = grades.flatMap((g) => (subjectsRaw ?? []).map((s) => ({ subject_id: s.id, subject_name: s.name, grade_level: g })))
  }

  const selectedGrade = curso && gradeSubjectOptions.some((o) => o.grade_level === curso) ? curso : gradeSubjectOptions[0]?.grade_level
  const subjectsForGrade = Array.from(
    new Map(gradeSubjectOptions.filter((o) => o.grade_level === selectedGrade).map((o) => [o.subject_id, o.subject_name])).entries()
  )
  const selectedSubject = materia && subjectsForGrade.some(([id]) => id === materia) ? materia : subjectsForGrade[0]?.[0]

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ periodo: selectedPeriod ?? '', curso: selectedGrade ?? '', materia: selectedSubject ?? '', ...overrides })
    return `/dashboard/notas?${params.toString()}`
  }

  let students: { id: string; first_name: string; last_name: string }[] = []
  let existingGrades: { student_id: string; score: number; comment: string | null }[] = []
  if (selectedGrade && selectedSubject && selectedPeriod) {
    const { data: studentsRaw } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .eq('grade_level', selectedGrade)
      .is('deleted_at', null)
      .order('last_name')
    students = studentsRaw ?? []

    const { data: gradesRaw } = await supabase
      .from('grades')
      .select('student_id, score, comment')
      .eq('subject_id', selectedSubject)
      .eq('grading_period_id', selectedPeriod)
      .in('student_id', students.map((s) => s.id))
    existingGrades = (gradesRaw ?? []) as { student_id: string; score: number; comment: string | null }[]
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Notas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {canEdit ? 'Registra las notas por curso y materia.' : 'Consulta las notas registradas.'}
          </p>
        </div>
        {isAdmin && (
          <Link href="/dashboard/notas/periodos" className="text-sm text-primary dark:text-accent-light hover:underline font-semibold">
            Periodos
          </Link>
        )}
      </div>

      {periods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Todavía no hay periodos de calificación definidos.</p>
          {isAdmin && (
            <Link href="/dashboard/notas/periodos" className="inline-block rounded-full bg-primary text-white text-sm font-semibold px-5 py-2.5">
              Crear el primer periodo
            </Link>
          )}
        </div>
      ) : gradeSubjectOptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {role === 'teacher' ? 'No tienes materias asignadas en el horario todavía.' : 'No hay cursos con materias disponibles.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <Link
                key={p.id}
                href={qs({ periodo: p.id })}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedPeriod === p.id ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(gradeSubjectOptions.map((o) => o.grade_level))).map((g) => (
              <Link
                key={g}
                href={qs({ curso: g, materia: '' })}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedGrade === g ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {g}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {subjectsForGrade.map(([id, subjectName]) => (
              <Link
                key={id}
                href={qs({ materia: id })}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedSubject === id ? 'bg-accent-light text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {subjectName}
              </Link>
            ))}
          </div>

          {students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
              <p className="text-slate-500 dark:text-slate-400 text-sm">No hay estudiantes en este curso.</p>
            </div>
          ) : selectedSubject && selectedPeriod ? (
            <GradesGrid
              subjectId={selectedSubject}
              gradingPeriodId={selectedPeriod}
              editable={canEdit}
              students={students}
              existingGrades={existingGrades}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
