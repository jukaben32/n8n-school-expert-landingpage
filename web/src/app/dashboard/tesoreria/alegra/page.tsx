import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import AlegraMatchesReview, { type PendingMatch, type StudentOption } from './AlegraMatchesReview'

export const metadata: Metadata = {
  title: 'Conciliación con Alegra — MentorIApp',
  description: 'Cobros del POS que necesitan revisión antes de descontarse de la deuda.',
}

/**
 * Sin módulo nuevo en `permissions.ts` a propósito: usa el mismo permiso
 * `tesoreria` que Cuentas por Cobrar, y se llega por un enlace desde ahí.
 * Un módulo nuevo obligaría a tocar también `Sidebar.tsx`, y esos dos
 * archivos desincronizados ya dejaron funciones inalcanzables en este
 * proyecto más de una vez.
 */
const formatDOP = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

export default async function ConciliacionAlegraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)
  if (!profile || !canAccess(profile.role, 'tesoreria')) redirect('/dashboard/pagos')

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const [{ data: matchesRaw, error: matchesError }, { data: studentsRaw, error: studentsError }, { data: runsRaw, error: runsError }] =
    await Promise.all([
      supabase.from('alegra_payment_matches')
        .select('id, alegra_number, alegra_date, alegra_client_name, alegra_client_identification, alegra_client_id_type, alegra_note, alegra_payment_method, amount, assigned_amount, reason, candidates')
        .eq('school_id', schoolId)
        .eq('status', 'pendiente')
        .order('alegra_date', { ascending: false }),
      supabase.from('students')
        .select('id, first_name, last_name, grade_level')
        .eq('school_id', schoolId)
        .eq('enrollment_status', 'inscrito')
        .is('deleted_at', null)
        .order('first_name'),
      supabase.from('alegra_sync_runs')
        .select('id, started_at, finished_at, status, trigger_source, invoices_seen, loaded_count, loaded_amount, review_count, skipped_count, error_message')
        .eq('school_id', schoolId)
        .order('started_at', { ascending: false })
        .limit(10),
    ])

  const matches = (matchesRaw ?? []) as unknown as PendingMatch[]
  const students: StudentOption[] = (studentsRaw ?? []).map((s) => ({
    id: s.id as string,
    name: `${s.first_name} ${s.last_name}`.trim(),
    gradeLevel: (s.grade_level as string | null) ?? null,
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <QueryErrorBanner errors={[
        { label: 'los cobros por revisar', error: matchesError },
        { label: 'los estudiantes', error: studentsError },
        { label: 'el historial de conciliaciones', error: runsError },
      ]} />

      <div>
        <Link href="/dashboard/tesoreria/cuentas-por-cobrar" className="text-sm text-[#1a5f7a] hover:underline">
          ← Cuentas por Cobrar
        </Link>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight mt-1">
          Conciliación con Alegra
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Los cobros del POS que emparejan sin ninguna duda se registran solos. Los que aparecen aquí necesitan que
          alguien decida a qué estudiante corresponden — nunca se registran a ciegas.
        </p>
      </div>

      <AlegraMatchesReview matches={matches} students={students} />

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Últimas corridas</h2>
        {(runsRaw ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no ha corrido ninguna vez.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Cuándo</th>
                  <th className="px-3 py-2 text-left">Origen</th>
                  <th className="px-3 py-2 text-right">Vistas</th>
                  <th className="px-3 py-2 text-right">Registradas</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-right">A revisar</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(runsRaw ?? []).map((r) => (
                  <tr key={r.id as string}>
                    <td className="px-3 py-2 text-slate-700">{formatMoment((r.finished_at as string) ?? (r.started_at as string))}</td>
                    <td className="px-3 py-2 text-slate-500">{r.trigger_source === 'manual' ? 'A mano' : 'Automática'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.invoices_seen as number}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.loaded_count as number}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatDOP.format(Number(r.loaded_amount ?? 0))}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.review_count as number}</td>
                    <td className="px-3 py-2">
                      {r.status === 'ok' ? (
                        <span className="text-emerald-700">Completada</span>
                      ) : (
                        <span className="text-red-700" title={(r.error_message as string) ?? undefined}>
                          {r.status === 'sin_credenciales' ? 'Alegra sin configurar' : 'Falló'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
