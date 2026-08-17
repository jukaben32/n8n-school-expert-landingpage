import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import PostUpdateForm from './PostUpdateForm'
import UpdateCard from './UpdateCard'

export const metadata: Metadata = {
  title: 'Actualizaciones — MentorIApp',
}

const SIGNED_URL_TTL = 3600
const BUCKET = 'class-updates'

export default async function ActualizacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'actualizaciones')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const [{ data: students }, { data: updatesRaw, error: updatesError }] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name, grade_level')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('first_name'),
    supabase
      .from('class_updates')
      .select('id, caption, photo_path, student_id, grade_level, created_at, students(first_name, last_name)')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const gradeLevelOptions = Array.from(new Set((students ?? []).map((s) => s.grade_level).filter((g): g is string => !!g))).sort()

  type UpdateRow = {
    id: string
    caption: string | null
    photo_path: string
    student_id: string | null
    grade_level: string | null
    created_at: string
    students: { first_name: string; last_name: string } | null
  }
  const rows = (updatesRaw ?? []) as unknown as UpdateRow[]

  const admin = createAdminClient()
  const updates = await Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(r.photo_path, SIGNED_URL_TTL)
      return {
        id: r.id,
        caption: r.caption,
        photoUrl: signed?.signedUrl ?? null,
        targetLabel: r.students ? `${r.students.first_name} ${r.students.last_name}` : (r.grade_level ?? 'Colegio'),
        createdAt: r.created_at,
      }
    })
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las actualizaciones', error: updatesError }]} />

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Actualizaciones
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Fotos cortas del día a día para un estudiante o un grado/sección — las familias las ven en su Portal Familiar.
        </p>
      </div>

      <PostUpdateForm
        students={(students ?? []).map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
        gradeLevelOptions={gradeLevelOptions}
      />

      {updates.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {updates.map((u) => (
            <UpdateCard key={u.id} {...u} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📸</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Todavía no hay actualizaciones publicadas.</p>
        </div>
      )}
    </div>
  )
}
