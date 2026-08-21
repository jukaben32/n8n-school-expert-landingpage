import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { todaySchoolDate } from '@/lib/schoolDate'
import { redirect, notFound } from 'next/navigation'
import PlanForm from './PlanForm'

export const metadata: Metadata = {
  title: 'Planificar clase — MentorIApp',
}

export default async function PlanificarClasePage({
  params,
  searchParams,
}: {
  params: Promise<{ scheduleId: string }>
  searchParams: Promise<{ fecha?: string }>
}) {
  const { scheduleId } = await params
  const { fecha } = await searchParams
  const date = fecha || todaySchoolDate()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'planificacion')) {
    redirect('/dashboard')
  }

  // RLS ya filtra: si este profesor no es dueño de esta franja, esto
  // simplemente no devuelve nada (igual que si no existiera).
  const { data: schedule } = await supabase
    .from('class_schedules')
    .select('id, grade_level, class_periods(name, start_time, end_time), subjects(name), staff(first_name, last_name)')
    .eq('id', scheduleId)
    .single()

  if (!schedule) notFound()

  const { data: existingPlan } = await supabase
    .from('lesson_plans')
    .select('topic, objective, activities, materials, homework')
    .eq('schedule_id', scheduleId)
    .eq('plan_date', date)
    .maybeSingle()

  const period = schedule.class_periods as unknown as { name: string; start_time: string; end_time: string } | null
  const subject = schedule.subjects as unknown as { name: string } | null
  const teacher = schedule.staff as unknown as { first_name: string; last_name: string } | null
  const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/dashboard/planificacion?fecha=${date}`} className="text-sm text-primary dark:text-accent-light hover:underline">
          ← Planificación de clases
        </Link>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 capitalize">
          {subject?.name ?? 'Clase'} · {schedule.grade_level}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">
          {formatDate(date)}
          {period && ` · ${period.start_time.slice(0, 5)}–${period.end_time.slice(0, 5)}`}
          {teacher && ` · ${teacher.first_name} ${teacher.last_name}`}
        </p>
      </div>

      <PlanForm scheduleId={scheduleId} planDate={date} initial={existingPlan ?? null} />
    </div>
  )
}
