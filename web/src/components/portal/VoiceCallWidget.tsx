'use client'

import { useFamilyVoiceCall } from '@/hooks/useFamilyVoiceCall'

const STATUS_LABEL: Record<string, string> = {
  connecting: 'Conectando…',
  active: 'En llamada',
  ending: 'Colgando…',
}

export default function VoiceCallWidget() {
  const { status, transcript, error, startCall, endCall } = useFamilyVoiceCall()
  const busy = status === 'connecting' || status === 'ending'

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">📞</span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Llamada de voz en vivo</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Habla directo con el asistente sobre tus hijos, pagos o asistencia</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-80 min-h-[6rem] px-4 py-3 space-y-3">
        {transcript.length === 0 && status === 'idle' && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
            Toca &quot;Llamar&quot; y permite el uso del micrófono para empezar a hablar con el asistente.
          </p>
        )}
        {transcript.length === 0 && status === 'connecting' && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Conectando la llamada…</p>
        )}

        {transcript.map((turn, i) => (
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
      </div>

      {status === 'active' && (
        <p className="mx-4 mb-1 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400 animate-pulse" aria-hidden="true" />
          En llamada — habla con naturalidad
        </p>
      )}

      {error && (
        <div role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 p-3">
        {status === 'idle' || status === 'error' ? (
          <button
            type="button"
            onClick={startCall}
            className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 text-sm transition shadow-glow"
          >
            📞 Llamar al asistente
          </button>
        ) : (
          <button
            type="button"
            onClick={endCall}
            disabled={busy}
            className="w-full rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 text-sm transition disabled:opacity-60"
          >
            {status === 'active' ? 'Terminar llamada' : STATUS_LABEL[status] ?? 'Colgando…'}
          </button>
        )}
      </div>
    </div>
  )
}
