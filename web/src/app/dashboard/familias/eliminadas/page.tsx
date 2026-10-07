import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import RestoreFamilyButton from './RestoreFamilyButton'

export const metadata: Metadata = {
  title: 'Familias eliminadas — MentorIApp',
  description: 'Familias dadas de baja que se pueden restaurar.',
}

// Mismo grupo que puede eliminar una familia (ver [id]/actions.ts).
const ROLES_DIRECCION = ['super_admin', 'school_admin', 'director']

type DeletedFamily = {
  id: string
  name: string
  deleted_at: string
  students: { id: string; deleted_at: string | null }[]
}

/**
 * Familias eliminadas (soft-delete) -- solo dirección.
 * Su historial sigue en la base de datos; desde aquí se pueden restaurar.
 */
export default async function FamiliasEliminadasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !ROLES_DIRECCION.includes(profile.role)) {
    redirect('/dashboard/familias')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  // Cliente admin a propósito: el rol ya se validó arriba y el filtro por
  // colegio es explícito, sin depender de que la RLS deje ver lo eliminado.
  const { data: raw, error } = await createAdminClient()
    .from('families')
    .select('id, name, deleted_at, students(id, deleted_at)')
    .eq('school_id', schoolId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  const families = (raw ?? []) as unknown as DeletedFamily[]

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las familias eliminadas', error }]} />

      <div>
        <Link href="/dashboard/familias" className="text-xs font-semibold text-slate-400 hover:text-primary transition">
          ← Familias
        </Link>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight mt-2">Familias eliminadas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Su historial (facturas, pagos, asistencia y notas) sigue guardado. Al restaurarlas vuelven a los listados
          activos, con los hijos que se eliminaron junto con ellas.
        </p>
      </div>

      {families.length > 0 ? (
        <div className="grid gap-3">
          {families.map((f) => {
            // Los hijos que se eliminaron CON la familia (misma fecha exacta).
            const hijos = (f.students ?? []).filter((s) => s.deleted_at === f.deleted_at).length
            return (
              <div key={f.id} className="dash-card p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{f.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-muted)' }}>
                    Eliminada el {fecha(f.deleted_at)} · {hijos} {hijos === 1 ? 'hijo' : 'hijos'}
                  </p>
                </div>
                <RestoreFamilyButton familyId={f.id} familyName={f.name} />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🗂️</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            No hay familias eliminadas.
          </p>
        </div>
      )}
    </div>
  )
}
