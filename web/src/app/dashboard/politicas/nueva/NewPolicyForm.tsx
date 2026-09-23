'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createStaffPolicyAction } from '../actions'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

export default function NewPolicyForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await createStaffPolicyAction({ title, body })
      if (!result.ok || !result.id) {
        setError(result.error ?? 'No se pudo publicar la política.')
        return
      }
      router.push(`/dashboard/politicas/${result.id}`)
    } catch {
      setError('No se pudo conectar con el servidor. Copia tu texto, recarga la página y vuelve a intentarlo (no se guardó nada).')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dash-card p-6 space-y-4">
      <div>
        <label className={labelClass}>Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Texto completo de la política</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={20} className={inputClass} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="dash-btn-primary w-full text-sm py-2.5 disabled:opacity-60"
      >
        {saving ? 'Publicando...' : 'Publicar política'}
      </button>
    </form>
  )
}
