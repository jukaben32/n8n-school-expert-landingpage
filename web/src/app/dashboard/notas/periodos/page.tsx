import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import PeriodsManager from './PeriodsManager'

export const metadata: Metadata = {
  title: 'Periodos de calificación — MentorIApp',
}

export default async function GradingPeriodosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId
  if (!profile || !['super_admin', 'school_admin', 'director'].includes(profile.role)) {
    redirect('/dashboard/notas')
  }

  const { data: periodsRaw } = await supabase
    .from('grading_periods')
    .select('id, name, start_date, end_date, sort_order')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })

  const periods = periodsRaw ?? []

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/notas" className="text-sm text-primary dark:text-accent-light hover:underline">
          ← Notas
        </Link>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
          Periodos de calificación
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ej. "1er Trimestre", "2do Trimestre". Se comparten entre todos los cursos y materias.
        </p>
      </div>

      <PeriodsManager initial={periods} nextSortOrder={periods.length > 0 ? Math.max(...periods.map((p) => p.sort_order)) + 1 : 0} />
    </div>
  )
}
