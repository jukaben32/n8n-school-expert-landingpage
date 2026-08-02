'use client'

import { useState } from 'react'
import { inviteGuardianAccess } from './actions'

export default function GrantGuardianAccessButton({ guardianId, hasEmail }: { guardianId: string; hasEmail: boolean }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleInvite() {
    setStatus('sending')
    const result = await inviteGuardianAccess(guardianId)
    setStatus(result.ok ? 'sent' : 'error')
    setMessage(result.message)
  }

  if (status === 'sent') {
    return <p className="text-[10px] font-semibold text-green-600 dark:text-green-400">✓ Invitado</p>
  }

  if (!hasEmail) {
    return <p className="text-[10px] text-slate-400 dark:text-slate-500">Sin correo</p>
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleInvite}
        disabled={status === 'sending'}
        className="text-[10px] font-semibold text-primary dark:text-accent-light hover:underline disabled:opacity-50"
      >
        {status === 'sending' ? 'Enviando...' : 'Dar acceso al sistema'}
      </button>
      {status === 'error' && <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{message}</p>}
    </div>
  )
}
