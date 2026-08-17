'use client'

import { useEffect, useRef, useState } from 'react'
import type { WhatsAppConnectionRow } from '@/lib/whatsapp/connection'
import {
  connectWhatsappAction,
  disconnectWhatsappAction,
  refreshWhatsappStatusAction,
  toggleWhatsappEnabledAction,
  updateWhatsappPhoneNumberAction,
} from './actions'

const statusLabels: Record<string, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  error: 'Con error',
}

const statusColors: Record<string, string> = {
  disconnected: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  connecting: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  connected: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
}

export default function WhatsAppManager({ initialConnection }: { initialConnection: WhatsAppConnectionRow | null }) {
  const [connection, setConnection] = useState(initialConnection)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [phoneInput, setPhoneInput] = useState(initialConnection?.phone_number ?? '')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function startPolling() {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const result = await refreshWhatsappStatusAction()
      if (result.ok && result.connection) {
        setConnection(result.connection)
        if (result.connection.status === 'connected') {
          setQrCode(null)
          stopPolling()
        }
      }
    }, 4000)
  }

  async function handleConnect() {
    setError(null)
    setNotConfigured(false)
    setLoading(true)
    try {
      const result = await connectWhatsappAction()
      if (!result.ok) {
        if (result.notConfigured) setNotConfigured(true)
        setError(result.error ?? 'No se pudo conectar WhatsApp')
        return
      }
      setConnection(result.connection ?? null)
      setQrCode(result.qrCode ?? null)
      startPolling()
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setError(null)
    try {
      const result = await disconnectWhatsappAction()
      if (!result.ok) {
        setError(result.error ?? 'No se pudo desconectar')
        return
      }
      setConnection(null)
      setQrCode(null)
      stopPolling()
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleEnabled(isEnabled: boolean) {
    const result = await toggleWhatsappEnabledAction(isEnabled)
    if (result.ok && result.connection) setConnection(result.connection)
  }

  async function handleSavePhone() {
    setSavingPhone(true)
    setPhoneSaved(false)
    try {
      const result = await updateWhatsappPhoneNumberAction(phoneInput)
      if (result.ok && result.connection) {
        setConnection(result.connection)
        setPhoneSaved(true)
      } else if (!result.ok) {
        setError(result.error ?? 'No se pudo guardar el número')
      }
    } finally {
      setSavingPhone(false)
    }
  }

  if (notConfigured) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-center space-y-3">
        <p className="text-lg font-black text-slate-900 dark:text-white">WhatsApp necesita Evolution API</p>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
          Falta configurar <code>EVOLUTION_API_URL</code> y <code>EVOLUTION_API_KEY</code> en el servidor — apuntando
          al mismo VPS de Evolution API que usa el proyecto de referencia. En cuanto estén, este botón conecta el
          número directo.
        </p>
        <button
          type="button"
          onClick={() => setNotConfigured(false)}
          className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2 text-sm transition"
        >
          Entendido
        </button>
      </div>
    )
  }

  if (!connection) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">💬</span>
          <p className="text-lg font-black text-slate-900 dark:text-white">Conecta el WhatsApp del colegio</p>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColors.disconnected}`}>
            {statusLabels.disconnected}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Al conectar, el mismo asistente de IA del Portal Familiar (los mismos datos, las mismas reglas) empieza a
          responder también por WhatsApp — sin duplicar configuración.
        </p>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleConnect}
          disabled={loading}
          className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 text-sm transition shadow-glow disabled:opacity-60"
        >
          {loading ? 'Conectando…' : '📱 Conectar WhatsApp'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg" aria-hidden="true">💬</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-black text-slate-900 dark:text-white">WhatsApp</p>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[connection.status] ?? statusColors.disconnected}`}>
                {statusLabels[connection.status] ?? statusLabels.disconnected}
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {connection.phone_number ??
                (connection.status === 'connecting' ? 'Escanea el código QR para terminar de vincular' : 'Número aún no sincronizado')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={loading}
          className="rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold px-4 py-2 text-sm transition disabled:opacity-60"
        >
          Desconectar
        </button>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
          <input
            type="checkbox"
            checked={connection.is_enabled}
            onChange={(e) => void handleToggleEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Responder automáticamente por WhatsApp</span>
        </label>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-2">
          <label htmlFor="whatsapp-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Número de WhatsApp del colegio
          </label>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Confirma el número que usaste para escanear el código (Evolution API no lo sincroniza solo). Con código
            de país, sin espacios ni símbolos — ej. 18095551234. Habilita el botón flotante de WhatsApp en el sitio
            público y el Portal Familiar.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="whatsapp-phone"
              value={phoneInput}
              onChange={(e) => { setPhoneInput(e.target.value); setPhoneSaved(false) }}
              placeholder="18095551234"
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleSavePhone}
              disabled={savingPhone}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 shrink-0"
            >
              {savingPhone ? 'Guardando…' : 'Guardar número'}
            </button>
          </div>
          {phoneSaved && <p className="text-xs text-green-600 dark:text-green-400">✓ Número guardado.</p>}
        </div>

        {connection.status === 'connecting' && qrCode ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-5 text-center">
            <p className="font-black text-slate-900 dark:text-white">Escanea el código QR</p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Abre WhatsApp en el celular del colegio → Dispositivos vinculados → escanea este código.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="Código QR de WhatsApp"
              className="mx-auto mt-4 h-56 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-3"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              WhatsApp queda enlazado al mismo asistente del Portal Familiar — usa las mismas reglas de datos por
              familia y el mismo límite de preguntas por día.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
