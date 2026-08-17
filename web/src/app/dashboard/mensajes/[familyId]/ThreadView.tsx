'use client'

import { useEffect, useRef, useState } from 'react'
import { sendStaffMessageAction } from '../actions'

interface Message {
  id: string
  sender_type: 'guardian' | 'staff'
  body: string
  created_at: string
}

export default function ThreadView({ familyId, initialMessages }: { familyId: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = input.trim()
    if (!body || sending) return

    setError(null)
    setInput('')
    setSending(true)
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, sender_type: 'staff', body, created_at: new Date().toISOString() }])

    const result = await sendStaffMessageAction(familyId, body)
    setSending(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo enviar el mensaje.')
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
            <div key={m.id} className={`flex ${m.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.sender_type === 'staff'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                }`}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
      </div>

      {error && <p role="alert" className="px-4 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu respuesta…"
          disabled={sending}
          className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
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
