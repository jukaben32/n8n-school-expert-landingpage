'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, MapPin, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface School {
  id: string
  name: string
  tagline: string | null
  subdomain: string
  address: string | null
  phone: string | null
  email: string | null
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'
const sectionClass = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4'

export default function SchoolProfileForm({ school }: { school: School }) {
  const router = useRouter()
  const [name, setName] = useState(school.name)
  const [tagline, setTagline] = useState(school.tagline ?? '')
  const [address, setAddress] = useState(school.address ?? '')
  const [phone, setPhone] = useState(school.phone ?? '')
  const [email, setEmail] = useState(school.email ?? '')
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
      .from('schools')
      .update({
        name: name.trim() || school.name,
        tagline: tagline.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
      .eq('id', school.id)

    setSaving(false)
    if (dbError) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className={sectionClass}>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary dark:text-accent-light" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Identidad del colegio</p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">
          Nombre y datos de contacto — se usan en el portal, la app y el sitio público.
        </p>

        <div>
          <label htmlFor="name" className={labelClass}>Nombre del colegio *</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label htmlFor="tagline" className={labelClass}>Lema o frase corta (opcional)</label>
          <input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Ej. Formando líderes desde 1998"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="phone" className={labelClass}>Teléfono</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Correo de contacto</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Sitio web</label>
          <a
            href={`/colegio/${school.subdomain}`}
            target="_blank"
            rel="noreferrer"
            className={`${inputClass} flex items-center justify-between gap-2 text-primary dark:text-accent-light hover:underline`}
          >
            /colegio/{school.subdomain}
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            Se edita desde Sitio Web en el menú — aquí solo el enlace directo.
          </p>
        </div>
      </div>

      <div className={sectionClass}>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary dark:text-accent-light" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Ubicación</p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">
          Dirección física que se muestra a las familias en el sitio público.
        </p>
        <div>
          <label htmlFor="address" className={labelClass}>Dirección</label>
          <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 text-sm transition shadow-glow disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
