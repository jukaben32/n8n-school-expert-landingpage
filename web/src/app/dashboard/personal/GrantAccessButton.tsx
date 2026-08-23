'use client'

import { useState } from 'react'
import { inviteStaffAccess } from './actions'

const roleOptions = [
  { value: 'director', label: 'Director' },
  { value: 'school_admin', label: 'Administrador de colegio' },
  { value: 'teacher', label: 'Docente' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'reception', label: 'Recepción / Secretaría' },
]

// Puesto (catálogo de Personal, ver roleLabels.ts) -> rol de acceso
// sugerido. La mayoría de los puestos no tienen un rol de acceso propio
// (son más granulares que los 5 roles de login) -- antes esto caía
// siempre en "Docente" por defecto sin avisar, lo cual era incorrecto
// para puestos como Secretaria o Coordinadora. Quien invita siempre puede
// cambiar el rol sugerido en el selector antes de enviar.
const SUGGESTED_LOGIN_ROLE: Record<string, string> = {
  director: 'director',
  coordinator: 'director', // la Coordinadora tiene el mismo acceso que la Directora
  teacher: 'teacher',
  finance: 'finance',
  reception: 'reception',
  secretary: 'reception',
  teaching_secretary: 'reception',
  admin: 'school_admin',
  administrator: 'school_admin',
}

function suggestLoginRole(position: string): string {
  return SUGGESTED_LOGIN_ROLE[position] ?? 'teacher'
}

export default function GrantAccessButton({ staffId, suggestedRole }: { staffId: string; suggestedRole: string }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(suggestLoginRole(suggestedRole))
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleInvite() {
    setStatus('sending')
    const result = await inviteStaffAccess(staffId, role)
    setStatus(result.ok ? 'sent' : 'error')
    setMessage(result.message)
  }

  if (status === 'sent') {
    return <p className="text-xs font-semibold text-green-600 dark:text-green-400">✓ {message}</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-dash-accent hover:underline"
      >
        Dar acceso al sistema
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={status === 'sending'}
        className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {roleOptions.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleInvite}
        disabled={status === 'sending'}
        className="text-xs font-semibold rounded-lg bg-primary text-white px-3 py-1.5 disabled:opacity-50"
      >
        {status === 'sending' ? 'Enviando...' : 'Enviar invitación'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={status === 'sending'}
        className="text-xs text-dash-text-muted hover:text-dash-text"
      >
        Cancelar
      </button>
      {status === 'error' && <p className="w-full text-xs text-red-600 dark:text-red-400">{message}</p>}
    </div>
  )
}
