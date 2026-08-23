import type { Metadata } from 'next'
import Link from 'next/link'
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

  // ── Alerta de Uso de Imagen (Ley 136-03) ────────────────────────────────
  // Busca la autorización marcada como "de imagen" más reciente, y arma un
  // mapa de qué estudiantes NO tienen luz verde (explícitamente no
  // autorizado, o todavía sin responder -- por seguridad se trata igual
  // que "no autorizado" hasta que el tutor conteste). Ver AGENTS.md.
  const { data: imageConsentRequest } = await supabase
    .from('authorization_requests')
    .select('id, title')
    .eq('school_id', schoolId)
    .eq('is_image_consent', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const restrictedStudents: Record<string, 'no_autorizado' | 'pendiente'> = {}
  if (imageConsentRequest) {
    const { data: responsesRaw } = await supabase
      .from('authorization_responses')
      .select('student_id, decision')
      .eq('authorization_request_id', imageConsentRequest.id)
    const decisionByStudent = new Map((responsesRaw ?? []).map((r) => [r.student_id as string, r.decision as string]))
    for (const s of students ?? []) {
      const decision = decisionByStudent.get(s.id)
      if (decision === 'no_autorizado') restrictedStudents[s.id] = 'no_autorizado'
      else if (!decision) restrictedStudents[s.id] = 'pendiente'
    }
  }

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
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Actualizaciones
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Fotos cortas del día a día para un estudiante o un grado/sección — las familias las ven en su Portal Familiar.
        </p>
      </div>

      {!imageConsentRequest && canAccess(profile.role, 'autorizaciones_nuevo') && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          ⚠️ Todavía no has creado la <strong>autorización de Uso de Imagen</strong> (Ley 136-03) —
          {' '}<Link href="/dashboard/autorizaciones/nuevo" className="underline underline-offset-2 font-semibold hover:no-underline">créala aquí</Link>
          {' '}para que esta página avise automáticamente cuándo un estudiante no puede ser fotografiado de frente.
        </div>
      )}

      <PostUpdateForm
        students={(students ?? []).map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
        gradeLevelOptions={gradeLevelOptions}
        studentsByGrade={Object.fromEntries(
          gradeLevelOptions.map((g) => [
            g,
            (students ?? []).filter((s) => s.grade_level === g).map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` })),
          ])
        )}
        restrictedStudents={restrictedStudents}
      />

      {updates.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {updates.map((u) => (
            <UpdateCard key={u.id} {...u} />
          ))}
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📸</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no hay actualizaciones publicadas.</p>
        </div>
      )}
    </div>
  )
}
