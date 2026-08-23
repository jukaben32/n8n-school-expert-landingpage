import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import PeriodsManager from './PeriodsManager'

export const metadata: Metadata = {
  title: 'Franjas horarias — MentorIApp',
}

export default async function PeriodosPage() {
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
  if (!profile || !canAccess(profile.role, 'horarios_gestionar')) {
    redirect('/dashboard/horarios')
  }

  const { data: periodsRaw } = await supabase
    .from('class_periods')
    .select('id, name, start_time, end_time, sort_order, level')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })

  const periods = periodsRaw ?? []

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/horarios" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
          ← Horarios
        </Link>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight mt-1">
          Franjas horarias
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Define las horas del día una sola vez (ej. &quot;Período 1: 8:00–8:45&quot;). Si primaria y
          secundaria tienen horarios distintos, asigna el nivel a cada franja; las que no tengan
          nivel se usan en todos los cursos.
        </p>
      </div>

      <PeriodsManager initial={periods} nextSortOrder={periods.length > 0 ? Math.max(...periods.map((p) => p.sort_order)) + 1 : 0} />
    </div>
  )
}
