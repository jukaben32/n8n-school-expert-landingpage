import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import NewEventForm from './NewEventForm'

export const metadata: Metadata = {
  title: 'Nuevo Evento — MentorIApp',
}

/**
 * Página de creación de eventos de Agenda — Solo para staff.
 */
export default async function NuevoEventoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId
  if (!profile || !canAccess(profile.role, 'agenda_nuevo')) {
    redirect('/dashboard/agenda')
  }

  const { data: studentsWithGrade } = await supabase
    .from('students')
    .select('grade_level')
    .eq('school_id', schoolId)
    .not('grade_level', 'is', null)
    .is('deleted_at', null)

  const gradeLevelOptions = Array.from(
    new Set((studentsWithGrade ?? []).map((s) => s.grade_level as string).filter(Boolean))
  ).sort()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Nuevo Evento
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Agrega una fecha importante a la agenda del colegio.
        </p>
      </div>

      <NewEventForm gradeLevelOptions={gradeLevelOptions} forceGradeMode={profile.role === 'teacher'} />
    </div>
  )
}
