import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Políticas internas — MentorIApp',
  description: 'Políticas del colegio que el personal lee y firma.',
}

type Policy = { id: string; title: string; is_active: boolean; created_at: string }

export default async function PoliticasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)

  const role = profile?.role ?? ''
  if (!profile || !canAccess(role, 'politicas')) redirect('/dashboard')

  const isManager = canAccess(role, 'politicas_gestionar')
  const { schoolId } = await getActiveSchool(role, profile.school_id)

  // Cliente de sesión: la RLS solo le abre al personal las de su colegio.
  let policiesQuery = supabase
    .from('staff_policies')
    .select('id, title, is_active, created_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  if (!isManager) policiesQuery = policiesQuery.eq('is_active', true)
  const { data: policiesRaw, error: policiesError } = await policiesQuery
  const policies = (policiesRaw ?? []) as Policy[]

  const { data: mySignaturesRaw, error: mySignaturesError } = await supabase
    .from('staff_policy_signatures')
    .select('policy_id, signed_at')
    .eq('profile_id', profile.id)
  const mySignedAt = new Map((mySignaturesRaw ?? []).map((s) => [s.policy_id as string, s.signed_at as string]))

  // Conteo para dirección: firmas por política contra el personal activo.
  let totalStaff = 0
  const signedCount = new Map<string, number>()
  if (isManager && policies.length > 0) {
    const admin = createAdminClient()
    const { count } = await admin
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .is('deleted_at', null)
    totalStaff = count ?? 0
    const { data: allSignatures } = await supabase
      .from('staff_policy_signatures')
      .select('policy_id')
      .in('policy_id', policies.map((p) => p.id))
    for (const s of allSignatures ?? []) {
      signedCount.set(s.policy_id as string, (signedCount.get(s.policy_id as string) ?? 0) + 1)
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
  const pendingForMe = policies.filter((p) => p.is_active && !mySignedAt.has(p.id)).length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Políticas internas</h1>
          <p className="text-sm text-slate-500 mt-1">Políticas del colegio que todo el personal debe leer y firmar.</p>
        </div>
        {isManager && (
          <Link href="/dashboard/politicas/nueva" className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5 shrink-0">
            + Nueva
          </Link>
        )}
      </div>

      <QueryErrorBanner errors={[
        { label: 'políticas', error: policiesError },
        { label: 'tus firmas', error: mySignaturesError },
      ]} />

      {!profile.staff_id && (
        <div role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Tu cuenta no está vinculada a una ficha de personal, así que todavía no puedes firmar. Pide a Dirección que la vincule.
        </div>
      )}

      {pendingForMe > 0 && profile.staff_id && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
          Tienes {pendingForMe} {pendingForMe === 1 ? 'política pendiente' : 'políticas pendientes'} de firmar.
        </div>
      )}

      {policies.length === 0 ? (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📄</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no hay políticas publicadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => {
            const signedAt = mySignedAt.get(p.id)
            const count = signedCount.get(p.id) ?? 0
            return (
              <Link key={p.id} href={`/dashboard/politicas/${p.id}`} className="dash-card block p-5 transition">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-accent-light)' }}>
                  {p.is_active ? `Publicada el ${formatDate(p.created_at)}` : 'Retirada'}
                </p>
                <p className="font-semibold mt-1" style={{ color: 'var(--dash-text)' }}>{p.title}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs font-semibold">
                  {signedAt ? (
                    <span style={{ color: 'var(--dash-accent)' }}>✓ Firmaste el {formatDate(signedAt)}</span>
                  ) : p.is_active ? (
                    <span style={{ color: 'var(--dash-warning)' }}>Pendiente de tu firma</span>
                  ) : null}
                  {isManager && (
                    <span style={{ color: 'var(--dash-text-faint)' }}>{count} de {totalStaff} firmaron</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
