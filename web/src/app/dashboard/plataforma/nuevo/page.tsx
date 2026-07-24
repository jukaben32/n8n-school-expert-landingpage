import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewSchoolForm from './NewSchoolForm'

export const metadata: Metadata = {
  title: 'Nuevo Colegio — SchoolOS',
}

export default async function NuevoColegioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard/secretaria')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Nuevo Colegio
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Registra un nuevo colegio en la plataforma.
        </p>
      </div>
      <NewSchoolForm />
    </div>
  )
}
