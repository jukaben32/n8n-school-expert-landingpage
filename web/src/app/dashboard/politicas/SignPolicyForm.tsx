'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordInput from '@/components/PasswordInput'
import { signStaffPolicyAction } from './actions'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

export default function SignPolicyForm({
  policyId,
  defaultFullName,
  defaultPosition,
}: {
  policyId: string
  defaultFullName: string
  defaultPosition: string
}) {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [fullName, setFullName] = useState(defaultFullName)
  const [nationalId, setNationalId] = useState('')
  const [position, setPosition] = useState(defaultPosition)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSign() {
    setError(null)
    setSaving(true)
    try {
      const result = await signStaffPolicyAction({ policyId, fullName, nationalId, position, password })
      if (!result.ok) {
        setError(result.error ?? 'No se pudo registrar tu firma.')
        return
      }
      router.refresh()
    } catch {
      // Sesión vencida o un despliegue nuevo mientras la página estaba abierta.
      setError('No se pudo conectar con el servidor. Recarga la página y vuelve a firmar (no se guardó nada).')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50 print:hidden">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Compromiso de aceptación y firma</p>
      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
        <span>He leído, comprendido y acepto en todas sus partes los lineamientos de esta política, y me comprometo a velar por su cumplimiento.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Nombre completo (firma)</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Cédula de identidad y electoral</label>
          <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="000-0000000-0" inputMode="numeric" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Cargo / puesto</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Tu contraseña (para confirmar que eres tú)</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={saving || !accepted}
        onClick={handleSign}
        className="w-full rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold py-2.5 transition disabled:opacity-60"
      >
        {saving ? 'Firmando...' : 'Firmar política'}
      </button>
    </div>
  )
}
