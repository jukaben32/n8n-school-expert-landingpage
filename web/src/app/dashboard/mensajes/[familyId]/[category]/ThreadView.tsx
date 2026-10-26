'use client'

import { useEffect, useRef, useState } from 'react'
import { sendStaffMessageAction } from '../../actions'
import DraftAssistant from '@/components/dashboard/DraftAssistant'
import type { MessageCategory } from '@/lib/messaging/categoryAccess'

interface Message {
  id: string
  sender_type: 'guardian' | 'staff'
  body: string
  created_at: string
  author?: string | null
}

// Fecha y hora originales del mensaje, siempre en hora de RD.
function formatSentAt(iso: string) {
  return new Date(iso).toLocaleString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ThreadView({
  familyId,
  category,
  initialMessages,
  showAuthors = false,
  viewerName = null,
}: {
  familyId: string
  category: MessageCategory
  initialMessages: Message[]
  showAuthors?: boolean
  viewerName?: string | null
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Auto-crece con el texto (hasta un máximo) para que el borrador se vea
  // completo, igual que el cuadro de "versión sugerida" de arriba.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  async function sendMessage() {
    const body = input.trim()
    if (!body || sending) return

    setError(null)
    setInput('')
    setSending(true)
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, sender_type: 'staff', body, created_at: new Date().toISOString(), author: showAuthors ? viewerName ?? 'Personal del colegio' : null }])

    const result = await sendStaffMessageAction(familyId, category, body)
    setSending(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo enviar el mensaje.')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage()
  }

  // Enter envía, Shift+Enter agrega un salto de línea -- convención
  // estándar de chat, necesaria ahora que el cuadro es multilínea.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div ref={scrollRef} className="max-h-[28rem] overflow-y-auto px-4 py-4 space-y-2.5">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
            Todavía no hay mensajes. Escribe el primero abajo.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender_type === 'staff' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.sender_type === 'staff'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                }`}
              >
                {m.body}
              </div>
              <p className="mt-0.5 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                {m.author ? <span className="font-semibold">{m.author} · </span> : null}
                {formatSentAt(m.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      {error && <p role="alert" className="px-4 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {input.trim() && (
        <div className="px-4 pt-2">
          <DraftAssistant draft={input} context="mensaje_directo" onApply={setInput} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-slate-100 dark:border-slate-800 p-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu respuesta… (Enter para enviar, Shift+Enter para salto de línea)"
          disabled={sending}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 max-h-40 overflow-y-auto"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2 text-sm transition disabled:opacity-60"
        >
          {sending ? '…' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
