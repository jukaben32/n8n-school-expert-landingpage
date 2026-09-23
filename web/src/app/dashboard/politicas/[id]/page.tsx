import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { roleLabels } from '@/lib/staff/roleLabels'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import SignPolicyForm from '../SignPolicyForm'
import PolicyActiveToggle from '../PolicyActiveToggle'
import PrintButton from '../PrintButton'

export const metadata: Metadata = {
  title: 'Política interna — MentorIApp',
}

type Signature = {
  staff_id: string
  signer_full_name: string
  signer_national_id: string
  signer_position: string
  signed_at: string
}

export default async function PoliticaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()
  const role = profile?.role ?? ''
  if (!profile || !canAccess(role, 'politicas')) redirect('/dashboard')

  const isManager = canAccess(role, 'politicas_gestionar')
  const { schoolId } = await getActiveSchool(role, profile.school_id)

  const { data: policy } = await supabase
    .from('staff_policies')
    .select('id, school_id, title, body, is_active, created_at')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!policy || (!policy.is_active && !isManager)) notFound()

  const { data: mySignature } = await supabase
    .from('staff_policy_signatures')
    .select('signer_full_name, signed_at')
    .eq('policy_id', policy.id)
    .eq('profile_id', profile.id)
    .maybeSingle()

  // Datos de la ficha para prellenar la firma (se pueden corregir).
  const admin = createAdminClient()
  let defaultFullName = ''
  let defaultPosition = ''
  if (profile.staff_id && !mySignature) {
    const { data: me } = await admin
      .from('staff')
      .select('first_name, last_name, role')
      .eq('id', profile.staff_id)
      .maybeSingle()
    if (me) {
      defaultFullName = `${me.first_name} ${me.last_name}`.trim()
      defaultPosition = roleLabels[me.role as string] ?? ''
    }
  }

  // ── Roster para dirección: todo el personal activo contra las firmas ──
  let roster: { staffId: string; name: string; position: string; hasAccess: boolean; signature: Signature | null }[] = []
  let rosterError: { message: string } | null = null
  if (isManager) {
    const [{ data: staffRaw, error: staffError }, { data: signaturesRaw, error: sigError }, { data: profilesRaw }] = await Promise.all([
      admin.from('staff').select('id, first_name, last_name, role').eq('school_id', schoolId).is('deleted_at', null).order('last_name'),
      supabase
        .from('staff_policy_signatures')
        .select('staff_id, signer_full_name, signer_national_id, signer_position, signed_at')
        .eq('policy_id', policy.id),
      admin.from('users_profiles').select('staff_id').eq('school_id', schoolId).not('staff_id', 'is', null),
    ])
    rosterError = staffError ?? sigError
    const sigByStaff = new Map(((signaturesRaw ?? []) as Signature[]).map((s) => [s.staff_id, s]))
    const withAccess = new Set((profilesRaw ?? []).map((p) => p.staff_id as string))
    roster = (staffRaw ?? []).map((s) => ({
      staffId: s.id as string,
      name: `${s.first_name} ${s.last_name}`,
      position: roleLabels[s.role as string] ?? (s.role as string),
      hasAccess: withAccess.has(s.id as string),
      signature: sigByStaff.get(s.id as string) ?? null,
    }))
  }
  const signedTotal = roster.filter((r) => r.signature).length

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('es-DO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Santo_Domingo' })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="print:hidden">
        <Link href="/dashboard/politicas" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>
          ← Políticas internas
        </Link>
      </div>

      <div className="dash-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-accent-light)' }}>
              {policy.is_active ? 'Vigente' : 'Retirada'}
            </p>
            <h1 className="text-xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{policy.title}</h1>
          </div>
          {isManager && <PolicyActiveToggle policyId={policy.id} isActive={policy.is_active} />}
        </div>

        <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--dash-text)' }}>
          {policy.body}
        </div>

        {mySignature ? (
          <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
            ✓ Firmada por {mySignature.signer_full_name} el {formatDateTime(mySignature.signed_at)}
          </div>
        ) : policy.is_active && profile.staff_id ? (
          <SignPolicyForm policyId={policy.id} defaultFullName={defaultFullName} defaultPosition={defaultPosition} />
        ) : policy.is_active ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Tu cuenta no está vinculada a una ficha de personal, así que todavía no puedes firmar. Pide a Dirección que la vincule.
          </p>
        ) : null}
      </div>

      {isManager && (
        <div className="dash-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-barlow" style={{ color: 'var(--dash-text)' }}>Firmas del personal</h2>
              <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>{signedTotal} de {roster.length} firmaron</p>
            </div>
            <PrintButton />
          </div>

          <QueryErrorBanner errors={[{ label: 'firmas del personal', error: rosterError }]} />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--dash-text-faint)' }}>
                  <th className="py-2 pr-3">Empleado</th>
                  <th className="py-2 pr-3">Cargo</th>
                  <th className="py-2 pr-3">Cédula</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.staffId} className="border-t" style={{ borderColor: 'var(--dash-border)' }}>
                    <td className="py-2 pr-3" style={{ color: 'var(--dash-text)' }}>{r.signature?.signer_full_name ?? r.name}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--dash-text-muted)' }}>{r.signature?.signer_position ?? r.position}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--dash-text-muted)' }}>{r.signature?.signer_national_id ?? '—'}</td>
                    <td className="py-2 text-xs font-semibold">
                      {r.signature ? (
                        <span style={{ color: 'var(--dash-accent)' }}>✓ Firmó el {formatDateTime(r.signature.signed_at)}</span>
                      ) : r.hasAccess ? (
                        <span style={{ color: 'var(--dash-warning)' }}>Pendiente</span>
                      ) : (
                        <span style={{ color: 'var(--dash-text-faint)' }}>Sin acceso a la plataforma</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>
            &quot;Sin acceso a la plataforma&quot;: esa persona todavía no tiene cuenta, así que no puede firmar. Se le da acceso desde Personal.
          </p>
        </div>
      )}
    </div>
  )
}
