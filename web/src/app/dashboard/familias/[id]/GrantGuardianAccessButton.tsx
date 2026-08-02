'use client'

import { useState } from 'react'
import { inviteGuardianAccess } from '../actions'

export default function GrantGuardianAccessButton({ guardianId, hasEmail }: { guardianId: string; hasEmail: boolean }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)

  async function handleInvite() {
    setStatus('sending')
    const result = await inviteGuardianAccess(guardianId)
    setStatus(result.ok ? 'sent' : 'error')
    setMessage(result.message)
    if (result.credentials) setCredentials(result.credentials)
  }

  if (status === 'sent' && credentials) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-right">
        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1">Entrega esto en persona:</p>
        <p className="text-[11px] font-mono text-slate-700 dark:text-slate-200">{credentials.username}</p>
        <p className="text-[11px] font-mono text-slate-700 dark:text-slate-200">{credentials.password}</p>
      </div>
    )
  }

  if (status === 'sent') {
    return <p className="text-[10px] font-semibold text-green-600 dark:text-green-400">✓ Invitado</p>
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleInvite}
        disabled={status === 'sending'}
        className="text-[10px] font-semibold text-primary dark:text-accent-light hover:underline disabled:opacity-50"
      >
        {status === 'sending' ? 'Enviando...' : hasEmail ? 'Dar acceso al sistema' : 'Crear acceso (sin correo)'}
      </button>
      {status === 'error' && <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{message}</p>}
    </div>
  )
}
