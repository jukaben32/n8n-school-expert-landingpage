import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import InvoiceCard from '@/components/pagos/InvoiceCard'
import AccountSummary from '@/components/pagos/AccountSummary'

export const metadata: Metadata = {
  title: 'Estado de Cuenta — SchoolOS',
  description: 'Consulta y gestiona los pagos escolares de tu familia.',
}

type InvoiceStatus = 'pendiente' | 'pagado' | 'vencido' | 'anulado'

interface Invoice {
  id: string
  description: string
  total_amount: number
  due_date: string
  status: InvoiceStatus
  ncf: string | null
  paid_at: string | null
  students: { first_name: string; last_name: string } | null
}

/**
 * Página de Pagos — Portal Familiar
 * Muestra el estado de cuenta de la familia: facturas pendientes,
 * vencidas y pagadas con resumen del saldo total.
 */
export default async function PagosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, guardian_id')
    .eq('auth_id', user.id)
    .single()

  // Staff redirige al módulo de tesorería
  if (profile && canAccess(profile?.role, 'pagos')) {
    redirect('/dashboard/tesoreria')
  }

  // Obtener family_id del guardian
  let familyId: string | null = null
  if (profile?.guardian_id) {
    const { data: guardian } = await supabase
      .from('guardians')
      .select('family_id')
      .eq('id', profile.guardian_id)
      .single()
    familyId = guardian?.family_id ?? null
  }

  // Cargar facturas de la familia
  const { data: invoicesRaw } = familyId
    ? await supabase
        .from('invoices')
        .select('id, description, total_amount, due_date, status, ncf, paid_at, students(first_name, last_name)')
        .eq('family_id', familyId)
        .is('deleted_at', null)
        .order('due_date', { ascending: false })
    : { data: [] }

  const invoices = (invoicesRaw ?? []) as unknown as Invoice[]

  // Calcular resumen financiero
  const totalPendiente = invoices
    .filter((i) => i.status === 'pendiente')
    .reduce((sum, i) => sum + i.total_amount, 0)

  const totalVencido = invoices
    .filter((i) => i.status === 'vencido')
    .reduce((sum, i) => sum + i.total_amount, 0)

  const totalPagado = invoices
    .filter((i) => i.status === 'pagado')
    .reduce((sum, i) => sum + i.total_amount, 0)

  // Agrupar por estado para mostrar sección organizada
  const pendientes = invoices.filter((i) => i.status === 'pendiente' || i.status === 'vencido')
  const pagadas    = invoices.filter((i) => i.status === 'pagado')

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Estado de Cuenta
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consulta tus facturas y realiza seguimiento de pagos
        </p>
      </div>

      {/* Resumen financiero */}
      <AccountSummary
        totalPendiente={totalPendiente}
        totalVencido={totalVencido}
        totalPagado={totalPagado}
      />

      {/* Facturas pendientes / vencidas */}
      {pendientes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Pendientes de pago ({pendientes.length})
          </h2>
          <div className="space-y-3">
            {pendientes.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </div>
        </section>
      )}

      {/* Facturas pagadas */}
      {pagadas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Historial de pagos ({pagadas.length})
          </h2>
          <div className="space-y-3">
            {pagadas.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </div>
        </section>
      )}

      {/* Estado vacío */}
      {invoices.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">💳</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No hay facturas registradas aún.
          </p>
        </div>
      )}
    </div>
  )
}
