'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function NewSchoolForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('El nombre del colegio es obligatorio.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('schools').insert({
      name: name.trim(),
      subdomain: subdomain.trim() || slugify(name),
    })
    if (dbError) {
      setError(dbError.message.includes('duplicate') ? 'Ya existe un colegio con ese subdominio.' : 'No se pudo crear el colegio.')
      setSaving(false)
      return
    }
    router.push('/dashboard/plataforma')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>Nombre del colegio</label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!subdomain) setSubdomain(slugify(e.target.value))
          }}
          placeholder="Ej. Colegio San Rafael"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="subdomain" className={labelClass}>Subdominio</label>
        <input id="subdomain" value={subdomain} onChange={(e) => setSubdomain(slugify(e.target.value))} placeholder="colegio-san-rafael" className={inputClass} />
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Crear colegio'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
