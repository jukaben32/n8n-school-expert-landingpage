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
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Leads</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {leads.length} solicitud{leads.length !== 1 ? 'es' : ''} de demo · {newCount} nueva{newCount !== 1 ? 's' : ''}
        </p>
      </div>

      {leads.length > 0 ? (
        <div className="grid gap-3">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white">{lead.school_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lead.contact_name}{lead.role_title ? ` · ${lead.role_title}` : ''} · {lead.email}{lead.phone ? ` · ${lead.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(lead.created_at)}</span>
                  <LeadStatusSelect leadId={lead.id} initialStatus={lead.status} />
                </div>
              </div>

              {(lead.interest || lead.student_count || lead.message) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {lead.student_count && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-600 dark:text-slate-300">{lead.student_count} estudiantes</span>}
                  {lead.interest && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-600 dark:text-slate-300">{lead.interest}</span>}
                  {lead.message && <p className="w-full text-slate-500 dark:text-slate-400 mt-1">{lead.message}</p>}
                </div>
              )}

              {lead.converted_school_id ? (
                <p className="mt-3 text-xs font-semibold text-green-600 dark:text-green-400">✓ Convertido a colegio activo</p>
              ) : (
                <Link
                  href={`/dashboard/plataforma/nuevo?school_name=${encodeURIComponent(lead.school_name)}&lead_id=${lead.id}`}
                  className="inline-block mt-3 text-xs font-semibold text-primary dark:text-accent-light hover:underline"
                >
                  → Convertir en colegio
                </Link>
              )}

              <LeadNotes leadId={lead.id} notes={notesByLead.get(lead.id) ?? []} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📭</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Aún no hay solicitudes de demo.</p>
        </div>
      )}
    </div>
  )
}
