import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { todaySchoolDate } from '@/lib/schoolDate'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Planificación de clases — MentorIApp',
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type ScheduleRow = {
  id: string
  grade_level: string
  period_id: string
  class_periods: { name: string; start_time: string; end_time: string; sort_order: number } | null
  subjects: { name: string } | null
  staff: { id: string; first_name: string; last_name: string } | null
}

export default async function PlanificacionPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; profesor?: string }>
}) {
  const { fecha, profesor } = await searchParams
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
  if (!profile || !canAccess(role, 'planificacion')) {
    redirect('/dashboard')
  }

  const isAdmin = canAccess(role, 'horarios_gestionar')
  const date = fecha || todaySchoolDate()
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay()

  let teachers: { id: string; first_name: string; last_name: string }[] = []
  if (isAdmin) {
    const { data } = await supabase
      .from('staff')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .is('deleted_at', null)
      .order('last_name')
    teachers = data ?? []
  }
  const selectedTeacherId = isAdmin ? (profesor || '') : ''

  let query = supabase
    .from('class_schedules')
    .select('id, grade_level, period_id, class_periods(name, start_time, end_time, sort_order), subjects(name), staff(id, first_name, last_name)')
    .eq('school_id', schoolId)
    .eq('day_of_week', dayOfWeek)

  if (isAdmin) {
    if (selectedTeacherId) query = query.eq('staff_id', selectedTeacherId)
  } else {
    query = query.eq('staff_id', profile.staff_id ?? '')
  }

  const { data: scheduleRaw, error: scheduleError } = await query
  const schedule = ((scheduleRaw ?? []) as unknown as ScheduleRow[]).sort(
    (a, b) => (a.class_periods?.sort_order ?? 0) - (b.class_periods?.sort_order ?? 0)
  )

  const scheduleIds = schedule.map((s) => s.id)
  const { data: plansRaw } = scheduleIds.length
    ? await supabase.from('lesson_plans').select('schedule_id, topic').eq('plan_date', date).in('schedule_id', scheduleIds)
    : { data: [] }
  const planBySchedule = new Map((plansRaw ?? []).map((p) => [p.schedule_id as string, p.topic as string]))

  const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Planificación de clases</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isAdmin ? 'Revisa lo que cada profesor tiene planificado.' : 'Planifica lo que vas a dar en cada clase.'}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/dashboard/planificacion?fecha=${shiftDate(date, -1)}${selectedTeacherId ? `&profesor=${selectedTeacherId}` : ''}`}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          ← Día anterior
        </Link>
        <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize text-center">{formatDate(date)}</p>
        <Link
          href={`/dashboard/planificacion?fecha=${shiftDate(date, 1)}${selectedTeacherId ? `&profesor=${selectedTeacherId}` : ''}`}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Día siguiente →
        </Link>
      </div>

      {isAdmin && teachers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/planificacion?fecha=${date}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              !selectedTeacherId ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Todos
          </Link>
          {teachers.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/planificacion?fecha=${date}&profesor=${t.id}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedTeacherId === t.id ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.first_name} {t.last_name}
            </Link>
          ))}
        </div>
      )}

      {scheduleError && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {scheduleError.message}
        </div>
      )}

      {dayOfWeek === 0 || dayOfWeek === 6 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🌤️</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">No hay clases programadas para {DAY_LABELS[dayOfWeek].toLowerCase()}.</p>
        </div>
      ) : schedule.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📚</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {isAdmin && !selectedTeacherId ? 'No hay clases programadas ese día.' : 'No tienes clases programadas ese día.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedule.map((s) => {
            const plan = planBySchedule.get(s.id)
            return (
              <Link
                key={s.id}
                href={`/dashboard/planificacion/${s.id}?fecha=${date}`}
                className="block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-primary/40 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-accent-light">
                      {s.class_periods ? `${s.class_periods.start_time.slice(0, 5)}–${s.class_periods.end_time.slice(0, 5)} · ${s.class_periods.name}` : '—'}
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {s.subjects?.name ?? 'Sin materia'} · {s.grade_level}
                      {isAdmin && s.staff && ` · ${s.staff.first_name} ${s.staff.last_name}`}
                    </p>
                    <p className={`text-sm mt-1 truncate ${plan ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic'}`}>
                      {plan || 'Sin planificar'}
                    </p>
                  </div>
                  <svg className="w-5 h-5 shrink-0 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
