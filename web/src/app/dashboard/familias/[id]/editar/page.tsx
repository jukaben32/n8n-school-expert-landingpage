import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect, notFound } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import EditFamilyForm from './EditFamilyForm'

export const metadata: Metadata = {
  title: 'Editar familia — MentorIApp',
}

export default async function EditarFamiliaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  const { schoolId } = await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')

  if (!profile || !canAccess(profile.role, 'familias')) {
    redirect('/dashboard')
  }

  const { data: family } = await supabase
    .from('families')
    .select('id, name, billing_email, billing_phone')
    .eq('id', id)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .single()

  if (!family) notFound()

  const { data: guardiansRaw } = await supabase
    .from('guardians')
    .select('id, first_name, last_name, phone, email, relationship, is_primary')
    .eq('family_id', id)
    .order('is_primary', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Editar familia
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Datos de facturación y padres/tutores de {family.name}.
        </p>
      </div>
      <EditFamilyForm schoolId={schoolId} family={family} initialGuardians={guardiansRaw ?? []} />
    </div>
  )
}
