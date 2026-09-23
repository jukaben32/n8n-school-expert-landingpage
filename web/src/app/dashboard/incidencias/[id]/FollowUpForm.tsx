'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateIncidentFollowUpAction } from '../actions'
import { STATUSES } from '@/lib/incidents/labels'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'

export default function FollowUpForm({ incidentId, status, notes }: { incidentId: string; status: string; notes: string }) {
  const router = useRouter()
  const [newStatus, setNewStatus] = useState(status)
  const [newNotes, setNewNotes] = useState(notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const result = await updateIncidentFollowUpAction({ incidentId, status: newStatus, notes: newNotes })
      if (!result.ok) {
        setError(result.error ?? 'No se pudo guardar.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Recarga la página e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap gap-3">
        {STATUSES.map((s) => (
          <label key={s.value} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
            <input type="radio" name="status" value={s.value} checked={newStatus === s.value} onChange={() => setNewStatus(s.value)} />
            {s.label}
          </label>
        ))}
      </div>
      <textarea
        value={newNotes}
        onChange={(e) => setNewNotes(e.target.value)}
        rows={4}
        placeholder="Notas de seguimiento de Orientación / Gestión (acuerdos con la familia, plan de seguimiento...)"
        className={inputClass}
      />
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-600 dark:text-green-400">Seguimiento guardado.</p>}
      <button type="button" disabled={saving} onClick={handleSave} className="dash-btn-primary text-sm px-5 py-2.5 disabled:opacity-60">
        {saving ? 'Guardando...' : 'Guardar seguimiento'}
      </button>
    </div>
  )
}
