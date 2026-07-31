import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Tesorería — MentorIApp',
  description: 'Gestión de facturas, cobros y finanzas escolares.',
}

/**
 * Página de Tesorería — Solo para staff.
 * Muestra el panel central de finanzas, resumen de ingresos
 * y las últimas facturas generadas.
 */
export default async function TesoreriaPage() {
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
    redirect('/dashboard/pagos')
  }

  // Cargar resumen de facturas
  const { data: recentInvoicesRaw, error: recentInvoicesRawError } = await supabase
    .from('invoices')
    .select(`
      id, description, total_amount, due_date, status, ncf, paid_at,
      families(id, guardians(first_name, last_name))
    `)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  // Tipo rústico para las facturas con familias
  type InvoiceFamily = {
    id: string
    description: string
    total_amount: number
    due_date: string
    status: string
    ncf: string | null
    paid_at: string | null
    families: {
      guardians: { first_name: string; last_name: string }[]
    } | null
  }
  const recentInvoices = (recentInvoicesRaw ?? []) as unknown as InvoiceFamily[]

  // Resumen del mes actual
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data: monthPaymentsRaw, error: monthPaymentsRawError } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('school_id', schoolId)
    .gte('paid_at', startOfMonth.toISOString())

  const monthPayments = (monthPaymentsRaw ?? []) as { amount_paid: number }[]
  const ingresosMes = monthPayments.reduce((sum, p) => sum + p.amount_paid, 0)

  const formatDOP = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
    }).format(amount)
  }

  const statusStyles: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    vencido:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    pagado:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    anulado:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <QueryErrorBanner errors={[{ label: 'las facturas', error: recentInvoicesRawError }, { label: 'los pagos del mes', error: monthPaymentsRawError }]} />
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Tesorería
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestión de ingresos, facturación y estados de cuenta.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/dashboard/tesoreria/comprobantes" className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold px-5 py-2.5 transition">
            Comprobantes
          </a>
          <a href="/dashboard/tesoreria/facturas-proveedores" className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold px-5 py-2.5 transition">
            Facturas de proveedores
          </a>
          <a href="/dashboard/tesoreria/facturar" className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold px-5 py-2.5 transition">
            Generar factura
          </a>
          <a href="/dashboard/tesoreria/cobrar" className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow">
            Registrar pago
          </a>
        </div>
      </div>

      {/* KPI del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Ingresos del mes</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatDOP(ingresosMes)}
          </p>
        </div>
      </div>

      {/* Tabla de últimas facturas */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Últimos movimientos
        </h2>
        
        {recentInvoices.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Familia</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Descripción</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-right">Monto</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {recentInvoices.map((inv) => {
                  const guardian = inv.families?.guardians?.[0]
                  const familyName = guardian ? `${guardian.last_name}, ${guardian.first_name}` : 'Familia N/A'
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                        {familyName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {inv.description}
                        {inv.ncf && <span className="ml-2 text-xs font-mono text-slate-400">({inv.ncf})</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatDOP(inv.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusStyles[inv.status]}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">🧾</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              No hay facturas registradas en este colegio.
            </p>
          </div>
        )}
      </section>

    </div>
  )
}
