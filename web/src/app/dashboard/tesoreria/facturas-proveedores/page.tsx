import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { listPendingVendorInvoices } from './actions'
import VendorInvoicesReview from './VendorInvoicesReview'

export const metadata: Metadata = {
  title: 'Facturas de proveedores — SchoolOS',
}

/**
 * Bandeja de escaneo de facturas de proveedores. Sube fotos/PDFs, Claude
 * extrae los campos, y tesorería revisa/corrige antes de aprobar. Al
 * aprobar se intenta sincronizar con Alegra (ver web/src/lib/accounting/alegra.ts).
 */
export default async function VendorInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')

  if (!profile || !canAccess(profile.role, 'tesoreria')) {
    redirect('/dashboard/pagos')
  }

  const invoices = await listPendingVendorInvoices()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Facturas de proveedores
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Sube fotos o PDFs de facturas de proveedores. Revisa y corrige los datos antes de aprobar -- nada se
          registra hasta que confirmes cada factura.
        </p>
      </div>

      <VendorInvoicesReview initialInvoices={invoices} />
    </div>
  )
}
