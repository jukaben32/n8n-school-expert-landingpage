import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import NewInvoiceForm from './NewInvoiceForm'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Generar Factura — SchoolOS',
}

export default async function FacturarPage() {
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

  if (!profile || !canAccess(profile.role, 'tesoreria')) {
    redirect('/dashboard')
  }

  const [{ data: families, error: familiesError }, { data: concepts, error: conceptsError }] = await Promise.all([
    supabase.from('families').select('id, name, students(id, first_name, last_name)').eq('school_id', schoolId).is('deleted_at', null).order('name'),
    supabase.from('billing_concepts').select('id, name, amount, recurrence').eq('school_id', schoolId).eq('is_active', true).order('name'),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las familias', error: familiesError }, { label: 'los conceptos de cobro', error: conceptsError }]} />
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Generar Factura
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Se le asigna un comprobante fiscal (NCF) automáticamente.
        </p>
      </div>
      <NewInvoiceForm
        schoolId={schoolId}
        authorProfileId={profile.id}
        families={families ?? []}
        concepts={concepts ?? []}
      />
    </div>
  )
}
