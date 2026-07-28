'use client'

import { useEffect, useRef, useState } from 'react'
import { getFamilyChatHistory, sendFamilyChatMessage } from '@/app/dashboard/portal-familiar/actions'

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export default function FamilyChatWidget() {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getFamilyChatHistory().then((history) => {
      if (!cancelled) setTurns(history)
      setLoadingHistory(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, sending])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const message = input.trim()
    if (!message || sending) return

    setError(null)
    setInput('')
    setSending(true)
    setTurns((prev) => [...prev, { role: 'user', content: message }])

    const result = await sendFamilyChatMessage(message)

    if (result.ok && result.reply) {
      setTurns((prev) => [...prev, { role: 'assistant', content: result.reply as string }])
    } else {
      setError(result.error ?? 'No se pudo enviar el mensaje.')
    }
    setSending(false)
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">💬</span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Asistente familiar</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Pregunta sobre tus hijos, pagos o asistencia</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-80 min-h-[10rem] px-4 py-3 space-y-3">
        {loadingHistory && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Cargando conversación…</p>
        )}

        {!loadingHistory && turns.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
            Pregúntame, por ejemplo: &quot;¿Cómo va la asistencia de mi hijo esta semana?&quot; o &quot;¿Tengo facturas pendientes?&quot;
          </p>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                turn.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm'
              }`}
            >
              {turn.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
              Escribiendo…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-slate-100 dark:border-slate-800 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={sending}
          className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2 text-sm transition shadow-glow disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
