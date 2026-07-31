import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import InvoiceCard from '@/components/pagos/InvoiceCard'
import AccountSummary from '@/components/pagos/AccountSummary'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Estado de Cuenta — MentorIApp',
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

const azulBannerCopy: Record<string, { text: string; tone: 'ok' | 'warn' | 'error' }> = {
  aprobado: { text: '✓ Tu pago con tarjeta fue aprobado.', tone: 'ok' },
  declinado: { text: 'El pago con tarjeta fue declinado. Puedes intentar de nuevo o pagar por transferencia.', tone: 'warn' },
  cancelado: { text: 'Cancelaste el pago con tarjeta.', tone: 'warn' },
  error: { text: 'No se pudo confirmar el resultado del pago. Si tu tarjeta fue cargada, contacta a secretaría.', tone: 'error' },
}
const bannerToneClass: Record<'ok' | 'warn' | 'error', string> = {
  ok: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
  warn: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
}

/**
 * Página de Pagos — Portal Familiar
 * Muestra el estado de cuenta de la familia: facturas pendientes,
 * vencidas y pagadas con resumen del saldo total.
 */
export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ azul?: string }>
}) {
  const { azul } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, guardian_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  // Staff redirige al módulo de tesorería
  if (profile && canAccess(profile?.role, 'pagos')) {
    redirect('/dashboard/tesoreria')
  }

  // Obtener family_id del guardian
  let familyId: string | null = null
  let guardianError: { message: string } | null = null
  if (profile?.guardian_id) {
    const { data: guardian, error: gErr } = await supabase
      .from('guardians')
      .select('family_id')
      .eq('id', profile.guardian_id)
      .single()
    guardianError = gErr
    familyId = guardian?.family_id ?? null
  }

  // Cargar facturas de la familia
  const { data: invoicesRaw, error: invoicesRawError } = familyId
    ? await supabase
        .from('invoices')
        .select('id, description, total_amount, due_date, status, ncf, paid_at, students(first_name, last_name)')
        .eq('family_id', familyId)
        .is('deleted_at', null)
        .order('due_date', { ascending: false })
    : { data: [], error: null }

  const invoices = (invoicesRaw ?? []) as unknown as Invoice[]

  // Último comprobante subido por factura (para no dejar que la familia
  // suba dos veces mientras uno ya está en revisión, y para mostrar si
  // uno fue rechazado).
  const { data: receiptsRaw } = familyId
    ? await supabase
        .from('payment_receipts')
        .select('invoice_id, status, created_at')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
    : { data: [] }

  const receiptStatusByInvoice = new Map<string, 'pendiente' | 'confirmado' | 'rechazado'>()
  for (const r of (receiptsRaw ?? []) as { invoice_id: string; status: 'pendiente' | 'confirmado' | 'rechazado' }[]) {
    if (!receiptStatusByInvoice.has(r.invoice_id)) receiptStatusByInvoice.set(r.invoice_id, r.status)
  }

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
      <QueryErrorBanner errors={[
        { label: 'tus datos', error: guardianError },
        { label: 'tus facturas', error: invoicesRawError },
      ]} />

      {azul && azulBannerCopy[azul] && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${bannerToneClass[azulBannerCopy[azul].tone]}`}>
          {azulBannerCopy[azul].text}
        </div>
      )}

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
              <InvoiceCard key={invoice.id} invoice={invoice} receiptStatus={receiptStatusByInvoice.get(invoice.id)} />
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
