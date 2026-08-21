'use client'

import { useState } from 'react'
import {
  approveStaffRegistration,
  rejectStaffRegistration,
  type PendingStaffRegistration,
} from './actions'
import { roleLabels, educationLabels } from '@/lib/staff/roleLabels'
import GrantAccessButton from '../GrantAccessButton'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

type EditableFields = Omit<PendingStaffRegistration, 'id' | 'created_at'>

export default function StaffRegistrationsReview({ initial }: { initial: PendingStaffRegistration[] }) {
  const [registrations, setRegistrations] = useState(initial)
  const [drafts, setDrafts] = useState<Record<string, EditableFields>>(
    Object.fromEntries(initial.map((r) => [r.id, toEditable(r)]))
  )
  const [approvedStaffIds, setApprovedStaffIds] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function toEditable(r: PendingStaffRegistration): EditableFields {
    return {
      first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone,
      national_id: r.national_id, desired_role: r.desired_role, specialty: r.specialty,
      education_level: r.education_level, degree_title: r.degree_title, alma_mater: r.alma_mater,
      graduation_year: r.graduation_year, certifications: r.certifications,
    }
  }

  function updateDraft(id: string, patch: Partial<EditableFields>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleApprove(id: string) {
    setError(null)
    setBusyId(id)
    const result = await approveStaffRegistration(id, drafts[id])
    setBusyId(null)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo aprobar.')
      return
    }
    setRegistrations((prev) => prev.filter((r) => r.id !== id))
    if (result.staffId) setApprovedStaffIds((prev) => ({ ...prev, [id]: result.staffId! }))
  }

  async function handleReject(id: string) {
    setError(null)
    setBusyId(id)
    const result = await rejectStaffRegistration(id, rejectReason)
    setBusyId(null)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo rechazar.')
      return
    }
    setRegistrations((prev) => prev.filter((r) => r.id !== id))
    setRejectingId(null)
    setRejectReason('')
  }

  const approvedEntries = Object.entries(approvedStaffIds)

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {approvedEntries.length > 0 && (
        <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            ✓ Aprobados — dale acceso al sistema
          </p>
          {approvedEntries.map(([regId, staffId]) => {
            const draft = drafts[regId]
            return (
              <div key={regId} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5">
                <p className="text-sm text-slate-700 dark:text-slate-200">{draft.first_name} {draft.last_name}</p>
                <GrantAccessButton staffId={staffId} suggestedRole={draft.desired_role} />
              </div>
            )
          })}
        </div>
      )}

      {registrations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📋</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">No hay registros pendientes de revisión.</p>
        </div>
      ) : (
        registrations.map((r) => {
          const draft = drafts[r.id]
          const busy = busyId === r.id
          return (
            <div key={r.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input className={inputClass} value={draft.first_name} onChange={(e) => updateDraft(r.id, { first_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Apellido</label>
                  <input className={inputClass} value={draft.last_name} onChange={(e) => updateDraft(r.id, { last_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Correo</label>
                  <input type="email" className={inputClass} value={draft.email} onChange={(e) => updateDraft(r.id, { email: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Teléfono</label>
                  <input className={inputClass} value={draft.phone ?? ''} onChange={(e) => updateDraft(r.id, { phone: e.target.value || null })} />
                </div>
                <div>
                  <label className={labelClass}>Cédula</label>
                  <input className={inputClass} value={draft.national_id ?? ''} onChange={(e) => updateDraft(r.id, { national_id: e.target.value || null })} />
                </div>
                <div>
                  <label className={labelClass}>Puesto</label>
                  <select className={inputClass} value={draft.desired_role} onChange={(e) => updateDraft(r.id, { desired_role: e.target.value })}>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Materia / curso / área</label>
                  <input className={inputClass} value={draft.specialty ?? ''} onChange={(e) => updateDraft(r.id, { specialty: e.target.value || null })} />
                </div>
                <div>
                  <label className={labelClass}>Nivel académico</label>
                  <select className={inputClass} value={draft.education_level ?? ''} onChange={(e) => updateDraft(r.id, { education_level: e.target.value || null })}>
                    <option value="">Sin especificar</option>
                    {Object.entries(educationLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Año de egreso</label>
                  <input type="number" className={inputClass} value={draft.graduation_year ?? ''} onChange={(e) => updateDraft(r.id, { graduation_year: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Título obtenido</label>
                  <input className={inputClass} value={draft.degree_title ?? ''} onChange={(e) => updateDraft(r.id, { degree_title: e.target.value || null })} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Egresado de</label>
                  <input className={inputClass} value={draft.alma_mater ?? ''} onChange={(e) => updateDraft(r.id, { alma_mater: e.target.value || null })} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Certificaciones</label>
                  <input className={inputClass} value={draft.certifications ?? ''} onChange={(e) => updateDraft(r.id, { certifications: e.target.value || null })} />
                </div>
              </div>

              {rejectingId === r.id ? (
                <div className="flex gap-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => handleReject(r.id)}
                    disabled={busy}
                    className="rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 disabled:opacity-60"
                  >
                    Confirmar rechazo
                  </button>
                  <button type="button" onClick={() => setRejectingId(null)} className="text-xs text-slate-400 px-2">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleApprove(r.id)}
                    disabled={busy}
                    className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2 text-sm transition shadow-glow disabled:opacity-60"
                  >
                    {busy ? 'Aprobando...' : 'Aprobar y crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingId(r.id)}
                    disabled={busy}
                    className="rounded-full border border-slate-200 dark:border-slate-700 px-5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
