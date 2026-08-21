'use client'

import { useState } from 'react'
import { sendReminderAction } from '../actions'

export default function SendReminderButton({ authorizationRequestId, pendingCount }: { authorizationRequestId: string; pendingCount: number }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!confirm(`¿Mandar recordatorio por correo a los tutores de los ${pendingCount} estudiantes pendientes?`)) return
    setSending(true)
    setError(null)
    const result = await sendReminderAction(authorizationRequestId)
    setSending(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo enviar el recordatorio.')
      return
    }
    setSent(result.sent ?? 0)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-full border border-primary/30 text-primary dark:text-accent-light dark:border-accent/30 text-sm font-semibold px-4 py-2 transition hover:bg-primary/5 dark:hover:bg-accent/10 disabled:opacity-60"
      >
        {sending ? 'Enviando...' : `✉️ Recordar a pendientes (${pendingCount})`}
      </button>
      {sent !== null && <span className="text-xs text-green-600 dark:text-green-400">Enviado a {sent}</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  )
}
