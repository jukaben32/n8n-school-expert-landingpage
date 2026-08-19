import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { listPendingStaffRegistrations } from './actions'
import StaffRegistrationsReview from './StaffRegistrationsReview'

export const metadata: Metadata = {
  title: 'Registros de personal — MentorIApp',
}

export default async function RegistrosPersonalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'personal')) {
    redirect('/dashboard')
  }

  const registrations = await listPendingStaffRegistrations()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Registros de personal
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Revisa lo que cada persona completó en el formulario público, corrige si hace falta, y aprueba para
          crear su ficha real.
        </p>
      </div>
      <StaffRegistrationsReview initial={registrations} />
    </div>
  )
}
