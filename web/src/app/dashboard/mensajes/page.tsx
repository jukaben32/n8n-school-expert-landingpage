import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import StartConversationForm from './StartConversationForm'
import {
  getStaffAvailableCategories,
  getEligibleFamilyIdsForCategory,
  isMessageCategory,
  MESSAGE_CATEGORY_LABELS,
  type MessageCategory,
} from '@/lib/messaging/categoryAccess'

export const metadata: Metadata = {
  title: 'Mensajes — MentorIApp',
}

export default async function MensajesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'mensajes_directos')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  const availableCategories = await getStaffAvailableCategories(admin, {
    schoolId,
    role: profile.role,
    staffId: profile.staff_id,
  })
  const category: MessageCategory =
    categoria && isMessageCategory(categoria) && availableCategories.includes(categoria)
      ? categoria
      : (availableCategories[0] ?? 'regular')

  const [{ data: conversations, error: conversationsError }, { data: allFamilies }] = await Promise.all([
    supabase
      .from('direct_conversations')
      .select('id, family_id, last_message_at, staff_last_read_at, families(name), direct_messages(sender_type, created_at)')
      .eq('school_id', schoolId)
      .eq('category', category)
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

  const families = allFamilies ?? []
  const eligibleFamilyIds = await getEligibleFamilyIdsForCategory(admin, {
    schoolId,
    role: profile.role,
    staffId: profile.staff_id,
    category,
    allFamilyIds: families.map((f) => f.id),
  })
  const startableFamilies = families.filter((f) => eligibleFamilyIds.has(f.id) && !rows.some((r) => r.family_id === f.id))

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las conversaciones', error: conversationsError }]} />

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Mensajes
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Conversación privada de dos vías con cada familia — distinto de los comunicados (avisos a todos).
        </p>
      </div>

      {availableCategories.length > 1 && (
        <div className="flex gap-1.5">
          {availableCategories.map((c) => (
            <Link
              key={c}
              href={`/dashboard/mensajes?categoria=${c}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                category === c
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {MESSAGE_CATEGORY_LABELS[c]}
            </Link>
          ))}
        </div>
      )}

      <StartConversationForm families={startableFamilies} category={category} />

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((c) => {
            const unread = c.direct_messages.filter(
              (m) => m.sender_type === 'guardian' && (!c.staff_last_read_at || m.created_at > c.staff_last_read_at)
            ).length
            return (
              <Link
                key={c.id}
                href={`/dashboard/mensajes/${c.family_id}/${category}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{c.families?.name ?? 'Familia'}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Último mensaje: {formatDate(c.last_message_at)}</p>
                </div>
                {unread > 0 && (
                  <span className="shrink-0 rounded-full bg-coral text-white text-xs font-bold min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
                    {unread}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">💬</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ninguna familia te ha escrito todavía.</p>
        </div>
      )}
    </div>
  )
}
