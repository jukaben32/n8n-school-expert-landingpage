import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect, notFound } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import { staffCanAccessFamilyCategory, isMessageCategory, MESSAGE_CATEGORY_LABELS } from '@/lib/messaging/categoryAccess'
import ThreadView from './ThreadView'

export const metadata: Metadata = {
  title: 'Mensajes — MentorIApp',
}

export default async function ConversationPage({ params }: { params: Promise<{ familyId: string; category: string }> }) {
  const { familyId, category: categoryParam } = await params
  if (!isMessageCategory(categoryParam)) notFound()
  const category = categoryParam

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'mensajes_directos')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const admin = createAdminClient()

  // La lista (mensajes/page.tsx) ya filtra por RLS, pero esta página entra
  // por URL directa -- hay que revalidar acá que este staff puede ver
  // esta familia en esta categoría antes de tocar el cliente admin (que
  // se salta RLS). Mismo motivo que en mensajes/actions.ts. Va de primero
  // para que quien no tenga permiso ni siquiera llegue a leer la ficha.
  const allowed = await staffCanAccessFamilyCategory(admin, {
    schoolId,
    role: profile.role,
    staffId: profile.staff_id,
    familyId,
    category,
  })
  if (!allowed) redirect('/dashboard/mensajes')

  // La familia se lee con el cliente de servicio y no con el del usuario:
  // la RLS de `families` no incluye al profesor, así que esta pantalla le
  // respondía "no encontrado" aunque sí tuviera permiso sobre la
  // conversación -- mismo motivo que en mensajes/page.tsx. El permiso ya
  // quedó validado arriba.
  const { data: family } = await admin
    .from('families')
    .select('id, name')
    .eq('id', familyId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!family) notFound()

  // La conversación puede no existir todavía (primera vez que este staff
  // le escribe a esta familia en esta categoría) -- no hace falta crearla
  // aquí, sendStaffMessageAction la crea al enviar el primer mensaje.
  const { data: conversation } = await admin
    .from('direct_conversations')
    .select('id')
    .eq('school_id', schoolId)
    .eq('family_id', familyId)
    .eq('category', category)
    .maybeSingle()

  const { data: messages } = conversation
    ? await admin
        .from('direct_messages')
        .select('id, sender_type, body, created_at, sender_profile_id')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  // Solo dirección ve quién escribió cada mensaje del colegio (para dar
  // seguimiento a la calidad de las respuestas). Los nombres se resuelven con
  // el cliente de servicio porque `staff` no es legible para todos los roles;
  // el permiso sobre la conversación ya quedó validado arriba.
  const showAuthors = ['super_admin', 'school_admin', 'director'].includes(profile.role)
  const authorNames = new Map<string, string>()
  if (showAuthors) {
    const profileIds = [
      ...new Set(
        (messages ?? [])
          .filter((m) => m.sender_type === 'staff' && m.sender_profile_id)
          .map((m) => m.sender_profile_id as string),
      ),
    ]
    if (profileIds.length > 0) {
      const { data: senders } = await admin
        .from('users_profiles')
        .select('id, staff:staff_id(first_name, last_name)')
        .in('id', profileIds)
      for (const s of senders ?? []) {
        const staff = Array.isArray(s.staff) ? s.staff[0] : s.staff
        if (staff) authorNames.set(s.id, `${staff.first_name} ${staff.last_name}`.trim())
      }
    }
  }
  const threadMessages = (messages ?? []).map((m) => ({
    id: m.id,
    sender_type: m.sender_type as 'guardian' | 'staff',
    body: m.body,
    created_at: m.created_at,
    author:
      showAuthors && m.sender_type === 'staff'
        ? (m.sender_profile_id ? authorNames.get(m.sender_profile_id) ?? 'Personal del colegio' : 'Personal del colegio')
        : null,
  }))

  let viewerName: string | null = null
  if (showAuthors && profile.staff_id) {
    const { data: me } = await admin.from('staff').select('first_name, last_name').eq('id', profile.staff_id).maybeSingle()
    if (me) viewerName = `${me.first_name} ${me.last_name}`.trim()
  }

  // Marca la conversación como leída con un update directo, sin pasar por
  // markStaffReadAction: esa Server Action llama revalidatePath('/dashboard/mensajes'),
  // y Next.js no permite invocar revalidatePath durante el render de una
  // página (bug real -- rompía esta pantalla con "Algo salió mal" cada vez
  // que se abría una conversación existente). El permiso ya se validó
  // arriba (`allowed`), así que el update es seguro sin repetir esa
  // comprobación.
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
        <p className="text-sm text-slate-500 mt-1">
          {MESSAGE_CATEGORY_LABELS[category]} — conversación privada, solo visible para el colegio y esta familia.
        </p>
      </div>

      <ThreadView familyId={familyId} category={category} initialMessages={threadMessages} showAuthors={showAuthors} viewerName={viewerName} />
    </div>
  )
}
