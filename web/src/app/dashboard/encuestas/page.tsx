import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import NewPollForm from './NewPollForm'

export const metadata: Metadata = {
  title: 'Encuestas y Votaciones — MentorIApp',
  description: 'Encuestas al personal y las familias, y votaciones de junta directiva por curso.',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'var(--dash-text-faint)' },
  abierta: { label: 'Abierta', color: 'var(--dash-accent)' },
  cerrada: { label: 'Cerrada', color: 'var(--dash-text-muted)' },
}

export default async function EncuestasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'encuestas')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const puedeGestionar = canAccess(profile.role, 'encuestas_gestionar')

  const [{ data: polls, error: pollsError }, { data: studentsWithGrade }] = await Promise.all([
    supabase
      .from('polls')
      .select('id, type, title, description, grade_level, audience, status, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
    supabase
      .from('students')
      .select('grade_level')
      .eq('school_id', schoolId)
      .eq('enrollment_status', 'inscrito')
      .not('grade_level', 'is', null)
      .is('deleted_at', null),
  ])

  const gradeLevelOptions = Array.from(
    new Set((studentsWithGrade ?? []).map((s) => s.grade_level as string).filter(Boolean))
  ).sort()

  const votaciones = (polls ?? []).filter((p) => p.type === 'votacion')
  const encuestas = (polls ?? []).filter((p) => p.type === 'encuesta')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las encuestas', error: pollsError }]} />

      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Encuestas y Votaciones
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Encuestas al personal y a las familias, y votaciones de junta directiva por curso — con voto
          secreto y conteo automático.
        </p>
      </div>

      {puedeGestionar && <NewPollForm gradeLevelOptions={gradeLevelOptions} />}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Votaciones de junta directiva
        </h2>
        {votaciones.length === 0 ? (
          <div className="dash-card border-dashed p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
              Todavía no hay votaciones.
            </p>
          </div>
        ) : (
          votaciones.map((p) => (
            <Link key={p.id} href={`/dashboard/encuestas/${p.id}`} className="dash-card p-4 flex items-center justify-between gap-3 transition">
              <div className="min-w-0">
                <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{p.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>
                  {p.grade_level}
                </p>
              </div>
              <span
                className="shrink-0 text-[10px] font-bold font-barlow uppercase tracking-wider px-2.5 py-1 rounded-full border"
                style={{ color: STATUS_LABELS[p.status]?.color, borderColor: 'currentColor' }}
              >
                {STATUS_LABELS[p.status]?.label ?? p.status}
              </span>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Encuestas
        </h2>
        {encuestas.length === 0 ? (
          <div className="dash-card border-dashed p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
              Todavía no hay encuestas.
            </p>
          </div>
        ) : (
          encuestas.map((p) => (
            <Link key={p.id} href={`/dashboard/encuestas/${p.id}`} className="dash-card p-4 flex items-center justify-between gap-3 transition">
              <div className="min-w-0">
                <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{p.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>
                  Dirigida a: {p.audience === 'ambos' ? 'personal y familias' : p.audience}
                </p>
              </div>
              <span
                className="shrink-0 text-[10px] font-bold font-barlow uppercase tracking-wider px-2.5 py-1 rounded-full border"
                style={{ color: STATUS_LABELS[p.status]?.color, borderColor: 'currentColor' }}
              >
                {STATUS_LABELS[p.status]?.label ?? p.status}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
