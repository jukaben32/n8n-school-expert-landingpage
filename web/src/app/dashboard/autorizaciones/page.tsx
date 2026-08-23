import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import RespondAuthorizationForm from './RespondAuthorizationForm'

export const metadata: Metadata = {
  title: 'Autorizaciones — MentorIApp',
  description: 'Permisos que requieren autorización firmada de un tutor (excursiones, etc.)',
}

type AuthRequest = { id: string; title: string; description: string; event_date: string | null; grade_level: string | null; created_at: string }

export default async function AutorizacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, guardian_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const role = profile?.role ?? ''
  const isStaff = canAccess(role, 'autorizaciones')

  if (!isStaff && role !== 'guardian') {
    redirect('/dashboard')
  }

  const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Vista de familia: por cada hijo, qué autorizaciones le aplican ──────
  if (!isStaff && role === 'guardian') {
    const admin = createAdminClient()
    const { data: myProfile } = await supabase.from('users_profiles').select('guardian_id').eq('auth_id', user.id).single()
    const { data: myStudentsRaw } = await supabase
      .from('students')
      .select('id, first_name, last_name, grade_level, student_guardians!inner(guardian_id)')
      .eq('student_guardians.guardian_id', myProfile?.guardian_id ?? '')
      .is('deleted_at', null)
    type MyStudent = { id: string; first_name: string; last_name: string; grade_level: string | null }
    const myStudents = (myStudentsRaw ?? []) as unknown as MyStudent[]

    if (myStudents.length === 0) {
      return (
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Autorizaciones</h1>
          <div className="dash-card border-dashed p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>No hay estudiantes vinculados a tu cuenta.</p>
          </div>
        </div>
      )
    }

    const grades = Array.from(new Set(myStudents.map((s) => s.grade_level).filter((g): g is string => !!g)))
    const { data: requestsRaw } = await admin
      .from('authorization_requests')
      .select('id, title, description, event_date, grade_level, created_at')
      .eq('school_id', profile!.school_id)
      .or(grades.length > 0 ? `grade_level.is.null,grade_level.in.(${grades.map((g) => `"${g}"`).join(',')})` : 'grade_level.is.null')
      .order('created_at', { ascending: false })
    const requests = (requestsRaw ?? []) as AuthRequest[]

    const studentIds = myStudents.map((s) => s.id)
    const { data: responsesRaw } = await admin
      .from('authorization_responses')
      .select('authorization_request_id, student_id, decision, signer_full_name')
      .in('student_id', studentIds)
    type Response = { authorization_request_id: string; student_id: string; decision: string; signer_full_name: string }
    const responses = (responsesRaw ?? []) as Response[]
    const responseFor = (reqId: string, studentId: string) => responses.find((r) => r.authorization_request_id === reqId && r.student_id === studentId)

    // Solo los pares (autorización, estudiante) donde de verdad aplica -- el
    // grado del estudiante coincide, o la autorización es para todo el colegio.
    const relevantPairs = requests.flatMap((r) =>
      myStudents.filter((s) => !r.grade_level || r.grade_level === s.grade_level).map((s) => ({ request: r, student: s }))
    )

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Autorizaciones</h1>
          <p className="text-sm text-slate-500 mt-1">Permisos que requieren tu autorización.</p>
        </div>

        {relevantPairs.length === 0 ? (
          <div className="dash-card border-dashed p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">✅</p>
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>No hay autorizaciones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {relevantPairs.map(({ request, student }) => {
              const existing = responseFor(request.id, student.id)
              return (
                <div key={`${request.id}-${student.id}`} className="dash-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-accent-light)' }}>
                    {student.first_name} {student.last_name}
                    {request.event_date && ` · ${formatDate(request.event_date)}`}
                  </p>
                  <p className="font-semibold mt-1" style={{ color: 'var(--dash-text)' }}>{request.title}</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: 'var(--dash-text-muted)' }}>{request.description}</p>

                  {existing ? (
                    <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
                      existing.decision === 'autorizado'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    }`}>
                      {existing.decision === 'autorizado' ? '✓ Autorizado' : '✗ No autorizado'} — firmado por {existing.signer_full_name}
                    </div>
                  ) : (
                    <RespondAuthorizationForm authorizationRequestId={request.id} studentId={student.id} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Vista de staff: todas las autorizaciones del colegio, con conteo ────
  const schoolId = (await getActiveSchool(role, profile?.school_id ?? '')).schoolId
  const admin = createAdminClient()
  const canCreate = canAccess(role, 'autorizaciones_nuevo')

  const { data: requestsRaw, error: requestsError } = await supabase
    .from('authorization_requests')
    .select('id, title, description, event_date, grade_level, created_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  const requests = (requestsRaw ?? []) as AuthRequest[]

  const counts = await Promise.all(
    requests.map(async (r) => {
      const studentsQuery = admin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).is('deleted_at', null)
      const { count: total } = r.grade_level ? await studentsQuery.eq('grade_level', r.grade_level) : await studentsQuery
      const { data: decisions } = await admin.from('authorization_responses').select('decision').eq('authorization_request_id', r.id)
      const autorizados = (decisions ?? []).filter((d) => d.decision === 'autorizado').length
      const noAutorizados = (decisions ?? []).filter((d) => d.decision === 'no_autorizado').length
      return { id: r.id, total: total ?? 0, autorizados, noAutorizados, pendientes: Math.max((total ?? 0) - autorizados - noAutorizados, 0) }
    })
  )
  const countsById = new Map(counts.map((c) => [c.id, c]))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Autorizaciones</h1>
          <p className="text-sm text-slate-500 mt-1">Permisos firmados por los tutores (excursiones, etc.)</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/autorizaciones/nuevo" className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
            + Nueva
          </Link>
        )}
      </div>

      {requestsError && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {requestsError.message}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📝</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no hay autorizaciones creadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const c = countsById.get(r.id)
            return (
              <Link
                key={r.id}
                href={`/dashboard/autorizaciones/${r.id}`}
                className="dash-card block p-5 transition"
              >
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-accent-light)' }}>
                  {r.grade_level ?? 'Todo el colegio'}{r.event_date && ` · ${formatDate(r.event_date)}`}
                </p>
                <p className="font-semibold mt-1" style={{ color: 'var(--dash-text)' }}>{r.title}</p>
                {c && (
                  <div className="flex gap-3 mt-2 text-xs font-semibold">
                    <span style={{ color: 'var(--dash-accent)' }}>{c.autorizados} autorizados</span>
                    <span style={{ color: 'var(--dash-warning)' }}>{c.pendientes} pendientes</span>
                    {c.noAutorizados > 0 && <span style={{ color: 'var(--dash-danger-strong)' }}>{c.noAutorizados} no autorizados</span>}
                    <span style={{ color: 'var(--dash-text-faint)' }}>de {c.total}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
