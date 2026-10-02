'use client'

import { useState } from 'react'
import { generateManualFamilyAccessCode } from './actions'
import { FAMILY_ACCESS_MAX_MANUAL_CODES_PER_DAY } from '@/lib/familyAccessPolicy'

type ManualResult = {
  guardianName: string
  maskedPhone: string
  code: string
  expiresAt: string
  message: string
  remainingCodes: number
}

function formatExpiration(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function ManualFamilyAccessPanel() {
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<ManualResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCopied(false)
    setResult(null)

    try {
      const response = await generateManualFamilyAccessCode(phone)
      if (!response.ok) {
        setError(response.message)
        return
      }
      setResult(response)
    } catch {
      setError('No pudimos conectar con el servidor. Revisa la conexion e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function copyMessage() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.message)
      setCopied(true)
    } catch {
      setError('El navegador no permite copiar automaticamente. Selecciona y copia el texto del mensaje.')
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Generar codigo manual</h2>
          <p className="text-sm text-slate-500">
            Hasta {FAMILY_ACCESS_MAX_MANUAL_CODES_PER_DAY} codigos por colegio en las ultimas 24 horas.
            Cada generacion, incluidos los reintentos, usa un cupo. El codigo vence en 24 horas.
          </p>
        </div>

        <div className="mt-5">
          <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Celular registrado del tutor
          </label>
          <input
            id="phone"
            type="tel"
            required
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="809-000-0000"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Generando...' : 'Generar codigo'}
        </button>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          Si el celular esta duplicado, si el tutor no tiene hijos vinculados o si no pertenece a este colegio,
          el sistema no entregara codigo.
        </p>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Mensaje para WhatsApp Business</h2>
          <p className="text-sm text-slate-500">
            Copia este texto y envialo manualmente al WhatsApp del tutor correspondiente.
          </p>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <p role="status" className="text-sm text-slate-600">
              Cupos restantes al generar este codigo: {result.remainingCodes}.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tutor</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{result.guardianName}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Celular</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{result.maskedPhone}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Vence</p>
                <p className="mt-1 text-sm font-semibold text-emerald-800">{formatExpiration(result.expiresAt)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-emerald-300">Codigo generado</p>
              <p className="font-mono text-3xl font-black tracking-[0.35em] text-white">{result.code}</p>
            </div>

            <textarea
              aria-label="Mensaje para enviar al tutor"
              readOnly
              value={result.message}
              rows={9}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
            />

            <button
              type="button"
              onClick={copyMessage}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              {copied ? 'Mensaje copiado' : 'Copiar mensaje para WhatsApp'}
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-500">
              Aqui aparecera el codigo y el mensaje listo para copiar.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
