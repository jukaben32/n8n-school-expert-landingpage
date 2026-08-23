import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'
import PrintButton from '@/app/dashboard/notas/boletin/[studentId]/PrintButton'
import SendReminderButton from './SendReminderButton'

export const metadata: Metadata = {
  title: 'Autorización — MentorIApp',
}

type StudentRow = { id: string; first_name: string; last_name: string; family_id: string }
type ResponseRow = { student_id: string; decision: string; signer_full_name: string; responded_at: string }

export default async function AutorizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'autorizaciones')) {
    redirect('/dashboard')
  }

  const schoolId = (await getActiveSchool(profile.role, profile.school_id)).schoolId
  const admin = createAdminClient()

  const { data: request } = await admin
    .from('authorization_requests')
    .select('id, title, description, event_date, grade_level, created_at')
    .eq('id', id)
    .eq('school_id', schoolId)
    .single()
  if (!request) notFound()

  const { data: school } = await admin.from('schools').select('name').eq('id', schoolId).single()

  const studentsQuery = admin
    .from('students')
    .select('id, first_name, last_name, family_id')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('last_name')
  const { data: studentsRaw } = request.grade_level ? await studentsQuery.eq('grade_level', request.grade_level) : await studentsQuery
  const students = (studentsRaw ?? []) as StudentRow[]

  const { data: responsesRaw } = await admin
    .from('authorization_responses')
    .select('student_id, decision, signer_full_name, responded_at')
    .eq('authorization_request_id', id)
  const responses = (responsesRaw ?? []) as ResponseRow[]
  const responseByStudent = new Map(responses.map((r) => [r.student_id, r]))

  const pendingCount = students.filter((s) => !responseByStudent.has(s.id)).length
  const formatDateTime = (d: string) => new Date(d).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-3xl mx-auto space-y-6 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard/autorizaciones" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
          ← Autorizaciones
        </Link>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <SendReminderButton authorizationRequestId={id} pendingCount={pendingCount} />}
          <PrintButton />
        </div>
      </div>

      <div className="border-b print:border-slate-900 pb-4 space-y-1" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest print:text-slate-900" style={{ color: 'var(--dash-accent-light)' }}>{school?.name ?? 'Colegio'}</p>
        <h1 className="text-2xl font-bold font-barlow print:text-slate-900" style={{ color: 'var(--dash-text)' }}>{request.title}</h1>
        <p className="text-sm print:text-slate-700" style={{ color: 'var(--dash-text-muted)' }}>
          {request.grade_level ?? 'Todo el colegio'}
          {request.event_date && ` · ${new Date(`${request.event_date}T00:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}`}
        </p>
        <p className="text-sm print:text-slate-900 whitespace-pre-wrap pt-2" style={{ color: 'var(--dash-text-muted)' }}>{request.description}</p>
      </div>

      <div className="dash-card print:border-slate-900 overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="print:bg-transparent">
            <tr className="border-b print:border-slate-900" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <th className="px-3 py-2.5 font-barlow uppercase tracking-wide text-xs print:text-slate-900" style={{ color: 'var(--dash-text-muted)' }}>Estudiante</th>
              <th className="px-3 py-2.5 font-barlow uppercase tracking-wide text-xs print:text-slate-900" style={{ color: 'var(--dash-text-muted)' }}>Estado</th>
              <th className="px-3 py-2.5 font-barlow uppercase tracking-wide text-xs print:text-slate-900" style={{ color: 'var(--dash-text-muted)' }}>Firmado por</th>
              <th className="px-3 py-2.5 font-barlow uppercase tracking-wide text-xs print:text-slate-900" style={{ color: 'var(--dash-text-muted)' }}>Fecha/hora</th>
            </tr>
          </thead>
          <tbody className="divide-y print:divide-slate-300" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
            {students.map((s) => {
              const r = responseByStudent.get(s.id)
              return (
                <tr key={s.id}>
                  <td className="px-3 py-2.5 font-medium print:text-slate-900" style={{ color: 'var(--dash-text)' }}>{s.last_name}, {s.first_name}</td>
                  <td className="px-3 py-2.5">
                    {!r ? (
                      <span className="font-semibold" style={{ color: 'var(--dash-warning)' }}>Pendiente</span>
                    ) : r.decision === 'autorizado' ? (
                      <span className="font-semibold" style={{ color: 'var(--dash-accent)' }}>✓ Autorizado</span>
                    ) : (
                      <span className="font-semibold" style={{ color: 'var(--dash-danger-strong)' }}>✗ No autorizado</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 print:text-slate-900" style={{ color: 'var(--dash-text-muted)' }}>{r?.signer_full_name ?? '—'}</td>
                  <td className="px-3 py-2.5 print:text-slate-700" style={{ color: 'var(--dash-text-faint)' }}>{r ? formatDateTime(r.responded_at) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {students.length === 0 && (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>No hay estudiantes en el grupo dirigido.</p>
        </div>
      )}
    </div>
  )
}
