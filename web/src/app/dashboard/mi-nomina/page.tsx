import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { formatMoney, isPayslipRun, periodLabel } from '@/lib/payroll/labels'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Mi nómina — MentorIApp',
  description: 'Tus comprobantes de pago.',
}

export default async function MiNominaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, staff_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'mi_nomina')) redirect('/dashboard')

  // La RLS ya deja pasar SOLO los comprobantes publicados de esta persona;
  // el filtro por staff_id es para que la pantalla nunca dependa de eso
  // (Dirección, que ve todos, también vería aquí solo los suyos).
  const { data, error } = profile.staff_id
    ? await supabase
        .from('payslips')
        .select('id, period_key, run, net, published_at')
        .eq('staff_id', profile.staff_id)
        .not('published_at', 'is', null)
        .order('period_key', { ascending: false })
        .order('run', { ascending: false })
    : { data: [], error: null }
  const slips = data ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Mi nómina</h1>
        <p className="text-sm text-slate-500 mt-1">Tus comprobantes de pago. Solo tú puedes verlos.</p>
      </div>

      <QueryErrorBanner errors={[{ label: 'tus comprobantes', error }]} />

      {!profile.staff_id && (
        <div role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Tu cuenta no está vinculada a una ficha de personal, así que no hay comprobantes para mostrar. Pide a Dirección que la vincule.
        </div>
      )}

      {profile.staff_id && slips.length === 0 && !error && (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🧾</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no hay comprobantes publicados.</p>
        </div>
      )}

      <div className="space-y-3">
        {slips.map((s) => (
          <Link key={s.id} href={`/dashboard/mi-nomina/${s.id}`} className="dash-card flex items-center justify-between gap-3 p-5 transition">
            <div>
              <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                {isPayslipRun(s.run) ? periodLabel(s.period_key as number, s.run) : `${s.period_key} ${s.run}`}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--dash-text-muted)' }}>Neto a pagar</p>
            </div>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--dash-text)' }}>RD$ {formatMoney(s.net)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
