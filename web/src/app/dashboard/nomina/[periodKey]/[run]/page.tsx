import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { formatMoney, isPayslipRun, periodLabel } from '@/lib/payroll/labels'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import PeriodControls from './PeriodControls'

export const metadata: Metadata = { title: 'Nómina del período — MentorIApp' }

type Slip = { id: string; staff_id: string; employee_name: string; net: number | string; published_at: string | null; notified_at: string | null }

export default async function NominaPeriodoPage({ params }: { params: Promise<{ periodKey: string; run: string }> }) {
  const { periodKey: rawKey, run } = await params
  const periodKey = Number(rawKey)
  if (!Number.isInteger(periodKey) || !isPayslipRun(run)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'nomina_gestionar')) redirect('/dashboard')
  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data, error } = await supabase
    .from('payslips')
    .select('id, staff_id, employee_name, net, published_at, notified_at')
    .eq('school_id', schoolId).eq('period_key', periodKey).eq('run', run)
    .order('employee_name')
  const slips = (data ?? []) as Slip[]
  if (!error && slips.length === 0) notFound()

  // ¿Quién tiene cuenta de acceso? Sin cuenta no podrá ver su comprobante.
  const { data: profiles, error: profilesError } = await supabase
    .from('users_profiles')
    .select('staff_id')
    .in('staff_id', slips.map((s) => s.staff_id))
  const withLogin = new Set((profiles ?? []).map((p) => p.staff_id as string))

  const published = slips.filter((s) => s.published_at).length
  const notified = slips.filter((s) => s.notified_at).length
  const pendingNotify = slips.filter((s) => s.published_at && !s.notified_at).length
  const noLogin = slips.filter((s) => !withLogin.has(s.staff_id)).length
  const total = slips.reduce((a, s) => a + Number(s.net), 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/nomina" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>
        ← Nómina
      </Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">{periodLabel(periodKey, run)}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {slips.length} comprobantes · neto total RD$ {formatMoney(total)} · {published} publicados · {notified} avisados por correo
        </p>
      </div>

      <QueryErrorBanner errors={[{ label: 'comprobantes', error }, { label: 'cuentas de acceso', error: profilesError }]} />

      {noLogin > 0 && (
        <div role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {noLogin} {noLogin === 1 ? 'empleado no tiene' : 'empleados no tienen'} cuenta de acceso vinculada a su ficha: no podrán ver su comprobante
          (aparecen marcados abajo). Vincule su cuenta desde Personal antes de avisar.
        </div>
      )}

      <PeriodControls periodKey={periodKey} run={run} total={slips.length} published={published} pendingNotify={pendingNotify} />

      <div className="dash-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--dash-text-muted)' }}>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3 text-right">Neto</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {slips.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: 'var(--dash-border)' }}>
                <td className="px-4 py-2.5">
                  <Link href={`/dashboard/mi-nomina/${s.id}`} className="font-semibold" style={{ color: 'var(--dash-text)' }}>{s.employee_name}</Link>
                  {!withLogin.has(s.staff_id) && <span className="ml-2 text-xs font-semibold" style={{ color: 'var(--dash-warning)' }}>sin acceso</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(s.net)}</td>
                <td className="px-4 py-2.5 text-xs font-semibold">
                  {!s.published_at ? <span style={{ color: 'var(--dash-warning)' }}>Borrador</span>
                    : s.notified_at ? <span style={{ color: 'var(--dash-text-faint)' }}>Publicado · avisado</span>
                    : <span style={{ color: 'var(--dash-accent)' }}>Publicado</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
