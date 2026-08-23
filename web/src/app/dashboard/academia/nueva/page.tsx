import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import NewLessonForm from './NewLessonForm'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Nueva Lección — MentorIApp',
}

export default async function NuevaLeccionPage() {
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
  if (!profile || !canAccess(profile.role, 'academia_gestionar')) {
    redirect('/dashboard/academia')
  }

  const [{ data: subjects, error: subjectsError }, { data: gradeLevels, error: gradeLevelsError }] = await Promise.all([
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
    supabase.from('grade_levels').select('id, name').eq('school_id', schoolId).order('sort_order'),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las materias', error: subjectsError }, { label: 'los grados', error: gradeLevelsError }]} />
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Nueva Lección
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Un video explicativo + un cuestionario corto para reforzar el tema.
        </p>
      </div>

      <NewLessonForm
        schoolId={schoolId}
        authorProfileId={profile.id}
        subjects={subjects ?? []}
        gradeLevels={gradeLevels ?? []}
      />
    </div>
  )
}
