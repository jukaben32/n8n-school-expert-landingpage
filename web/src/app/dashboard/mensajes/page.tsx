import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import StartConversationForm from './StartConversationForm'

export const metadata: Metadata = {
  title: 'Mensajes — MentorIApp',
}

export default async function MensajesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'mensajes_directos')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const [{ data: conversations, error: conversationsError }, { data: allFamilies }] = await Promise.all([
    supabase
      .from('direct_conversations')
      .select('id, family_id, last_message_at, staff_last_read_at, families(name), direct_messages(sender_type, created_at)')
      .eq('school_id', schoolId)
      .order('last_message_at', { ascending: false }),
    supabase.from('families').select('id, name').eq('school_id', schoolId).is('deleted_at', null).order('name'),
  ])

  type ConversationRow = {
    id: string
    family_id: string
    last_message_at: string
    staff_last_read_at: string | null
    families: { name: string } | null
    direct_messages: { sender_type: string; created_at: string }[]
  }
  const rows = (conversations ?? []) as unknown as ConversationRow[]

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las conversaciones', error: conversationsError }]} />

      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Mensajes
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Conversación privada de dos vías con cada familia — distinto de los comunicados (avisos a todos).
        </p>
      </div>

      <StartConversationForm families={(allFamilies ?? []).filter((f) => !rows.some((r) => r.family_id === f.id))} />

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((c) => {
            const unread = c.direct_messages.filter(
              (m) => m.sender_type === 'guardian' && (!c.staff_last_read_at || m.created_at > c.staff_last_read_at)
            ).length
            return (
              <Link
                key={c.id}
                href={`/dashboard/mensajes/${c.family_id}`}
                className="dash-card p-4 flex items-center justify-between gap-3 transition"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{c.families?.name ?? 'Familia'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>Último mensaje: {formatDate(c.last_message_at)}</p>
                </div>
                {unread > 0 && (
                  <span className="shrink-0 rounded-full text-white text-xs font-bold min-w-[22px] h-[22px] flex items-center justify-center px-1.5" style={{ background: 'var(--dash-notify)' }}>
                    {unread}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">💬</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Ninguna familia te ha escrito todavía.</p>
        </div>
      )}
    </div>
  )
}
