import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { formatMoney, isPayslipRun, periodLabel } from '@/lib/payroll/labels'
import PrintReceiptButton from './PrintReceiptButton'

export const metadata: Metadata = { title: 'Comprobante de pago — MentorIApp' }

export default async function ComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'mi_nomina')) redirect('/dashboard')

  // La RLS decide: el dueño ve su comprobante PUBLICADO; Dirección ve
  // cualquiera de su colegio (para revisarlo antes de publicar). Para
  // cualquier otra persona esto devuelve null -> 404, nunca "sin permiso",
  // para no confirmar que ese comprobante existe.
  const { data: slip } = await supabase.from('payslips').select('*').eq('id', id).maybeSingle()
  if (!slip || !isPayslipRun(slip.run)) notFound()

  const isOwner = !!profile.staff_id && profile.staff_id === slip.staff_id
  const isManager = canAccess(profile.role, 'nomina_gestionar')
  if (!isOwner && !isManager) notFound()

  // Constancia de quién lo abrió (Ley 172-13): solo la primera vez, solo el dueño.
  if (isOwner && slip.published_at) {
    const { error: viewError } = await supabase
      .from('payslip_views')
      .upsert({ payslip_id: slip.id, profile_id: profile.id }, { onConflict: 'payslip_id,profile_id', ignoreDuplicates: true })
    if (viewError) console.error('[payslip_views]', viewError.message)
  }

  const { data: school } = await supabase.from('schools').select('name').eq('id', slip.school_id).maybeSingle()
  const income = [
    ['Sueldo del período', slip.base_salary],
    ['Otros ingresos', slip.other_income],
  ] as const
  const deductions = [
    ['AFP', slip.afp], ['ARS / SFS', slip.ars], ['ISR (Renta)', slip.isr], ['Seguro médico privado', slip.private_insurance],
    ['Colegiatura', slip.tuition_discount], ['Club de ahorro (aporte)', slip.savings_deposit], ['Avances', slip.advances],
    ['Préstamos (cuota)', slip.loan_installment], ['Cafetería', slip.cafeteria], ['Uniformes', slip.uniforms], ['Otros descuentos', slip.other_deductions],
  ] as const

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={isOwner ? '/dashboard/mi-nomina' : `/dashboard/nomina/${slip.period_key}/${slip.run}`} className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>
          ← Volver
        </Link>
        <PrintReceiptButton />
      </div>

      {!slip.published_at && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800 print:hidden">
          BORRADOR: todavía no está publicado. Solo Dirección puede verlo.
        </p>
      )}

      <div className="dash-card p-6 space-y-4 print:shadow-none print:border-0">
        <div>
          <p className="font-bold text-lg" style={{ color: 'var(--dash-text)' }}>{school?.name ?? ''}</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>COMPROBANTE DE PAGO DE NÓMINA</p>
          <p className="text-sm font-semibold mt-1" style={{ color: 'var(--dash-text)' }}>Período: {periodLabel(slip.period_key, slip.run)}</p>
        </div>
        <div className="text-sm" style={{ color: 'var(--dash-text)' }}>
          <p><span className="font-semibold">Empleado:</span> {slip.employee_name}</p>
          <p><span className="font-semibold">Forma de pago:</span> {slip.payment_method}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="font-semibold uppercase text-xs tracking-wide mb-2" style={{ color: 'var(--dash-text-muted)' }}>Ingresos</p>
            {income.map(([label, value]) => (
              <div key={label} className="flex justify-between py-0.5"><span>{label}</span><span className="tabular-nums">{formatMoney(value)}</span></div>
            ))}
            <div className="flex justify-between py-1 mt-2 border-t font-semibold" style={{ borderColor: 'var(--dash-border)' }}>
              <span>Total ganado</span><span className="tabular-nums">{formatMoney(slip.gross)}</span>
            </div>
          </div>
          <div>
            <p className="font-semibold uppercase text-xs tracking-wide mb-2" style={{ color: 'var(--dash-text-muted)' }}>Deducciones</p>
            {deductions.filter(([, v]) => Number(v) !== 0).map(([label, value]) => (
              <div key={label} className="flex justify-between py-0.5"><span>{label}</span><span className="tabular-nums">{formatMoney(value)}</span></div>
            ))}
            <div className="flex justify-between py-1 mt-2 border-t font-semibold" style={{ borderColor: 'var(--dash-border)' }}>
              <span>Total deducciones</span><span className="tabular-nums">{formatMoney(slip.total_deductions)}</span>
            </div>
            {Number(slip.savings_withdrawal) !== 0 && (
              <div className="flex justify-between py-0.5"><span>Retiro del club de ahorro (+)</span><span className="tabular-nums">{formatMoney(slip.savings_withdrawal)}</span></div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center rounded-xl px-4 py-3 bg-emerald-50 text-emerald-900">
          <span className="font-bold">NETO A PAGAR</span>
          <span className="font-bold text-lg tabular-nums">RD$ {formatMoney(slip.net)}</span>
        </div>
      </div>
    </div>
  )
}
