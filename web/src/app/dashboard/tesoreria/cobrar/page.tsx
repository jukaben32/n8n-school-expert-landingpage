import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import NewPaymentForm from './NewPaymentForm'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Registrar Pago — SchoolOS',
}

export default async function CobrarPage() {
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

  const { data: invoicesRaw, error: invoicesRawError } = await supabase
    .from('invoices')
    .select('id, description, total_amount, due_date, status, families(name)')
    .eq('school_id', schoolId)
    .in('status', ['pendiente', 'vencido'])
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  type PendingInvoice = {
    id: string; description: string; total_amount: number; due_date: string; status: string
    families: { name: string } | null
  }
  const invoices = (invoicesRaw ?? []) as unknown as PendingInvoice[]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las facturas pendientes', error: invoicesRawError }]} />
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Registrar Pago
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Marca una factura como pagada al recibir el cobro.
        </p>
      </div>
      <NewPaymentForm schoolId={schoolId} receivedBy={profile.id} invoices={invoices} />
    </div>
  )
}
