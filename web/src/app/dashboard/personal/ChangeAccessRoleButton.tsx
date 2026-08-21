'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeAccessRoleAction } from './actions'

const roleOptions = [
  { value: 'director', label: 'Director' },
  { value: 'school_admin', label: 'Administrador de colegio' },
  { value: 'teacher', label: 'Docente' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'reception', label: 'Recepción' },
]

const roleLabels: Record<string, string> = Object.fromEntries(roleOptions.map((r) => [r.value, r.label]))

export default function ChangeAccessRoleButton({ profileId, currentRole }: { profileId: string; currentRole: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(currentRole)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    setSaving(true)
    const result = await changeAccessRoleAction(profileId, role)
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-accent-light hover:underline"
      >
        Cambiar rol de acceso
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={saving}
        className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {roleOptions.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || role === currentRole}
        className="text-xs font-semibold rounded-lg bg-primary text-white px-3 py-1.5 disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={() => { setEditing(false); setRole(currentRole) }}
        disabled={saving}
        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        Cancelar
      </button>
      {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export { roleLabels as accessRoleLabels }
