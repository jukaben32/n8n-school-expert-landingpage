import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import ReceivablesTable, { type ReceivableRow } from './ReceivablesTable'
import AlegraSyncBanner, { type AlegraSyncRun } from '@/components/tesoreria/AlegraSyncBanner'

export const metadata: Metadata = {
  title: 'Cuentas por Cobrar — MentorIApp',
  description: 'Deuda implícita por antigüedad, por alumno, curso y nivel.',
}

export default async function CuentasPorCobrarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'tesoreria')) {
    redirect('/dashboard/pagos')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const [
    { data: school, error: schoolError },
    { data: familiesRaw, error: familiesError },
    { data: receivablesRaw, error: receivablesError },
    { data: lastRunRaw, error: lastRunError },
    { count: pendingReview },
  ] = await Promise.all([
      supabase.from('schools').select('tuition_grace_days').eq('id', schoolId).single(),
      supabase.from('families').select('id, name').eq('school_id', schoolId).is('deleted_at', null),
      supabase.rpc('list_school_receivables', { p_school_id: schoolId }),
      // Última conciliación con Alegra -- alimenta la alerta de "última
      // actualización": sin fecha de corte, este reporte invita a cobrarle
      // a una familia que ya pagó en el POS.
      supabase.from('alegra_sync_runs')
        .select('started_at, finished_at, status, invoices_seen, loaded_count, loaded_amount, review_count, error_message')
        .eq('school_id', schoolId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('alegra_payment_matches')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'pendiente'),
    ])

  const familyNames = new Map((familiesRaw ?? []).map((f) => [f.id as string, f.name as string]))

  const rows: ReceivableRow[] = ((receivablesRaw ?? []) as ReceivableRow[])
    .map((r) => ({ ...r, family_name: familyNames.get(r.family_id) ?? 'Familia N/A' }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <QueryErrorBanner errors={[
        { label: 'la configuración de mensualidades', error: schoolError },
        { label: 'las familias', error: familiesError },
        { label: 'las cuentas por cobrar', error: receivablesError },
        { label: 'la última conciliación con Alegra', error: lastRunError },
      ]} />
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Cuentas por Cobrar
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Deuda implícita por antigüedad: cuotas de mensualidad que ya debieron cobrarse según la fecha, contra lo
          que se ha cobrado de verdad. No se factura ningún mes futuro — esto es solo para análisis y gestión de
          cobro.
        </p>
      </div>

      <AlegraSyncBanner run={(lastRunRaw as AlegraSyncRun | null) ?? null} pendingReview={pendingReview ?? 0} />

      <ReceivablesTable
        rows={rows}
        graceDays={school?.tuition_grace_days ?? 5}
      />
    </div>
  )
}
