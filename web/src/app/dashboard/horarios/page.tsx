import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import ScheduleGrid from './ScheduleGrid'
import { periodsForGrade } from '@/lib/schedule/gradeLevelCategory'

export const metadata: Metadata = {
  title: 'Horarios — MentorIApp',
}

const DAY_LABELS: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' }
const DAYS = [1, 2, 3, 4, 5]

type Period = { id: string; name: string; start_time: string; end_time: string; sort_order: number; level: string | null }
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

  // Se traen todas las franjas del colegio y se filtran por nivel más abajo,
  // según el curso que se esté viendo: el colegio puede tener una rejilla
  // distinta para primaria y para secundaria (ver migración
  // 20260823000000_class_periods_level.sql).
  const { data: periodsRaw } = await supabase
    .from('class_periods')
    .select('id, name, start_time, end_time, sort_order, level')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })
  const allPeriods = (periodsRaw ?? []) as Period[]

  // ── Profesor sin permiso de gestión: ve solo SU horario propio ──────────
  if (role === 'teacher' && !canEdit) {
    const { data: mySlotsRaw } = await supabase
      .from('class_schedules')
      .select('day_of_week, period_id, grade_level, subjects(name)')
      .eq('school_id', schoolId)
      .eq('staff_id', profile.staff_id ?? '')
    type MySlot = { day_of_week: number; period_id: string; grade_level: string; subjects: { name: string } | null }
    const mySlots = (mySlotsRaw ?? []) as unknown as MySlot[]
    // Un profesor puede dar clase en varios niveles (ej. Educación Física en
    // primaria y secundaria), así que aquí se usan todas las franjas.
    const periodById = new Map(allPeriods.map((p) => [p.id, p]))

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Mi horario</h1>
          <p className="text-sm text-slate-500 mt-1">Tus clases asignadas, por día.</p>
        </div>
        {mySlots.length === 0 ? (
          <div className="dash-card border-dashed p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">🗓️</p>
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no tienes clases asignadas en el horario.</p>
          </div>
        ) : (
          DAYS.map((day) => {
            const daySlots = mySlots
              .filter((s) => s.day_of_week === day)
              .sort((a, b) => (periodById.get(a.period_id)?.sort_order ?? 0) - (periodById.get(b.period_id)?.sort_order ?? 0))
            if (daySlots.length === 0) return null
            return (
              <div key={day} className="dash-card p-4">
                <p className="text-xs font-semibold font-barlow uppercase tracking-wide mb-2" style={{ color: 'var(--dash-accent)' }}>{DAY_LABELS[day]}</p>
                <div className="space-y-2">
                  {daySlots.map((s) => {
                    const period = periodById.get(s.period_id)
                    return (
                      <div key={`${s.day_of_week}-${s.period_id}`} className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--dash-text-faint)' }}>{period ? `${period.start_time.slice(0, 5)}–${period.end_time.slice(0, 5)}` : '—'}</span>
                        <span className="font-medium" style={{ color: 'var(--dash-text)' }}>{s.subjects?.name ?? '—'}</span>
                        <span style={{ color: 'var(--dash-text-faint)' }}>{s.grade_level}</span>
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
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight mb-6">Horario</h1>
          <div className="dash-card border-dashed p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no hay un curso registrado para tu(s) hijo(s).</p>
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
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Horario</h1>
        {myGrades.map((grade) => (
          <div key={grade}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--dash-text-muted)' }}>{grade}</p>
            <ReadOnlyGrid periods={periodsForGrade(allPeriods, grade)} days={DAYS} dayLabels={DAY_LABELS} slots={slots.filter((s) => s.grade_level === grade)} />
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
  // Solo las franjas del nivel del curso seleccionado (las que no tienen
  // nivel aplican a todos).
  const periods = periodsForGrade(allPeriods, selectedGrade)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Horarios</h1>
          <p className="text-sm text-slate-500 mt-1">
            {canEdit ? 'Organiza la materia y profesor de cada franja, por curso.' : 'Horario de clases por curso.'}
          </p>
        </div>
        {canEdit && (
          <Link href="/dashboard/horarios/periodos" className="text-sm hover:underline font-semibold" style={{ color: 'var(--dash-accent)' }}>
            Franjas horarias
          </Link>
        )}
      </div>

      {gradeOptions.length === 0 ? (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no hay cursos con estudiantes asignados.</p>
        </div>
      ) : (
        <>
          {/* Los cursos van siempre visibles: si el nivel del curso elegido
              todavía no tiene franjas, hay que poder cambiar a otro. */}
          <div className="flex flex-wrap gap-2">
            {gradeOptions.map((grade) => (
              <Link
                key={grade}
                href={`/dashboard/horarios?curso=${encodeURIComponent(grade)}`}
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold font-barlow uppercase tracking-wide transition"
                style={selectedGrade === grade ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' } : { background: 'white', color: '#5f7a70', border: '1px solid #e2e8f0' }}
              >
                {grade}
              </Link>
            ))}
          </div>

          {periods.length === 0 ? (
            <div className="dash-card border-dashed p-12 text-center space-y-3">
              <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
                {allPeriods.length === 0
                  ? 'Todavía no hay franjas horarias definidas.'
                  : `No hay franjas horarias para el nivel de ${selectedGrade}. Las que existen son de otro nivel.`}
              </p>
              {canEdit && (
                <Link href="/dashboard/horarios/periodos" className="dash-btn-primary inline-block text-sm px-5 py-2.5">
                  {allPeriods.length === 0 ? 'Crear la primera franja' : 'Gestionar franjas horarias'}
                </Link>
              )}
            </div>
          ) : canEdit && selectedGrade ? (
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
    <div className="dash-card overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
            <th className="px-3 py-2.5 font-barlow uppercase tracking-wide text-xs whitespace-nowrap" style={{ color: 'var(--dash-text-muted)' }}>Hora</th>
            {days.map((d) => (
              <th key={d} className="px-3 py-2.5 font-barlow uppercase tracking-wide text-xs whitespace-nowrap" style={{ color: 'var(--dash-text-muted)' }}>{dayLabels[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
          {periods.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--dash-text-faint)' }}>{p.name}<br />{p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</td>
              {days.map((d) => {
                const s = cell(d, p.id)
                return (
                  <td key={d} className="px-3 py-2.5 align-top">
                    {s?.subjects?.name ? (
                      <div>
                        <p className="font-medium" style={{ color: 'var(--dash-text)' }}>{s.subjects.name}</p>
                        {s.staff && <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>{s.staff.first_name} {s.staff.last_name}</p>}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--dash-text-faint)' }}>—</span>
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
