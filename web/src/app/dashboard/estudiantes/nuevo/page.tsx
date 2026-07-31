import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import NewStudentForm from './NewStudentForm'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Nuevo Estudiante — SchoolOS',
}

/**
 * Página de alta de estudiante — Solo para staff.
 * Permite vincular el estudiante a una familia existente o crear una
 * familia + tutor principal nuevos en el mismo formulario.
 */
export default async function NuevoEstudiantePage() {
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
  if (!profile || !canAccess(profile.role, 'estudiantes_nuevo')) {
    redirect('/dashboard/estudiantes')
  }

  const { data: families, error: familiesError } = await supabase
    .from('families')
    .select('id, name')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las familias', error: familiesError }]} />
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Nuevo Estudiante
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Vincúlalo a una familia existente o crea una nueva familia con su tutor principal.
        </p>
      </div>

      <NewStudentForm
        families={families ?? []}
      />
    </div>
  )
}
