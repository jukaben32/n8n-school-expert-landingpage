import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { formatMoney, periodLabel, isPayslipRun } from '@/lib/payroll/labels'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Nómina — MentorIApp',
  description: 'Publicar los comprobantes de pago del personal.',
}

type Row = { period_key: number; run: string; published_at: string | null; notified_at: string | null; net: number | string }

export default async function NominaPage() {
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
    .select('period_key, run, published_at, notified_at, net')
    .eq('school_id', schoolId)
    .order('period_key', { ascending: false })
  const rows = (data ?? []) as Row[]

  const groups = new Map<string, { periodKey: number; run: string; count: number; drafts: number; published: number; notified: number; net: number }>()
  for (const r of rows) {
    const k = `${r.period_key}|${r.run}`
    const g = groups.get(k) ?? { periodKey: r.period_key, run: r.run, count: 0, drafts: 0, published: 0, notified: 0, net: 0 }
    g.count += 1
    g.net += Number(r.net)
    if (!r.published_at) g.drafts += 1
    else g.published += 1
    if (r.notified_at) g.notified += 1
    groups.set(k, g)
  }
  const order = { M: 0, Q1: 1, Q2: 2 } as Record<string, number>
  const list = [...groups.values()].sort((a, b) => b.periodKey - a.periodKey || (order[b.run] ?? 0) - (order[a.run] ?? 0))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Nómina del personal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cargue la nómina ya cerrada en Excel, revísela y publíquela: cada empleado verá solo su comprobante.
          </p>
        </div>
        <Link href="/dashboard/nomina/importar" className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5 shrink-0">
          + Cargar nómina
        </Link>
      </div>

      <QueryErrorBanner errors={[{ label: 'comprobantes', error }]} />

      {list.length === 0 ? (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🧾</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no se ha cargado ninguna nómina.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((g) => (
            <Link key={`${g.periodKey}|${g.run}`} href={`/dashboard/nomina/${g.periodKey}/${g.run}`} className="dash-card block p-5 transition">
              <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                {isPayslipRun(g.run) ? periodLabel(g.periodKey, g.run) : `${g.periodKey} ${g.run}`}
              </p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs font-semibold">
                <span style={{ color: 'var(--dash-text-muted)' }}>{g.count} empleados · neto RD$ {formatMoney(g.net)}</span>
                {g.drafts > 0 && <span style={{ color: 'var(--dash-warning)' }}>{g.drafts} en borrador</span>}
                {g.published > 0 && <span style={{ color: 'var(--dash-accent)' }}>{g.published} publicados</span>}
                {g.notified > 0 && <span style={{ color: 'var(--dash-text-faint)' }}>{g.notified} avisados por correo</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
