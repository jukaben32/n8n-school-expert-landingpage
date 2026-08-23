import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Familias — MentorIApp',
  description: 'Listado de familias registradas en el colegio.',
}

type FamilyRow = {
  id: string
  name: string
  billing_email: string | null
  billing_phone: string | null
  students: { id: string }[]
  guardians: { id: string; first_name: string; last_name: string; phone: string; is_primary: boolean }[]
}

/**
 * Página de Familias — Solo para staff.
 * Lista las familias del colegio con su tutor principal y cantidad de hijos.
 */
export default async function FamiliasPage() {
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
  if (!profile || !canAccess(profile.role, 'familias')) {
    redirect('/dashboard/portal-familiar')
  }

  const { data: familiesRaw, error: familiesError } = await supabase
    .from('families')
    .select(`
      id, name, billing_email, billing_phone,
      students(id),
      guardians(id, first_name, last_name, phone, is_primary)
    `)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const families = (familiesRaw ?? []) as unknown as FamilyRow[]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las familias', error: familiesError }]} />

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Familias
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {families.length} familia{families.length !== 1 ? 's' : ''} registrada{families.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Lista de familias */}
      {familiesError && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">No se pudo cargar la lista de familias.</p>
          <p className="mt-1 font-mono text-xs">{familiesError.message}</p>
        </div>
      )}

      {families.length > 0 ? (
        <div className="grid gap-3">
          {families.map((f) => {
            const primary = f.guardians?.find((g) => g.is_primary) ?? f.guardians?.[0]
            return (
              <Link
                href={`/dashboard/familias/${f.id}`}
                key={f.id}
                className="dash-card p-5 flex items-center justify-between gap-4 transition hover:border-[rgba(150,225,196,.4)]"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{f.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-muted)' }}>
                    {primary ? `${primary.first_name} ${primary.last_name} · ${primary.phone}` : 'Sin tutor principal registrado'}
                  </p>
                </div>
                <div className="flex gap-4 shrink-0 text-center">
                  <div>
                    <p className="text-lg font-bold font-barlow" style={{ color: 'var(--dash-accent)' }}>{f.students?.length ?? 0}</p>
                    <p className="text-[10px] font-barlow uppercase tracking-wider" style={{ color: 'var(--dash-text-faint)' }}>Hijos</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-barlow" style={{ color: 'var(--dash-accent)' }}>{f.guardians?.length ?? 0}</p>
                    <p className="text-[10px] font-barlow uppercase tracking-wider" style={{ color: 'var(--dash-text-faint)' }}>Tutores</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">👨‍👩‍👧</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            Aún no hay familias registradas.<br />Se crean automáticamente al dar de alta un estudiante nuevo.
          </p>
        </div>
      )}
    </div>
  )
}
