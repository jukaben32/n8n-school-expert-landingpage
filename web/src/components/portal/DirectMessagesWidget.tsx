'use client'

import { useEffect, useRef, useState } from 'react'
import { getFamilyDirectMessages, sendFamilyDirectMessage } from '@/app/dashboard/portal-familiar/actions'

interface Message {
  id: string
  sender_type: 'guardian' | 'staff'
  body: string
  created_at: string
}

/**
 * Mensajería directa con el colegio -- distinta del asistente de IA
 * (FamilyChatWidget): acá responde una persona real (profesor/dirección/
 * recepción), no la IA. Una sola conversación por familia.
 */
export default function DirectMessagesWidget() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getFamilyDirectMessages().then((result) => {
      if (!cancelled && result.ok) setMessages(result.messages ?? [])
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

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
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, sender_type: 'guardian', body, created_at: new Date().toISOString() }])

    const result = await sendFamilyDirectMessage(body)
    setSending(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo enviar el mensaje.')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Mensajes con el colegio</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Escríbele directo al colegio — te responde el personal, no un asistente automático.
        </p>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto px-4 py-3 space-y-2.5">
        {loading ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
            Todavía no has escrito al colegio. Envía tu primer mensaje abajo.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_type === 'guardian' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.sender_type === 'guardian'
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
          placeholder="Escribe tu mensaje…"
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
