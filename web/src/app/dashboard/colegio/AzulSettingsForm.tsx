'use client'

import { useState } from 'react'
import { savePaymentSettings, type PaymentSettingsDisplay } from './paymentSettingsActions'

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

export default function AzulSettingsForm({ initial }: { initial: PaymentSettingsDisplay }) {
  const [merchantId, setMerchantId] = useState(initial.merchantId)
  const [merchantName, setMerchantName] = useState(initial.merchantName)
  const [merchantType, setMerchantType] = useState(initial.merchantType)
  const [currencyCode, setCurrencyCode] = useState(initial.currencyCode)
  const [environment, setEnvironment] = useState(initial.environment)
  const [authKey, setAuthKey] = useState('')
  const [hasAuthKey, setHasAuthKey] = useState(initial.hasAuthKey)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)

    const formData = new FormData()
    formData.set('merchantId', merchantId)
    formData.set('merchantName', merchantName)
    formData.set('merchantType', merchantType)
    formData.set('currencyCode', currencyCode)
    formData.set('environment', environment)
    formData.set('authKey', authKey)

    const result = await savePaymentSettings(formData)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar.')
      return
    }
    if (authKey.trim()) setHasAuthKey(true)
    setAuthKey('')
    setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
          Pago con tarjeta (Azul)
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          El dinero de este colegio va directo a SU cuenta comercial de Azul -- estas credenciales son propias de este
          colegio, nunca compartidas con otros. Configúralas con los datos que te dio tu ejecutivo de negocios de Azul.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="merchantId" className={labelClass}>Merchant ID</label>
          <input id="merchantId" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="merchantName" className={labelClass}>Nombre del comercio</label>
          <input id="merchantName" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="merchantType" className={labelClass}>Tipo de comercio</label>
          <input id="merchantType" value={merchantType} onChange={(e) => setMerchantType(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="currencyCode" className={labelClass}>Código de moneda</label>
          <input id="currencyCode" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="environment" className={labelClass}>Ambiente</label>
          <select id="environment" value={environment} onChange={(e) => setEnvironment(e.target.value as 'test' | 'production')} className={inputClass}>
            <option value="test">Pruebas</option>
            <option value="production">Producción</option>
          </select>
        </div>
        <div>
          <label htmlFor="authKey" className={labelClass}>
            AuthKey {hasAuthKey && <span className="text-green-600 dark:text-green-400 font-normal">(ya configurada)</span>}
          </label>
          <input
            id="authKey" type="password" value={authKey} onChange={(e) => setAuthKey(e.target.value)}
            placeholder={hasAuthKey ? 'Dejar en blanco para conservar la actual' : 'Pega el AuthKey que te dio Azul'}
            className={inputClass}
          />
        </div>
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
        {saving ? 'Guardando...' : 'Guardar credenciales de Azul'}
      </button>
    </form>
  )
}
