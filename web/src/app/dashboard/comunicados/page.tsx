import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MessageCard from '@/components/comunicados/MessageCard'

export const metadata: Metadata = {
  title: 'Comunicados — SchoolOS',
  description: 'Comunicados del colegio con trazabilidad de lectura.',
}

/**
 * Página de Comunicados — Para padres y staff.
 * Los padres ven los comunicados publicados.
 * El staff puede ver todos (borradores incluidos).
 * La "Lectura confirmada" se registra al entrar a la página.
 */
export default async function ComunicadosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Perfil del usuario
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  const isStaff = ['director', 'school_admin', 'teacher', 'reception', 'finance', 'super_admin']
    .includes(profile?.role ?? '')

  // Obtener comunicados del colegio
  const query = supabase
    .from('messages')
    .select(`
      id, title, body, priority, published_at, created_at,
      author:users_profiles!author_id(id),
      reads:message_reads(user_id)
    `)
    .eq('school_id', profile?.school_id ?? '')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })

  // Los guardians solo ven publicados
  if (!isStaff) query.not('published_at', 'is', null)

  const { data: messages } = await query

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Comunicados
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isStaff ? 'Gestiona los comunicados del colegio' : 'Avisos y novedades del colegio'}
          </p>
        </div>

        {/* Botón nuevo comunicado (solo staff) */}
        {isStaff && (
          <a
            id="btn-nuevo-comunicado"
            href="/dashboard/comunicados/nuevo"
            className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo
          </a>
        )}
      </div>

      {/* Lista de comunicados */}
      {messages && messages.length > 0 ? (
        <div className="space-y-3">
          {messages.map((msg) => {
            // ¿Ya lo leyó este usuario?
            const reads = (msg.reads as unknown) as { user_id: string }[] | null
            const isRead = reads?.some((r) => r.user_id === profile?.id) ?? false
            return (
              <MessageCard
                key={msg.id}
                id={msg.id}
                title={msg.title}
                body={msg.body}
                priority={msg.priority as 'normal' | 'urgent'}
                publishedAt={msg.published_at}
                isRead={isRead}
                isStaff={isStaff}
                currentUserId={profile?.id ?? ''}
              />
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📬</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No hay comunicados publicados aún.
          </p>
        </div>
      )}
    </div>
  )
}
