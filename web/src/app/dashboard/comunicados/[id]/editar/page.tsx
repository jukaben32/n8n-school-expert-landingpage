import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'
import { getStaffAvailableCategories, type MessageCategory } from '@/lib/messaging/categoryAccess'
import MessageForm from '@/components/comunicados/MessageForm'

const IMAGE_BUCKET = 'comunicados-imagenes'
const SIGNED_URL_TTL = 3600

export const metadata: Metadata = {
  title: 'Editar borrador — MentorIApp',
}

/**
 * Retoma un borrador guardado desde Comunicados para terminar de
 * escribirlo y publicarlo -- antes esto no existía: "Guardar borrador"
 * creaba el comunicado, pero no había ninguna pantalla para volver a
 * abrirlo (ver AGENTS.md, 2026-09-23).
 */
export default async function EditarComunicadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId
  if (!profile || !canAccess(profile.role, 'comunicados_nuevo')) {
    redirect('/dashboard/comunicados')
  }

  const admin = createAdminClient()

  // Se busca acotado a school_id: un comunicado de otro colegio da el mismo
  // notFound() que uno inexistente -- no revela si existe o no.
  const { data: message } = await admin
    .from('messages')
    .select('id, title, body, priority, category, audience_type, audience_label, published_at, image_path')
    .eq('id', id)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!message) notFound()

  const { data: studentsWithGrade } = await supabase
    .from('students')
    .select('grade_level')
    .eq('school_id', schoolId)
    .eq('enrollment_status', 'inscrito')
    .not('grade_level', 'is', null)
    .is('deleted_at', null)

  const gradeLevelOptions = Array.from(
    new Set((studentsWithGrade ?? []).map((s) => s.grade_level as string).filter(Boolean))
  ).sort()

  const availableCategories = await getStaffAvailableCategories(admin, {
    schoolId,
    role: profile.role,
    staffId: profile.staff_id,
  })

  let imageUrl: string | null = null
  if (message.image_path) {
    const { data: signed } = await admin.storage.from(IMAGE_BUCKET).createSignedUrl(message.image_path, SIGNED_URL_TTL)
    imageUrl = signed?.signedUrl ?? null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Editar borrador
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Termina de redactar el comunicado y publícalo cuando esté listo.
        </p>
      </div>

      {message.published_at ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Este comunicado ya fue publicado, así que no se puede editar.
          </p>
          <a href="/dashboard/comunicados" className="text-sm font-semibold text-primary hover:underline">
            Volver a Comunicados
          </a>
        </div>
      ) : (
        <MessageForm
          mode="edit"
          messageId={message.id}
          gradeLevelOptions={gradeLevelOptions}
          forceGradeMode={profile.role === 'teacher'}
          availableCategories={availableCategories}
          initialValues={{
            title: message.title,
            body: message.body ?? '',
            priority: message.priority as 'normal' | 'urgent',
            category: message.category as MessageCategory,
            audienceMode: message.audience_type === 'family' ? 'grades' : 'all',
            selectedGrades: message.audience_label
              ? (message.audience_label as string).split(',').map((g: string) => g.trim()).filter(Boolean)
              : [],
            imageUrl,
          }}
        />
      )}
    </div>
  )
}
