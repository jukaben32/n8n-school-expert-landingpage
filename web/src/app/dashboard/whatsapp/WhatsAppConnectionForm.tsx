'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WhatsAppConnectionRecord {
  id: string
  school_id: string
  provider: string
  label: string
  assistant_name: string
  phone_number: string | null
  instance_name: string | null
  api_base_url: string | null
  webhook_path: string
  status: WhatsAppConnectionStatus
  notes: string | null
  created_at: string
  updated_at: string
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

const statusOptions: { value: WhatsAppConnectionStatus; label: string }[] = [
  { value: 'disconnected', label: 'Desconectado' },
  { value: 'connecting', label: 'Conectando' },
  { value: 'connected', label: 'Conectado' },
  { value: 'error', label: 'Con error' },
]

export default function WhatsAppConnectionForm({
  schoolId,
  initialConnection,
}: {
  schoolId: string
  initialConnection: WhatsAppConnectionRecord | null
}) {
  const router = useRouter()
  const [label, setLabel] = useState(initialConnection?.label ?? 'WhatsApp principal')
  const [assistantName, setAssistantName] = useState(initialConnection?.assistant_name ?? 'Asistente de IA')
  const [phoneNumber, setPhoneNumber] = useState(initialConnection?.phone_number ?? '')
  const [instanceName, setInstanceName] = useState(initialConnection?.instance_name ?? '')
  const [apiBaseUrl, setApiBaseUrl] = useState(initialConnection?.api_base_url ?? '')
  const [webhookPath, setWebhookPath] = useState(initialConnection?.webhook_path ?? '/api/whatsapp/webhook')
  const [status, setStatus] = useState<WhatsAppConnectionStatus>(initialConnection?.status ?? 'disconnected')
  const [notes, setNotes] = useState(initialConnection?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)

    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('whatsapp_connections')
      .upsert({
        school_id: schoolId,
        provider: 'evolution_api',
        label: label.trim() || 'WhatsApp principal',
        assistant_name: assistantName.trim() || 'Asistente de IA',
        phone_number: phoneNumber.trim() || null,
        instance_name: instanceName.trim() || null,
        api_base_url: apiBaseUrl.trim() || null,
        webhook_path: webhookPath.trim() || '/api/whatsapp/webhook',
        status,
        notes: notes.trim() || null,
      }, {
        onConflict: 'school_id',
      })

    if (dbError) {
      setError('No se pudo guardar la conexión. Intenta de nuevo.')
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-primary/20 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-primary dark:text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75c-4.556 0-8.25 3.42-8.25 7.636 0 1.896.756 3.636 2.003 4.97L5.25 20.25l4.003-1.159A9.24 9.24 0 0012 16.623c4.556 0 8.25-3.42 8.25-7.637S16.556 3.75 12 3.75z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-white">Conecta tu WhatsApp</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Sin n8n. Solo Evolution API, tu VPS y el mismo asistente del colegio respondiendo por ese canal.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
            Evolution API
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="label" className={labelClass}>Nombre de la conexión</label>
        <input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="WhatsApp principal"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="assistantName" className={labelClass}>Nombre del asistente</label>
        <input
          id="assistantName"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="Asistente de IA"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="phoneNumber" className={labelClass}>Número de WhatsApp</label>
          <input
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 809 000 0000"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="instanceName" className={labelClass}>Nombre de la instancia</label>
          <input
            id="instanceName"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="colegio-principal"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="apiBaseUrl" className={labelClass}>URL base de Evolution API</label>
        <input
          id="apiBaseUrl"
          value={apiBaseUrl}
          onChange={(e) => setApiBaseUrl(e.target.value)}
          placeholder="https://api.tuvps.com"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="webhookPath" className={labelClass}>Ruta del webhook</label>
          <input
            id="webhookPath"
            value={webhookPath}
            onChange={(e) => setWebhookPath(e.target.value)}
            placeholder="/api/whatsapp/webhook"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>Estado</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as WhatsAppConnectionStatus)}
            className={inputClass}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>Notas operativas</label>
        <textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. El VPS queda detrás de HTTPS y el webhook se publicará cuando tengamos el dominio."
          className={`${inputClass} resize-y`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 text-xs text-slate-500 dark:text-slate-400">
        Este formulario deja la base lista para que, cuando llegue el VPS, solo tengamos que apuntar Evolution API y
        activar el canal. No modifica chat, voz ni el resto del dashboard.
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          ✓ Guardado.
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 text-sm transition shadow-glow disabled:opacity-60"
      >
        {saving ? 'Guardando...' : 'Guardar conexión'}
      </button>
    </form>
  )
}
