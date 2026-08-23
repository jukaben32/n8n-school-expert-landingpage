import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import NewAuthorizationForm from './NewAuthorizationForm'

export const metadata: Metadata = {
  title: 'Nueva Autorización — MentorIApp',
}

export default async function NuevaAutorizacionPage() {
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
  if (!profile || !canAccess(profile.role, 'autorizaciones_nuevo')) {
    redirect('/dashboard/autorizaciones')
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
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Nueva Autorización
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          El texto que escribas aquí es lo que cada tutor va a firmar -- sé específico y completo (fecha, actividad, transporte, riesgos, etc.).
        </p>
      </div>

      <NewAuthorizationForm gradeLevelOptions={gradeLevelOptions} forceGradeMode={profile.role === 'teacher'} />
    </div>
  )
}
