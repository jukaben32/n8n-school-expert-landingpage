import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import NewStaffForm from './NewStaffForm'

export const metadata: Metadata = {
  title: 'Agregar Personal — SchoolOS',
}

export default async function NuevoPersonalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId

  if (!profile || !canAccess(profile.role, 'personal')) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Agregar Personal
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Datos de contacto y ficha profesional.
        </p>
      </div>
      <NewStaffForm schoolId={schoolId} />
    </div>
  )
}
