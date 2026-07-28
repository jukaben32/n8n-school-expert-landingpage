'use client'

import { useEffect, useRef, useState } from 'react'
import { getFamilyChatHistory, sendFamilyChatMessage, sendFamilyVoiceMessage } from '@/app/dashboard/portal-familiar/actions'

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

type VoiceStatus = 'idle' | 'recording' | 'transcribing'

// Tope de duración de grabación: la transcripción se cobra por duración,
// no por mensaje, así que además del límite de 30 mensajes/día que ya
// aplica answerFamilyQuestion(), esto acota el costo por grabación.
const MAX_RECORDING_MS = 60_000
const MIN_RECORDING_BYTES = 2000

export default function FamilyChatWidget() {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const busy = sending || voiceStatus !== 'idle'

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
  }, [turns, sending, voiceStatus])

  // Si el componente se desmonta a medio grabar, no dejar el micrófono
  // encendido ni el temporizador de auto-stop corriendo.
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const message = input.trim()
    if (!message || busy) return

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

  async function startRecording() {
    if (busy) return
    setError(null)

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Tu navegador no soporta grabación de audio.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.')
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    chunksRef.current = []
    streamRef.current = stream
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
      }
      void handleRecordedAudio(recorder.mimeType || 'audio/webm')
    }

    recorder.start()
    setVoiceStatus('recording')
    stopTimerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, MAX_RECORDING_MS)
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  async function handleRecordedAudio(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType })
    chunksRef.current = []

    if (blob.size < MIN_RECORDING_BYTES) {
      setVoiceStatus('idle')
      setError('La grabación fue demasiado corta. Intenta de nuevo.')
      return
    }

    setVoiceStatus('transcribing')
    const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
    const formData = new FormData()
    formData.append('audio', blob, `nota-de-voz.${extension}`)

    const result = await sendFamilyVoiceMessage(formData)

    if (result.transcript) {
      setTurns((prev) => [...prev, { role: 'user', content: result.transcript as string }])
    }
    if (result.ok && result.reply) {
      setTurns((prev) => [...prev, { role: 'assistant', content: result.reply as string }])
    } else if (!result.ok) {
      setError(result.error ?? 'No se pudo procesar la nota de voz.')
    }

    setVoiceStatus('idle')
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
            Pregúntame, por ejemplo: &quot;¿Cómo va la asistencia de mi hijo esta semana?&quot; o &quot;¿Tengo facturas pendientes?&quot; — puedes escribir o usar el micrófono.
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

        {(sending || voiceStatus === 'transcribing') && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
              {voiceStatus === 'transcribing' ? 'Transcribiendo…' : 'Escribiendo…'}
            </div>
          </div>
        )}
      </div>

      {voiceStatus === 'recording' && (
        <p className="mx-4 mb-1 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400 animate-pulse" aria-hidden="true" />
          Grabando… toca el micrófono para enviar
        </p>
      )}

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
          disabled={busy}
          className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
        />
        <button
          type="button"
          onClick={voiceStatus === 'recording' ? stopRecording : startRecording}
          disabled={sending || voiceStatus === 'transcribing'}
          aria-pressed={voiceStatus === 'recording'}
          aria-label={voiceStatus === 'recording' ? 'Detener grabación' : 'Grabar nota de voz'}
          title={voiceStatus === 'recording' ? 'Detener grabación' : 'Grabar nota de voz'}
          className={`shrink-0 rounded-full w-10 h-10 flex items-center justify-center text-base transition disabled:opacity-60 ${
            voiceStatus === 'recording'
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {voiceStatus === 'recording' ? '⏹️' : '🎤'}
        </button>
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2 text-sm transition shadow-glow disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
