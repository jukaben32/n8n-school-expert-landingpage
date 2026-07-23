import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewMessageForm from './NewMessageForm'

export const metadata: Metadata = {
  title: 'Nuevo Comunicado — SchoolOS',
}

/**
 * Página de creación de comunicados — Solo para staff.
 */
export default async function NuevoComunicadoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  const staffRoles = ['director', 'school_admin', 'teacher', 'reception', 'finance', 'super_admin']
  if (!profile || !staffRoles.includes(profile.role)) {
    redirect('/dashboard/comunicados')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Nuevo Comunicado
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Redacta un aviso para las familias del colegio.
        </p>
      </div>

      <NewMessageForm schoolId={profile.school_id} authorProfileId={profile.id} />
    </div>
  )
}
