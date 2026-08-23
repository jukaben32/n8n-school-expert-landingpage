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

  const statusColors: Record<string, string> = {
    pendiente: 'var(--dash-warning)',
    vencido: 'var(--dash-danger-strong)',
    pagado: 'var(--dash-accent)',
    anulado: 'var(--dash-text-muted)',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <QueryErrorBanner errors={[{ label: 'las facturas', error: recentInvoicesRawError }, { label: 'los pagos del mes', error: monthPaymentsRawError }]} />
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
            Tesorería
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión de ingresos, facturación y estados de cuenta.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/dashboard/tesoreria/comprobantes" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-5 py-2.5 transition">
            Comprobantes
          </a>
          <a href="/dashboard/tesoreria/facturas-proveedores" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-5 py-2.5 transition">
            Facturas de proveedores
          </a>
          <a href="/dashboard/tesoreria/facturar" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-5 py-2.5 transition">
            Generar factura
          </a>
          <a href="/dashboard/tesoreria/cobrar" className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
            Registrar pago
          </a>
        </div>
      </div>

      {/* KPI del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Ingresos del mes</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>
            {formatDOP(ingresosMes)}
          </p>
        </div>
      </div>

      {/* Tabla de últimas facturas */}
      <section>
        <h2 className="text-xs font-barlow uppercase tracking-widest mb-3" style={{ color: 'var(--dash-text-faint)' }}>
          Últimos movimientos
        </h2>

        {recentInvoices.length > 0 ? (
          <div className="dash-card overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
                <tr>
                  <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Familia</th>
                  <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Descripción</th>
                  <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs text-right" style={{ color: 'var(--dash-text-muted)' }}>Monto</th>
                  <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs text-center" style={{ color: 'var(--dash-text-muted)' }}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
                {recentInvoices.map((inv) => {
                  const guardian = inv.families?.guardians?.[0]
                  const familyName = guardian ? `${guardian.last_name}, ${guardian.first_name}` : 'Familia N/A'
                  return (
                    <tr key={inv.id} className="transition hover:bg-white/5">
                      <td className="px-4 py-3 font-medium truncate max-w-[150px]" style={{ color: 'var(--dash-text)' }}>
                        {familyName}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>
                        {inv.description}
                        {inv.ncf && <span className="ml-2 text-xs font-mono" style={{ color: 'var(--dash-text-faint)' }}>({inv.ncf})</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--dash-text)' }}>
                        {formatDOP(inv.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="px-2 py-1 rounded-full text-[10px] font-bold font-barlow uppercase tracking-wider border"
                          style={{ color: statusColors[inv.status], borderColor: 'currentColor' }}
                        >
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
          <div className="dash-card border-dashed p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">🧾</p>
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
              No hay facturas registradas en este colegio.
            </p>
          </div>
        )}
      </section>

    </div>
  )
}
