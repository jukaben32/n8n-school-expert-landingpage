'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getJobApplicationFileUrl, updateJobApplicationStatus } from './actions'
import { POSITIONS, LEVELS, SCHEDULES, REFERRALS, LICENSE, APPLICATION_STATUSES, labelOf } from '@/lib/jobs/labels'

type Row = Record<string, string>
type Application = {
  id: string
  full_name: string
  national_id: string | null
  birth_date: string | null
  nationality: string | null
  address: string | null
  sector: string | null
  mobile_phone: string
  home_phone: string | null
  email: string | null
  marital_status: string | null
  position: string
  position_other: string | null
  levels: string[]
  specialty: string | null
  schedule: string[]
  emergency_contacts: Row[]
  has_relative_here: boolean
  relative_name: string | null
  relative_relationship: string | null
  relative_area: string | null
  referral_source: string | null
  referral_detail: string | null
  education: Row[]
  teaching_license: string | null
  experience: Row[]
  signer_name: string
  cv_path: string | null
  certificates_path: string | null
  status: string
  review_notes: string | null
  created_at: string
}

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function ApplicationCard({ app }: { app: Application }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(app.status)
  const [notes, setNotes] = useState(app.review_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function openFile(kind: 'cv' | 'certificados') {
    setMessage(null)
    try {
      const r = await getJobApplicationFileUrl(app.id, kind)
      if (!r.ok || !r.url) { setMessage(r.error ?? 'No se pudo abrir el archivo.'); return }
      window.open(r.url, '_blank', 'noopener')
    } catch {
      setMessage('No se pudo conectar con el servidor. Recarga la página.')
    }
  }

  async function save() {
    setMessage(null)
    setSaving(true)
    try {
      const r = await updateJobApplicationStatus(app.id, status, notes)
      setMessage(r.ok ? 'Guardado.' : r.error ?? 'No se pudo guardar.')
      if (r.ok) router.refresh()
    } catch {
      setMessage('No se pudo conectar con el servidor. Recarga la página e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const position = app.position === 'otro' && app.position_other ? `Otro: ${app.position_other}` : labelOf(POSITIONS, app.position)
  const date = new Date(app.created_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santo_Domingo' })

  return (
    <div className="dash-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{app.full_name}</p>
          <p className="text-xs truncate" style={{ color: 'var(--dash-text-muted)' }}>
            {position}{app.levels.length ? ` · ${app.levels.map((l) => labelOf(LEVELS, l)).join(', ')}` : ''} · {date}
          </p>
        </div>
        <span className="text-xs font-semibold shrink-0" style={{ color: app.status === 'nueva' ? 'var(--dash-warning)' : 'var(--dash-text-faint)' }}>
          {labelOf(APPLICATION_STATUSES, app.status)}
        </span>
      </button>

      {open && (
        <div className="border-t px-4 pb-5 pt-4 space-y-5" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cédula" value={app.national_id} />
            <Field label="Fecha de nacimiento" value={app.birth_date} />
            <Field label="Nacionalidad" value={app.nationality} />
            <Field label="Estado civil" value={app.marital_status} />
            <Field label="Teléfono móvil" value={app.mobile_phone} />
            <Field label="Teléfono residencial" value={app.home_phone} />
            <Field label="Correo" value={app.email} />
            <Field label="Dirección" value={[app.address, app.sector].filter(Boolean).join(' — ')} />
            <Field label="Especialidad" value={app.specialty} />
            <Field label="Disponibilidad" value={app.schedule.map((s) => labelOf(SCHEDULES, s)).join(', ')} />
            <Field label="Licencia / habilitación docente" value={labelOf(LICENSE, app.teaching_license)} />
            <Field
              label="Cómo nos conoció"
              value={app.referral_source ? `${labelOf(REFERRALS, app.referral_source)}${app.referral_detail ? `: ${app.referral_detail}` : ''}` : null}
            />
          </div>

          {app.has_relative_here && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              Tiene un familiar o pareja trabajando aquí: {[app.relative_name, app.relative_relationship, app.relative_area].filter(Boolean).join(' · ') || 'sin detalles'}
            </div>
          )}

          {app.education.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Formación académica</p>
              {app.education.map((e, i) => (
                <p key={i} className="text-sm text-slate-800 dark:text-slate-100">
                  {e.level}: {[e.title, e.institution, e.year].filter(Boolean).join(' · ')}
                </p>
              ))}
            </div>
          )}

          {app.experience.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Experiencia laboral</p>
              {app.experience.map((x, i) => (
                <p key={i} className="text-sm text-slate-800 dark:text-slate-100">
                  {[x.institution, x.role, [x.from, x.to].filter(Boolean).join(' a '), x.exitReason && `Salida: ${x.exitReason}`, x.referencePhone && `Ref.: ${x.referencePhone}`].filter(Boolean).join(' · ')}
                </p>
              ))}
            </div>
          )}

          {app.emergency_contacts.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Contactos de emergencia</p>
              {app.emergency_contacts.map((c, i) => (
                <p key={i} className="text-sm text-slate-800 dark:text-slate-100">
                  {[c.name, c.relationship, c.phone, c.occupation].filter(Boolean).join(' · ')}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {app.cv_path && (
              <button type="button" onClick={() => openFile('cv')} className="rounded-full border border-slate-200 dark:border-slate-700 text-sm font-semibold px-4 py-2">
                📄 Ver CV
              </button>
            )}
            {app.certificates_path && (
              <button type="button" onClick={() => openFile('certificados')} className="rounded-full border border-slate-200 dark:border-slate-700 text-sm font-semibold px-4 py-2">
                🎓 Ver certificaciones
              </button>
            )}
            {!app.cv_path && !app.certificates_path && <p className="text-xs text-slate-500">No adjuntó archivos.</p>}
          </div>
          <p className="text-xs text-slate-500">Firmó la declaración jurada como: {app.signer_name}</p>

          <div className="space-y-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas internas (entrevista, referencias verificadas...)" className={inputClass} />
            <button type="button" disabled={saving} onClick={save} className="dash-btn-primary text-sm px-5 py-2 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {message && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
        </div>
      )}
    </div>
  )
}

export default function JobApplicationsReview({ applications }: { applications: Application[] }) {
  const [filter, setFilter] = useState('pendientes')
  const visible = applications.filter((a) =>
    filter === 'todas' ? true : filter === 'pendientes' ? !['descartada', 'contratada'].includes(a.status) : a.status === filter,
  )

  if (applications.length === 0) {
    return (
      <div className="dash-card border-dashed p-12 text-center">
        <p className="text-4xl mb-3" aria-hidden="true">📨</p>
        <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Todavía no ha llegado ninguna solicitud.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} max-w-xs`}>
        <option value="pendientes">Pendientes (sin descartar ni contratar)</option>
        <option value="todas">Todas</option>
        {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>{visible.length} de {applications.length}</p>
      {visible.map((a) => <ApplicationCard key={a.id} app={a} />)}
    </div>
  )
}
