import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import ScheduleGrid from './ScheduleGrid'

export const metadata: Metadata = {
  title: 'Horarios — MentorIApp',
}

const DAY_LABELS: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' }
const DAYS = [1, 2, 3, 4, 5]

type Period = { id: string; name: string; start_time: string; end_time: string; sort_order: number }
type ScheduleSlot = {
  day_of_week: number
  period_id: string
  grade_level?: string
  subject_id: string | null
  staff_id: string | null
  subjects: { name: string } | null
  staff: { first_name: string; last_name: string } | null
}

export default async function HorariosPage({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const { curso } = await searchParams
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
  if (!profile || !canAccess(role, 'horarios')) {
    redirect('/dashboard/portal-familiar')
  }

  const canEdit = canAccess(role, 'horarios_gestionar')

  const { data: periodsRaw } = await supabase
    .from('class_periods')
    .select('id, name, start_time, end_time, sort_order')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })
  const periods = (periodsRaw ?? []) as Period[]

  // ── Profesor sin permiso de gestión: ve solo SU horario propio ──────────
  if (role === 'teacher' && !canEdit) {
    const { data: mySlotsRaw } = await supabase
      .from('class_schedules')
      .select('day_of_week, period_id, grade_level, subjects(name)')
      .eq('school_id', schoolId)
      .eq('staff_id', profile.staff_id ?? '')
    type MySlot = { day_of_week: number; period_id: string; grade_level: string; subjects: { name: string } | null }
    const mySlots = (mySlotsRaw ?? []) as unknown as MySlot[]
    const periodById = new Map(periods.map((p) => [p.id, p]))

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Mi horario</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tus clases asignadas, por día.</p>
        </div>
        {mySlots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">🗓️</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Todavía no tienes clases asignadas en el horario.</p>
          </div>
        ) : (
          DAYS.map((day) => {
            const daySlots = mySlots
              .filter((s) => s.day_of_week === day)
              .sort((a, b) => (periodById.get(a.period_id)?.sort_order ?? 0) - (periodById.get(b.period_id)?.sort_order ?? 0))
            if (daySlots.length === 0) return null
            return (
              <div key={day} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-accent-light mb-2">{DAY_LABELS[day]}</p>
                <div className="space-y-2">
                  {daySlots.map((s) => {
                    const period = periodById.get(s.period_id)
                    return (
                      <div key={`${s.day_of_week}-${s.period_id}`} className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{period ? `${period.start_time.slice(0, 5)}–${period.end_time.slice(0, 5)}` : '—'}</span>
                        <span className="font-medium text-slate-900 dark:text-white">{s.subjects?.name ?? '—'}</span>
                        <span className="text-slate-500 dark:text-slate-400">{s.grade_level}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  // ── Familia: ve el horario del/los grado(s) de sus hijos ────────────────
  if (role === 'guardian') {
    const { data: myProfile } = await supabase.from('users_profiles').select('guardian_id').eq('auth_id', user.id).single()
    const { data: myStudents } = await supabase
      .from('students')
      .select('grade_level, student_guardians!inner(guardian_id)')
      .eq('student_guardians.guardian_id', myProfile?.guardian_id ?? '')
      .not('grade_level', 'is', null)
    const myGrades = Array.from(new Set((myStudents ?? []).map((s) => s.grade_level as string).filter(Boolean)))

    if (myGrades.length === 0) {
      return (
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-6">Horario</h1>
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
            <p className="text-slate-500 dark:text-slate-400 text-sm">Todavía no hay un curso registrado para tu(s) hijo(s).</p>
          </div>
        </div>
      )
    }

    const { data: slotsRaw } = await supabase
      .from('class_schedules')
      .select('day_of_week, period_id, grade_level, subjects(name), staff(first_name, last_name)')
      .eq('school_id', schoolId)
      .in('grade_level', myGrades)
    const slots = (slotsRaw ?? []) as unknown as ScheduleSlot[]

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Horario</h1>
        {myGrades.map((grade) => (
          <div key={grade}>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{grade}</p>
            <ReadOnlyGrid periods={periods} days={DAYS} dayLabels={DAY_LABELS} slots={slots.filter((s) => s.grade_level === grade)} />
          </div>
        ))}
      </div>
    )
  }

  // ── Staff (admin con horarios_gestionar, o reception solo lectura) ──────
  const { data: studentsWithGrade } = await supabase
    .from('students')
    .select('grade_level')
    .eq('school_id', schoolId)
    .not('grade_level', 'is', null)
    .is('deleted_at', null)
  const gradeOptions = Array.from(new Set((studentsWithGrade ?? []).map((s) => s.grade_level as string).filter(Boolean))).sort()
  const selectedGrade = curso && gradeOptions.includes(curso) ? curso : gradeOptions[0]

  const [{ data: slotsRaw }, { data: subjectsRaw }, { data: teachersRaw }] = await Promise.all([
    selectedGrade
      ? supabase
          .from('class_schedules')
          .select('day_of_week, period_id, subject_id, staff_id, subjects(name), staff(first_name, last_name)')
          .eq('school_id', schoolId)
          .eq('grade_level', selectedGrade)
      : Promise.resolve({ data: [] }),
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
    supabase.from('staff').select('id, first_name, last_name').eq('school_id', schoolId).eq('role', 'teacher').is('deleted_at', null).order('last_name'),
  ])
  const slots = (slotsRaw ?? []) as unknown as ScheduleSlot[]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Horarios</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {canEdit ? 'Organiza la materia y profesor de cada franja, por curso.' : 'Horario de clases por curso.'}
          </p>
        </div>
        {canEdit && (
          <Link href="/dashboard/horarios/periodos" className="text-sm text-primary dark:text-accent-light hover:underline font-semibold">
            Franjas horarias
          </Link>
        )}
      </div>

      {gradeOptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Todavía no hay cursos con estudiantes asignados.</p>
        </div>
      ) : periods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Todavía no hay franjas horarias definidas.</p>
          {canEdit && (
            <Link href="/dashboard/horarios/periodos" className="inline-block rounded-full bg-primary text-white text-sm font-semibold px-5 py-2.5">
              Crear la primera franja
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {gradeOptions.map((grade) => (
              <Link
                key={grade}
                href={`/dashboard/horarios?curso=${encodeURIComponent(grade)}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedGrade === grade
                    ? 'bg-primary text-white shadow-glow'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {grade}
              </Link>
            ))}
          </div>

          {canEdit && selectedGrade ? (
            <ScheduleGrid
              gradeLevel={selectedGrade}
              periods={periods}
              days={DAYS}
              dayLabels={DAY_LABELS}
              initialSlots={slots.map((s) => ({ day_of_week: s.day_of_week, period_id: s.period_id, subject_id: s.subject_id, staff_id: s.staff_id }))}
              subjects={subjectsRaw ?? []}
              teachers={teachersRaw ?? []}
            />
          ) : (
            <ReadOnlyGrid periods={periods} days={DAYS} dayLabels={DAY_LABELS} slots={slots} />
          )}
        </>
      )}
    </div>
  )
}

function ReadOnlyGrid({
  periods,
  days,
  dayLabels,
  slots,
}: {
  periods: Period[]
  days: number[]
  dayLabels: Record<number, string>
  slots: ScheduleSlot[]
}) {
  const cell = (day: number, periodId: string) => slots.find((s) => s.day_of_week === day && s.period_id === periodId)
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Hora</th>
            {days.map((d) => (
              <th key={d} className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{dayLabels[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {periods.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.name}<br />{p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</td>
              {days.map((d) => {
                const s = cell(d, p.id)
                return (
                  <td key={d} className="px-3 py-2.5 align-top">
                    {s?.subjects?.name ? (
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{s.subjects.name}</p>
                        {s.staff && <p className="text-xs text-slate-400 dark:text-slate-500">{s.staff.first_name} {s.staff.last_name}</p>}
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
