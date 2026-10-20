'use client'

import { useState } from 'react'
import { resendStaffInvitation } from './actions'

export default function ResendInvitationButton({ staffId, email }: { staffId: string; email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleResend() {
    if (!window.confirm(`¿Enviar el enlace de acceso a ${email}?`)) return
    setStatus('sending')
    try {
      const result = await resendStaffInvitation(staffId)
      setStatus(result.ok ? 'sent' : 'error')
      setMessage(result.message)
    } catch {
      setStatus('error')
      setMessage('No se pudo enviar. Recarga la página e intenta de nuevo (no se guardó nada a medias).')
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleResend}
        disabled={status === 'sending'}
        className="text-xs text-dash-text-muted hover:text-dash-accent hover:underline disabled:opacity-50 text-left"
      >
        {status === 'sending' ? 'Enviando...' : 'Reenviar invitación'}
      </button>
      {status === 'sent' && <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ {message}</span>}
      {status === 'error' && <span className="text-xs text-red-600 dark:text-red-400">{message}</span>}
    </span>
  )
}
