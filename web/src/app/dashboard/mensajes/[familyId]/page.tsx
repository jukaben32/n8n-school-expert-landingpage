import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect, notFound } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import ThreadView from './ThreadView'

export const metadata: Metadata = {
  title: 'Mensajes — MentorIApp',
}

export default async function ConversationPage({ params }: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'mensajes_directos')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: family } = await supabase
    .from('families')
    .select('id, name')
    .eq('id', familyId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!family) notFound()

  // Cliente admin: la conversación puede no existir todavía (primera vez
  // que este staff le escribe a esta familia) -- no hace falta crearla
  // aquí, sendStaffMessageAction la crea al enviar el primer mensaje.
  const admin = createAdminClient()
  const { data: conversation } = await admin
    .from('direct_conversations')
    .select('id')
    .eq('school_id', schoolId)
    .eq('family_id', familyId)
    .maybeSingle()

  const { data: messages } = conversation
    ? await admin
        .from('direct_messages')
        .select('id, sender_type, body, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  // Marca la conversación como leída directo aquí (no vía Server Action):
  // llamar revalidatePath() durante el render de una página no es válido en
  // Next.js -- esta página ya muestra datos frescos, no necesita invalidar
  // caché de /dashboard/mensajes para sí misma.
  if (conversation) {
    await admin
      .from('direct_conversations')
      .update({ staff_last_read_at: new Date().toISOString() })
      .eq('id', conversation.id)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/dashboard/mensajes" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
        ← Mensajes
      </Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">{family.name}</h1>
        <p className="text-sm text-slate-500 mt-1">Conversación privada — solo visible para el colegio y esta familia.</p>
      </div>

      <ThreadView familyId={familyId} initialMessages={messages ?? []} />
    </div>
  )
}
