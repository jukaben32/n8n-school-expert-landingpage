import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'
import PrintButton from './PrintButton'

export const metadata: Metadata = {
  title: 'Boletín de calificaciones — MentorIApp',
}

type GradingPeriod = { id: string; name: string; sort_order: number }
type GradeRow = { subject_id: string; grading_period_id: string; score: number; subjects: { name: string } | null }

export default async function BoletinPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id, guardian_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile) redirect('/login')

  const isStaff = canAccess(profile.role, 'notas')
  if (!isStaff && profile.role !== 'guardian') {
    redirect('/dashboard')
  }

  // Si es guardian, RLS de `students` ya solo le deja leer a sus propios
  // hijos -- si este studentId no es suyo, esto simplemente no aparece.
  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name, grade_level, school_id')
    .eq('id', studentId)
    .is('deleted_at', null)
    .single()
  if (!student) notFound()

  const { data: school } = await supabase.from('schools').select('name').eq('id', student.school_id).single()

  const { data: periodsRaw } = await supabase
    .from('grading_periods')
    .select('id, name, sort_order')
    .eq('school_id', student.school_id)
    .order('sort_order', { ascending: true })
  const periods = (periodsRaw ?? []) as GradingPeriod[]

  const { data: gradesRaw } = await supabase
    .from('grades')
    .select('subject_id, grading_period_id, score, subjects(name)')
    .eq('student_id', studentId)
  const grades = (gradesRaw ?? []) as unknown as GradeRow[]

  const subjectNames = new Map<string, string>()
  for (const g of grades) subjectNames.set(g.subject_id, g.subjects?.name ?? '—')
  const subjectIds = Array.from(subjectNames.keys()).sort((a, b) => (subjectNames.get(a) ?? '').localeCompare(subjectNames.get(b) ?? ''))

  const scoreFor = (subjectId: string, periodId: string) =>
    grades.find((g) => g.subject_id === subjectId && g.grading_period_id === periodId)?.score

  return (
    <div className="max-w-3xl mx-auto space-y-6 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard/notas" className="text-sm text-primary dark:text-accent-light hover:underline">
          ← Notas
        </Link>
        <PrintButton />
      </div>

      <div className="text-center space-y-1 border-b border-slate-200 dark:border-slate-800 print:border-slate-900 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-accent-light print:text-slate-900">{school?.name ?? 'Colegio'}</p>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Boletín de calificaciones</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 print:text-slate-700">
          {student.last_name}, {student.first_name} — {student.grade_level ?? 'Sin curso'}
        </p>
      </div>

      {periods.length === 0 || subjectIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Todavía no hay notas registradas.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 print:border-slate-900 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 print:bg-transparent">
              <tr>
                <th className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400 print:text-slate-900 border-b print:border-slate-900">Materia</th>
                {periods.map((p) => (
                  <th key={p.id} className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400 print:text-slate-900 text-center border-b print:border-slate-900 whitespace-nowrap">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 print:divide-slate-300">
              {subjectIds.map((subjectId) => (
                <tr key={subjectId}>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{subjectNames.get(subjectId)}</td>
                  {periods.map((p) => {
                    const score = scoreFor(subjectId, p.id)
                    return (
                      <td key={p.id} className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-300 print:text-slate-900">
                        {score !== undefined ? score : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
