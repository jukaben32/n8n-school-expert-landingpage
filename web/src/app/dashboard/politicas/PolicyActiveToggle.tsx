'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStaffPolicyActiveAction } from './actions'

export default function PolicyActiveToggle({ policyId, isActive }: { policyId: string; isActive: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    const msg = isActive
      ? '¿Retirar esta política? Ya no se podrá firmar; las firmas existentes se conservan.'
      : '¿Volver a poner vigente esta política?'
    if (!window.confirm(msg)) return
    setError(null)
    setSaving(true)
    try {
      const result = await setStaffPolicyActiveAction(policyId, !isActive)
      if (!result.ok) {
        setError(result.error ?? 'No se pudo actualizar.')
        return
      }
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Recarga la página e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        disabled={saving}
        onClick={handleClick}
        className="rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-60"
      >
        {saving ? 'Guardando...' : isActive ? 'Retirar política' : 'Volver a poner vigente'}
      </button>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}
