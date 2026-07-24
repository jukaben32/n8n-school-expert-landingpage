import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import NewLessonForm from './NewLessonForm'

export const metadata: Metadata = {
  title: 'Nueva Lección — SchoolOS',
}

export default async function NuevaLeccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'academia_gestionar')) {
    redirect('/dashboard/academia')
  }

  const [{ data: subjects }, { data: gradeLevels }] = await Promise.all([
    supabase.from('subjects').select('id, name').eq('school_id', profile.school_id).order('name'),
    supabase.from('grade_levels').select('id, name').eq('school_id', profile.school_id).order('sort_order'),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Nueva Lección
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Un video explicativo + un cuestionario corto para reforzar el tema.
        </p>
      </div>

      <NewLessonForm
        schoolId={profile.school_id}
        authorProfileId={profile.id}
        subjects={subjects ?? []}
        gradeLevels={gradeLevels ?? []}
      />
    </div>
  )
}
