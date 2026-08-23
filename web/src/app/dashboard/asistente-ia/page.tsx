import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Asistente de IA — MentorIApp',
}

const channelLabels: Record<string, string> = {
  widget: '💬 Chat / nota de voz', voice: '📞 Llamada en vivo',
}

export default async function AsistenteIAPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'asistente_ia')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: rows, error: rowsError } = await supabase
    .from('ai_conversations')
    .select('family_id, channel, role, created_at, families(name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(500)

  type Row = { family_id: string; channel: string; role: string; created_at: string; families: { name: string } | null }
  const conversations = (rows ?? []) as unknown as Row[]

  const byFamily = new Map<string, { name: string; count: number; lastActivity: string; channels: Set<string> }>()
  for (const c of conversations) {
    if (c.role !== 'user') continue // solo contar preguntas del padre, no las respuestas
    const existing = byFamily.get(c.family_id)
    if (existing) {
      existing.count += 1
      existing.channels.add(c.channel)
    } else {
      byFamily.set(c.family_id, {
        name: c.families?.name ?? 'Familia',
        count: 1,
        lastActivity: c.created_at,
        channels: new Set([c.channel]),
      })
    }
  }
  const families = Array.from(byFamily.entries()).map(([familyId, data]) => ({ familyId, ...data }))

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las conversaciones', error: rowsError }]} />

      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Asistente de IA
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Conversaciones de las familias con el asistente (chat, nota de voz, llamada). Las familias saben que
          esta actividad es visible para el colegio.
        </p>
      </div>

      {families.length > 0 ? (
        <div className="grid gap-3">
          {families.map((f) => (
            <Link
              key={f.familyId}
              href={`/dashboard/asistente-ia/${f.familyId}`}
              className="dash-card p-5 flex items-center justify-between gap-4 transition"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{f.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>
                  Última actividad: {formatDate(f.lastActivity)}
                </p>
                <div className="flex gap-1.5 mt-1.5">
                  {Array.from(f.channels).map((ch) => (
                    <span key={ch} className="dash-chip text-[10px]">
                      {channelLabels[ch] ?? ch}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-center shrink-0">
                <p className="text-lg font-bold font-barlow" style={{ color: 'var(--dash-accent)' }}>{f.count}</p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--dash-text-faint)' }}>Preguntas</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🤖</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Ninguna familia ha usado el asistente todavía.</p>
        </div>
      )}
    </div>
  )
}
