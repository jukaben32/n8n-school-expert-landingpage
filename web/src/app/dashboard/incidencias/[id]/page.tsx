import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { canRecordIncidentFollowUp } from '@/lib/incidents/followUpAccess'
import { SEVERITIES, LOCATIONS, MEASURES, STATUSES, labelOf } from '@/lib/incidents/labels'
import PrintButton from '../../politicas/PrintButton'
import FollowUpForm from './FollowUpForm'

export const metadata: Metadata = {
  title: 'Incidencia — MentorIApp',
}

export default async function IncidenciaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  const role = profile?.role ?? ''
  if (!profile || !canAccess(role, 'incidencias')) redirect('/dashboard')
  const isManager = await canRecordIncidentFollowUp(supabase, role, profile.school_id)

  // Cliente de sesión: si la RLS no le deja ver este caso, es un 404.
  const { data: inc } = await supabase
    .from('student_incidents')
    .select('*, students(first_name, last_name)')
    .eq('id', id)
    .maybeSingle()
  if (!inc) notFound()

  let reviewerName: string | null = null
  if (inc.reviewed_by) {
    const { data: reviewer } = await createAdminClient()
      .from('users_profiles')
      .select('staff:staff_id(first_name, last_name)')
      .eq('id', inc.reviewed_by)
      .maybeSingle()
    const st = reviewer?.staff as unknown as { first_name: string; last_name: string } | null
    reviewerName = st ? `${st.first_name} ${st.last_name}` : 'Dirección'
  }

  const student = inc.students as { first_name: string; last_name: string } | null
  const studentName = student ? `${student.first_name} ${student.last_name}` : 'Estudiante'
  const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('es-DO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Santo_Domingo' })
  const measures = (inc.measures as string[] | null) ?? []
  const row = (label: string, value: string) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-text-faint)' }}>{label}</p>
      <p className="text-sm" style={{ color: 'var(--dash-text)' }}>{value}</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard/incidencias" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>
          ← Incidencias
        </Link>
        <PrintButton />
      </div>

      <div className="dash-card p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-accent-light)' }}>
            Registro de Incidencia y Seguimiento Conductual
          </p>
          <h1 className="text-xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{studentName}</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {row('Curso', inc.grade_level ?? '—')}
          {row('Fecha y hora', `${formatDate(inc.incident_date)}${inc.incident_time ? ` · ${String(inc.incident_time).slice(0, 5)}` : ''}`)}
          {row('Lugar', inc.location === 'otro' && inc.location_other ? `Otro: ${inc.location_other}` : labelOf(LOCATIONS, inc.location))}
          {row('Reportado por', inc.reporter_name)}
          {row('Clasificación', labelOf(SEVERITIES, inc.severity))}
          {row('Estudiante escuchado', inc.student_heard ? 'Sí, dio su versión' : 'No consta')}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-text-faint)' }}>Descripción de los hechos</p>
          <p className="text-sm whitespace-pre-wrap mt-1" style={{ color: 'var(--dash-text)' }}>{inc.description}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-text-faint)' }}>Medida educativa aplicada</p>
          {measures.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Ninguna marcada.</p>
          ) : (
            <ul className="text-sm list-disc pl-5 mt-1" style={{ color: 'var(--dash-text)' }}>
              {measures.map((m) => <li key={m}>{labelOf(MEASURES, m)}</li>)}
            </ul>
          )}
        </div>
      </div>

      <div className="dash-card p-6 space-y-3">
        <h2 className="text-lg font-bold font-barlow" style={{ color: 'var(--dash-text)' }}>Orientación / Gestión</h2>
        <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
          Estado: <strong>{labelOf(STATUSES, inc.status)}</strong>
          {inc.reviewed_at && ` · actualizado por ${reviewerName ?? 'Dirección'} el ${formatDateTime(inc.reviewed_at)}`}
        </p>
        {isManager ? (
          <FollowUpForm incidentId={inc.id} status={inc.status} notes={inc.follow_up_notes ?? ''} />
        ) : inc.follow_up_notes ? (
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--dash-text)' }}>{inc.follow_up_notes}</p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía sin notas de seguimiento.</p>
        )}
        {isManager && inc.follow_up_notes && (
          <p className="hidden print:block text-sm whitespace-pre-wrap">{inc.follow_up_notes}</p>
        )}
      </div>

      {/* Solo al imprimir: líneas de firma, por si el caso necesita constancia en papel. */}
      <div className="hidden print:grid grid-cols-3 gap-6 pt-12 text-center text-xs">
        <div><div className="border-t border-slate-400 pt-1">Estudiante<br />&quot;He sido escuchado&quot;</div></div>
        <div><div className="border-t border-slate-400 pt-1">Docente / Reportante</div></div>
        <div><div className="border-t border-slate-400 pt-1">Orientación / Gestión<br />Recibido / Seguimiento</div></div>
      </div>
    </div>
  )
}
