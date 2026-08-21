'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { respondAuthorizationAction } from './actions'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

export default function RespondAuthorizationForm({ authorizationRequestId, studentId }: { authorizationRequestId: string; studentId: string }) {
  const router = useRouter()
  const [decision, setDecision] = useState<'autorizado' | 'no_autorizado' | null>(null)
  const [signerFullName, setSignerFullName] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!decision) return
    setError(null)
    setSaving(true)
    const result = await respondAuthorizationAction({ authorizationRequestId, studentId, decision, signerFullName, password })
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo registrar tu respuesta.')
      return
    }
    router.refresh()
  }

  if (!decision) {
    return (
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setDecision('autorizado')}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2.5 transition"
        >
          ✓ Autorizo
        </button>
        <button
          type="button"
          onClick={() => setDecision('no_autorizado')}
          className="flex-1 rounded-full border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-semibold py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          ✗ No autorizo
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Vas a confirmar: <span className={decision === 'autorizado' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {decision === 'autorizado' ? 'Autorizo' : 'No autorizo'}
        </span>
      </p>
      <div>
        <label className={labelClass}>Escribe tu nombre completo (firma)</label>
        <input value={signerFullName} onChange={(e) => setSignerFullName(e.target.value)} placeholder="Nombre y apellido" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Tu contraseña (para confirmar que eres tú)</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </div>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleConfirm}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2.5 transition disabled:opacity-60"
        >
          {saving ? 'Confirmando...' : 'Confirmar firma'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setDecision(null)}
          className="rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-semibold px-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
