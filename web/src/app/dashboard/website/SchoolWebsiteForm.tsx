'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildWebsiteSettings, getWebsiteSettings } from '@/lib/websiteSettings'
import { Globe, Palette, Sparkles, ArrowRight } from 'lucide-react'

interface School {
  id: string
  name: string
  subdomain: string
  tagline: string | null
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  settings: Record<string, unknown> | null
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

const IMPLEMENTATION_NOTES = [
  {
    icon: Globe,
    title: 'Landing pública separada',
    text: 'Aquí defines el hero, el logo y la identidad visual del colegio sin mezclarlo con la configuración operativa.',
  },
  {
    icon: Palette,
    title: 'Branding consistente',
    text: 'Los colores y el mensaje principal alimentan la landing pública y la vista previa del portal escolar.',
  },
  {
    icon: Sparkles,
    title: 'Misma base, otra experiencia',
    text: 'La información de horarios, pagos y soporte sigue viviendo en Configuración para que no se rompa el flujo.',
  },
]

export default function SchoolWebsiteForm({ school }: { school: School }) {
  const websiteSettings = getWebsiteSettings(school.settings)
  const currentSettings = school.settings && typeof school.settings === 'object' && !Array.isArray(school.settings)
    ? school.settings
    : {}
  const [logoUrl, setLogoUrl] = useState(school.logo_url ?? '')
  const [heroTitle, setHeroTitle] = useState(websiteSettings.hero_title || school.name)
  const [heroSubtitle, setHeroSubtitle] = useState(websiteSettings.hero_subtitle || school.tagline || '')
  const [ctaLabel, setCtaLabel] = useState(websiteSettings.cta_label)
  const [primaryColor, setPrimaryColor] = useState(websiteSettings.primary_color)
  const [accentColor, setAccentColor] = useState(websiteSettings.accent_color)
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
        tagline: heroSubtitle.trim() || null,
        logo_url: logoUrl.trim() || null,
        settings: {
          ...currentSettings,
          website: buildWebsiteSettings({
            hero_title: heroTitle.trim(),
            hero_subtitle: heroSubtitle.trim(),
            cta_label: ctaLabel.trim(),
            primary_color: primaryColor.trim(),
            accent_color: accentColor.trim(),
          }),
        },
      })
      .eq('id', school.id)

    if (dbError) {
      setError('No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const previewHeroTitle = heroTitle.trim() || school.name
  const previewHeroSubtitle =
    heroSubtitle.trim() || 'Conecta a las familias con comunicados, pagos, asistencia y soporte desde una sola experiencia.'
  const previewCtaLabel = ctaLabel.trim() || 'Iniciar sesión'
  const previewLogoUrl = logoUrl.trim() || school.logo_url || ''

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] items-start">
      <div className="card-surface p-6 lg:p-7 space-y-5">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white dark:bg-slate-900 border border-primary/20">
            <Globe className="h-6 w-6 text-primary dark:text-accent-light" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white">Completa tu Sitio Web</p>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Define el hero, el logo y el tono visual del portal público. Lo operativo sigue en Configuración.
            </p>
            <Link
              href={`/colegio/${school.subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary text-white px-4 py-2 text-xs font-semibold shadow-glow transition hover:bg-primary-dark"
            >
              Ver página pública
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="logoUrl" className={labelClass}>Logo del colegio</label>
            <input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              La imagen se usa en la landing pública y en el icono visual de la página.
            </p>
          </div>

          <div>
            <label htmlFor="heroTitle" className={labelClass}>Título principal</label>
            <input
              id="heroTitle"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder={`Ej. ${school.name}`}
              className={inputClass}
              maxLength={90}
            />
          </div>

          <div>
            <label htmlFor="heroSubtitle" className={labelClass}>Subtítulo / mensaje principal</label>
            <textarea
              id="heroSubtitle"
              rows={4}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Ej. Conecta a las familias con comunicados, pagos y asistencia desde un solo lugar."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <label htmlFor="ctaLabel" className={labelClass}>Texto del botón</label>
              <input
                id="ctaLabel"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Ej. Iniciar sesión"
                className={inputClass}
                maxLength={40}
              />
            </div>
            <div>
              <label htmlFor="primaryColor" className={labelClass}>Color principal</label>
              <input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1"
              />
            </div>
            <div>
              <label htmlFor="accentColor" className={labelClass}>Color acento</label>
              <input
                id="accentColor"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1"
              />
            </div>
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                Página pública
              </p>
              <p className="mt-1 text-sm font-mono text-slate-700 dark:text-slate-300 truncate">
                /colegio/{school.subdomain}
              </p>
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
            {saving ? 'Guardando...' : 'Guardar sitio web'}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="card-surface p-6 lg:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--text-3)]">
                Vista previa
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-1)]">
                Cómo se verá tu landing
              </h2>
            </div>
            <span className="badge border-transparent bg-[var(--bg-raised)] text-[var(--text-3)]">
              Draft
            </span>
          </div>

          <div
            className="mt-5 overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
            style={{
              backgroundImage: `radial-gradient(circle at top left, ${primaryColor}14 0%, transparent 36%), radial-gradient(circle at bottom right, ${accentColor}14 0%, transparent 34%)`,
            }}
          >
            <div className="border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ backgroundColor: `${primaryColor}18` }}>
                    {previewLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewLogoUrl} alt={school.name} className="h-10 w-10 rounded-2xl object-cover" />
                    ) : (
                      <span className="text-sm font-black" style={{ color: primaryColor }}>
                        {school.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-1)]">{school.name}</p>
                    <p className="text-xs text-[var(--text-3)]">Portal escolar público</p>
                  </div>
                </div>
                <div className="hidden rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-3)] sm:inline-flex">
                  Live preview
                </div>
              </div>
            </div>

            <div className="grid gap-6 px-5 py-6 sm:px-6">
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.35em]" style={{ color: primaryColor }}>
                  Portal escolar
                </p>
                <h3 className="max-w-md text-4xl font-black tracking-[-0.05em] text-slate-900 sm:text-5xl">
                  {previewHeroTitle}
                </h3>
                <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                  {previewHeroSubtitle}
                </p>
                <div className="flex flex-wrap gap-3">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                    }}
                  >
                    {previewCtaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--text-2)]">
                    Ver comunicados
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border)] bg-white/90 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Dirección</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-1)]">{school.address || 'Pendiente de cargar'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/90 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Teléfono</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-1)]">{school.phone || 'Pendiente de cargar'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/90 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Correo</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-1)] break-all">{school.email || 'Pendiente de cargar'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-surface p-6 lg:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--text-3)]">
            Implementation notes
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-1)]">
            Cómo encaja el sitio web en el colegio
          </h2>

          <div className="mt-5 space-y-3">
            {IMPLEMENTATION_NOTES.map((note) => {
              const Icon = note.icon
              return (
                <div key={note.title} className="flex gap-3 rounded-[22px] border border-[var(--border)] bg-white/75 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--teal-700)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--text-1)]">{note.title}</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-3)]">{note.text}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-[var(--bg-raised)] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
              Relación con Configuración
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-3)]">
              <p>
                <code>Configuración</code> guarda la parte operativa: datos del colegio, horarios y pagos.
              </p>
              <p>
                <code>Sitio Web</code> se ocupa del hero, el logo y el branding que ven las familias.
              </p>
              <p>
                Así evitamos mezclar la identidad pública con la operación interna.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--bg-page)] p-4 text-sm text-[var(--text-3)]">
            Si luego quieres llevar este mismo patrón al otro proyecto, ya queda lista la misma separación de hojas.
          </div>
        </div>
      </div>
    </div>
  )
}
