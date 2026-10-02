'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { requestFamilyAccessCode, verifyFamilyAccessCode, verifyFamilyAccessCodeByPhone } from './actions'

export default function FamilyPhoneAccessForm({ initialManualMode = false }: { initialManualMode?: boolean }) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [manualCodeMode, setManualCodeMode] = useState(initialManualMode)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const result = await requestFamilyAccessCode(phone)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setChallengeId(result.challengeId)
      setMessage(result.message)
    } catch {
      setError('No pudimos conectar con el servidor. Revisa tu conexion e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!challengeId && !manualCodeMode) return
    setLoading(true)
    setError(null)

    try {
      const result = challengeId
        ? await verifyFamilyAccessCode(challengeId, code)
        : await verifyFamilyAccessCodeByPhone(phone, code)

      if (!result.ok) {
        setError(result.message)
        return
      }

      const supabase = createClient()
      const { error: authError } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: 'magiclink',
      })

      if (authError) {
        setError('El codigo fue validado, pero no pudimos abrir tu portal. Contacta secretaria para obtener otro codigo.')
        return
      }

      router.push('/dashboard/portal-familiar')
      router.refresh()
    } catch {
      setError('Se interrumpio la conexion. Intenta entrar de nuevo; si el codigo ya fue usado, contacta secretaria.')
    } finally {
      setLoading(false)
    }
  }

  const isEnteringCode = !!challengeId || manualCodeMode

  return (
    <form onSubmit={isEnteringCode ? handleVerifyCode : handleRequestCode} className="space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Celular o WhatsApp del tutor
        </label>
        <input
          id="phone"
          type="tel"
          required
          autoComplete="tel"
          value={phone}
          disabled={!!challengeId || loading}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="809-000-0000"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-70"
        />
      </div>

      {isEnteringCode && (
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Codigo recibido
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] text-slate-900 dark:text-slate-100 placeholder-slate-300 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      )}

      {message && (
        <div role="status" className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {message}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Verificando...' : isEnteringCode ? 'Entrar al portal' : 'Enviarme codigo por WhatsApp'}
      </button>

      {!isEnteringCode && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setManualCodeMode(true)
            setMessage('Escribe el codigo que te entrego el colegio. Tiene tiempo limitado.')
            setError(null)
          }}
          className="w-full text-center text-xs font-semibold text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-accent-light"
        >
          Ya tengo un codigo
        </button>
      )}

      {isEnteringCode && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setChallengeId(null)
            setManualCodeMode(initialManualMode)
            setCode('')
            setMessage(null)
            setError(null)
          }}
          className="w-full text-center text-xs font-semibold text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-accent-light"
        >
          Usar otro numero
        </button>
      )}
    </form>
  )
}

