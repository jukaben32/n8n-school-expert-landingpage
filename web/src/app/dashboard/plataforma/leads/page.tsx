import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadStatusSelect from './LeadStatusSelect'
import LeadNotes from './LeadNotes'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Leads — Plataforma — MentorIApp',
}

type Lead = {
  id: string
  school_name: string
  contact_name: string
  role_title: string | null
  email: string
  phone: string | null
  student_count: string | null
  interest: string | null
  message: string | null
  status: 'nuevo' | 'contactado' | 'descartado' | 'convertido'
  converted_school_id: string | null
  created_at: string
}

type Note = { id: string; lead_id: string; note: string; created_at: string }

/**
 * Leads — Solo para super_admin.
 * Solicitudes de demo capturadas desde el formulario de la landing pública,
 * con bitácora de seguimiento y conversión directa a colegio activo.
 */
export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard/secretaria')
  }

  const [{ data: leadsRaw, error: leadsRawError }, { data: notesRaw, error: notesRawError }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, school_name, contact_name, role_title, email, phone, student_count, interest, message, status, converted_school_id, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('lead_notes').select('id, lead_id, note, created_at').order('created_at', { ascending: true }),
  ])

  const leads = (leadsRaw ?? []) as Lead[]
  const notes = (notesRaw ?? []) as Note[]
  const notesByLead = new Map<string, Note[]>()
  for (const n of notes) {
    notesByLead.set(n.lead_id, [...(notesByLead.get(n.lead_id) ?? []), n])
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
  const newCount = leads.filter((l) => l.status === 'nuevo').length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los leads', error: leadsRawError }, { label: 'las notas', error: notesRawError }]} />
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Leads</h1>
        <p className="text-sm text-slate-500 mt-1">
          {leads.length} solicitud{leads.length !== 1 ? 'es' : ''} de demo · {newCount} nueva{newCount !== 1 ? 's' : ''}
        </p>
      </div>

      {leads.length > 0 ? (
        <div className="grid gap-3">
          {leads.map((lead) => (
            <div key={lead.id} className="dash-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>{lead.school_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>
                    {lead.contact_name}{lead.role_title ? ` · ${lead.role_title}` : ''} · {lead.email}{lead.phone ? ` · ${lead.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>{formatDate(lead.created_at)}</span>
                  <LeadStatusSelect leadId={lead.id} initialStatus={lead.status} />
                </div>
              </div>

              {(lead.interest || lead.student_count || lead.message) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {lead.student_count && <span className="dash-chip">{lead.student_count} estudiantes</span>}
                  {lead.interest && <span className="dash-chip">{lead.interest}</span>}
                  {lead.message && <p className="w-full mt-1" style={{ color: 'var(--dash-text-muted)' }}>{lead.message}</p>}
                </div>
              )}

              {lead.converted_school_id ? (
                <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--dash-accent)' }}>✓ Convertido a colegio activo</p>
              ) : (
                <Link
                  href={`/dashboard/plataforma/nuevo?school_name=${encodeURIComponent(lead.school_name)}&lead_id=${lead.id}`}
                  className="inline-block mt-3 text-xs font-semibold hover:underline"
                  style={{ color: 'var(--dash-accent-light)' }}
                >
                  → Convertir en colegio
                </Link>
              )}

              <LeadNotes leadId={lead.id} notes={notesByLead.get(lead.id) ?? []} />
            </div>
          ))}
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📭</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Aún no hay solicitudes de demo.</p>
        </div>
      )}
    </div>
  )
}
