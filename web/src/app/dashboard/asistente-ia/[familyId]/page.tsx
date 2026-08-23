import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect, notFound } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Conversación — Asistente de IA — MentorIApp',
}

const channelLabels: Record<string, string> = {
  widget: '💬 Chat / nota de voz', voice: '📞 Llamada en vivo',
}

export default async function AsistenteIAFamiliaPage({ params }: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'asistente_ia')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: family } = await supabase
    .from('families')
    .select('id, name')
    .eq('id', familyId)
    .eq('school_id', schoolId)
    .single()
  if (!family) notFound()

  const { data: rows, error: rowsError } = await supabase
    .from('ai_conversations')
    .select('id, role, content, channel, created_at')
    .eq('family_id', familyId)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true })

  type Turn = { id: string; role: 'user' | 'assistant'; content: string; channel: string; created_at: string }
  const turns = (rows ?? []) as Turn[]

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'la conversación', error: rowsError }]} />

      <div>
        <Link href="/dashboard/asistente-ia" className="text-xs font-semibold transition" style={{ color: 'var(--dash-text-faint)' }}>
          ← Asistente de IA
        </Link>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight mt-2">{family.name}</h1>
        <p className="text-sm text-slate-500 mt-1">{turns.length} mensajes registrados</p>
      </div>

      <div className="dash-card p-5 space-y-3">
        {turns.length > 0 ? (
          turns.map((t, i) => {
            const prevChannel = i > 0 ? turns[i - 1].channel : null
            return (
              <div key={t.id}>
                {t.channel !== prevChannel && (
                  <p className="text-[10px] uppercase tracking-wider mt-4 mb-1.5 first:mt-0" style={{ color: 'var(--dash-text-faint)' }}>
                    {channelLabels[t.channel] ?? t.channel}
                  </p>
                )}
                <div className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%]">
                    <div
                      className="rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap"
                      style={t.role === 'user'
                        ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)', borderBottomRightRadius: '0.125rem' }
                        : { background: 'rgba(255,255,255,.06)', color: 'var(--dash-text-muted)', borderBottomLeftRadius: '0.125rem' }}
                    >
                      {t.content}
                    </div>
                    <p className="text-[10px] mt-1 px-1" style={{ color: 'var(--dash-text-faint)' }}>{formatDate(t.created_at)}</p>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-center py-6" style={{ color: 'var(--dash-text-faint)' }}>Sin conversaciones registradas.</p>
        )}
      </div>
    </div>
  )
}
