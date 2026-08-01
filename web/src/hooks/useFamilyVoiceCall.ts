'use client'

import { useCallback, useRef, useState } from 'react'
import { startFamilyVoiceCallSession, logFamilyVoiceCall } from '@/app/dashboard/portal-familiar/actions'
import type { VoiceCallTurn } from '@/lib/ai/logVoiceCallTranscript'

// Cliente WebRTC de la Realtime API de OpenAI. La sesión se arma en el
// servidor (startFamilyVoiceCallSession, que nunca expone OPENAI_API_KEY),
// y el navegador solo recibe un client_secret efímero para negociar el
// audio directo con OpenAI -- mismo patrón que ya se usó y verificó en
// EstateCall (proyecto hermano), incluyendo el endpoint GA correcto:
// /v1/realtime/calls (la API beta en /v1/realtime está retirada).
const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

export type VoiceCallStatus = 'idle' | 'connecting' | 'active' | 'ending' | 'error'

interface TranscriptEntry extends VoiceCallTurn {
  final: boolean
}

export function useFamilyVoiceCall() {
  const [status, setStatus] = useState<VoiceCallStatus>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transcriptRef = useRef<TranscriptEntry[]>([])

  const appendTranscript = useCallback((entry: TranscriptEntry) => {
    transcriptRef.current = [...transcriptRef.current, entry]
    setTranscript(transcriptRef.current)
  }, [])

  const startCall = useCallback(async () => {
    try {
      setError(null)
      setStatus('connecting')
      transcriptRef.current = []
      setTranscript([])

      const session = await startFamilyVoiceCallSession()
      if (!session.ok || !session.clientSecret || !session.model) {
        throw new Error(session.error ?? 'No se pudo iniciar la llamada.')
      }

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioRef.current = audioEl
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0]
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = micStream
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream))

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'response.audio_transcript.done') {
          appendTranscript({ role: 'assistant', content: msg.transcript, final: true })
        }
        if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          appendTranscript({ role: 'user', content: msg.transcript, final: true })
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch(REALTIME_CALLS_URL, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      })
      if (!sdpResponse.ok) throw new Error('No se pudo negociar el audio con OpenAI.')

      const answer = { type: 'answer' as const, sdp: await sdpResponse.text() }
      await pc.setRemoteDescription(answer)

      setStatus('active')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la llamada.')
      setStatus('error')
    }
  }, [appendTranscript])

  const endCall = useCallback(() => {
    setStatus('ending')
    dcRef.current?.close()
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioRef.current?.remove()
    pcRef.current = null
    dcRef.current = null
    streamRef.current = null

    const turns = transcriptRef.current.map(({ role, content }) => ({ role, content }))
    if (turns.length > 0) {
      void logFamilyVoiceCall(turns)
    }

    setStatus('idle')
  }, [])

  return { status, transcript, error, startCall, endCall }
}
