'use client'

import { useState } from 'react'
import { Plus, Trash2, ExternalLink, Upload, X } from 'lucide-react'
import type { SchoolWebsiteSettings, WebsiteTemplate, WebsiteFont } from '@/lib/websiteSettings'
import {
  saveWebsiteContentAction,
  uploadWebsitePhotoAction,
  type WebsiteFaqInput,
  type WebsiteServiceInput,
  type WebsiteTeamMemberInput,
  type WebsiteTestimonialInput,
} from './actions'

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
const sectionClass = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4'
const sectionTitleClass = 'text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500'

const TEMPLATE_OPTIONS: { value: WebsiteTemplate; label: string }[] = [
  { value: 'clasico', label: 'Clásico' },
  { value: 'moderno', label: 'Moderno' },
  { value: 'calido', label: 'Cálido' },
]
const FONT_OPTIONS: { value: WebsiteFont; label: string }[] = [
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'merriweather', label: 'Merriweather' },
]
const ICON_OPTIONS = ['sparkles', 'book-open', 'bus', 'utensils', 'heart-handshake', 'languages', 'music', 'trophy', 'shield-check']

type ServiceRow = WebsiteServiceInput
type TeamRow = WebsiteTeamMemberInput
type TestimonialRow = WebsiteTestimonialInput
type FaqRow = WebsiteFaqInput

function emptyService(): ServiceRow {
  return { icon: 'sparkles', name: '', description: '', duration: '', price: '' }
}
function emptyTeamMember(): TeamRow {
  return { name: '', role: '', bio: '', photoUrl: '' }
}
function emptyTestimonial(): TestimonialRow {
  return { quote: '', authorName: '', authorRole: '', rating: 5 }
}
function emptyFaq(): FaqRow {
  return { question: '', answer: '' }
}

export default function SchoolWebsiteForm({
  school,
  initialSettings,
  initialServices,
  initialTeamMembers,
  initialTestimonials,
  initialFaqs,
}: {
  school: School
  initialSettings: SchoolWebsiteSettings
  initialServices: { icon: string; name: string; description: string | null; duration: string | null; price: string | null }[]
  initialTeamMembers: { name: string; role: string; bio: string | null; photo_url: string | null }[]
  initialTestimonials: { quote: string; author_name: string; author_role: string | null; rating: number }[]
  initialFaqs: { question: string; answer: string }[]
}) {
  const [settings, setSettings] = useState<SchoolWebsiteSettings>(initialSettings)
  const [services, setServices] = useState<ServiceRow[]>(
    initialServices.length
      ? initialServices.map((s) => ({ icon: s.icon, name: s.name, description: s.description ?? '', duration: s.duration ?? '', price: s.price ?? '' }))
      : [emptyService()]
  )
  const [teamMembers, setTeamMembers] = useState<TeamRow[]>(
    initialTeamMembers.length
      ? initialTeamMembers.map((m) => ({ name: m.name, role: m.role, bio: m.bio ?? '', photoUrl: m.photo_url ?? '' }))
      : [emptyTeamMember()]
  )
  const [testimonials, setTestimonials] = useState<TestimonialRow[]>(
    initialTestimonials.length
      ? initialTestimonials.map((t) => ({ quote: t.quote, authorName: t.author_name, authorRole: t.author_role ?? '', rating: t.rating }))
      : [emptyTestimonial()]
  )
  const [faqs, setFaqs] = useState<FaqRow[]>(initialFaqs.length ? initialFaqs : [emptyFaq()])
  const [logoUrl, setLogoUrl] = useState(school.logo_url ?? '')
  const [badgeInput, setBadgeInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof SchoolWebsiteSettings>(key: K, value: SchoolWebsiteSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function addBadge() {
    const label = badgeInput.trim()
    if (label && !settings.trustBadges.includes(label)) {
      set('trustBadges', [...settings.trustBadges, label])
    }
    setBadgeInput('')
  }
  function removeBadge(label: string) {
    set('trustBadges', settings.trustBadges.filter((b) => b !== label))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)

    const result = await saveWebsiteContentAction({ logoUrl, settings, services, teamMembers, testimonials, faqs })

    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar el sitio web')
      return
    }
    setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Barra fija: vista previa + publicar + guardar — siempre visible, no
          hace falta guardar primero para encontrarla ni bajar hasta el final
          de la página. Los cambios de los campos de abajo solo se reflejan
          en el sitio público (y en la vista previa) después de "Guardar". */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-3 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href={`/colegio/${school.subdomain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Vista previa
            </a>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.isPublished}
                onChange={(e) => set('isPublished', e.target.checked)}
                className="h-4 w-4"
              />
              <span className={`text-sm font-semibold ${settings.isPublished ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                {settings.isPublished ? '● Publicado' : '○ Sin publicar (muestra "próximamente")'}
              </span>
            </label>
          </div>
          <button type="submit" disabled={saving} className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 text-sm transition shadow-glow disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {saved && <p role="status" className="mt-2 text-sm text-green-600 dark:text-green-400">✓ Guardado — la vista previa ya refleja los cambios.</p>}
      </div>

      {/* Diseño */}
      <section className={sectionClass}>
        <p className={sectionTitleClass}>Diseño</p>
        <ImageUploadField label="Logo del colegio" value={logoUrl} onChange={setLogoUrl} kind="logo" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Plantilla</label>
            <select value={settings.template} onChange={(e) => set('template', e.target.value as WebsiteTemplate)} className={inputClass}>
              {TEMPLATE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipografía</label>
            <select value={settings.font} onChange={(e) => set('font', e.target.value as WebsiteFont)} className={inputClass}>
              {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Color principal</label>
            <input type="color" value={settings.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700" />
          </div>
          <div>
            <label className={labelClass}>Color de acento</label>
            <input type="color" value={settings.accentColor} onChange={(e) => set('accentColor', e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700" />
          </div>
        </div>
      </section>

      {/* Hero */}
      <section className={sectionClass}>
        <p className={sectionTitleClass}>Portada (Hero)</p>
        <input placeholder="Título principal" value={settings.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} className={inputClass} />
        <textarea placeholder="Subtítulo" rows={2} value={settings.heroSubtitle} onChange={(e) => set('heroSubtitle', e.target.value)} className={inputClass} />
        <ImageUploadField label="Imagen de portada" value={settings.heroImageUrl} onChange={(url) => set('heroImageUrl', url)} kind="hero" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Texto botón principal" value={settings.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} className={inputClass} />
          <input placeholder="Texto botón secundario (opcional)" value={settings.ctaSecondaryLabel} onChange={(e) => set('ctaSecondaryLabel', e.target.value)} className={inputClass} />
        </div>
      </section>

      {/* Sobre nosotros + stats */}
      <section className={sectionClass}>
        <p className={sectionTitleClass}>Sobre nosotros</p>
        <input placeholder="Título de la sección" value={settings.aboutTitle} onChange={(e) => set('aboutTitle', e.target.value)} className={inputClass} />
        <textarea placeholder="Historia del colegio" rows={4} value={settings.aboutStory} onChange={(e) => set('aboutStory', e.target.value)} className={inputClass} />
        <ImageUploadField label="Foto (fachada, patio, etc.)" value={settings.aboutPhotoUrl} onChange={(url) => set('aboutPhotoUrl', url)} kind="about" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input placeholder="Año de fundación" value={settings.yearsFounded} onChange={(e) => set('yearsFounded', e.target.value)} className={inputClass} />
          <input placeholder="Estudiantes actuales" value={settings.studentsCount} onChange={(e) => set('studentsCount', e.target.value)} className={inputClass} />
          <input placeholder="% de satisfacción" value={settings.satisfactionPct} onChange={(e) => set('satisfactionPct', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Insignias de confianza (acreditaciones, certificaciones)</label>
          <div className="flex gap-2">
            <input
              placeholder="Ej. Acreditado MINERD"
              value={badgeInput}
              onChange={(e) => setBadgeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBadge() } }}
              className={inputClass}
            />
            <button type="button" onClick={addBadge} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0">
              Agregar
            </button>
          </div>
          {settings.trustBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {settings.trustBadges.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                  {b}
                  <button type="button" onClick={() => removeBadge(b)} className="text-slate-400 hover:text-red-600">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Servicios / programas */}
      <RepeatableSection
        title="Programas y servicios"
        rows={services}
        onChange={setServices}
        emptyRow={emptyService}
        renderRow={(row, update) => (
          <>
            <select value={row.icon} onChange={(e) => update({ ...row, icon: e.target.value })} className={inputClass}>
              {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <input placeholder="Nombre (ej. Transporte escolar)" value={row.name} onChange={(e) => update({ ...row, name: e.target.value })} className={`${inputClass} sm:col-span-2`} />
            <textarea placeholder="Descripción" rows={2} value={row.description} onChange={(e) => update({ ...row, description: e.target.value })} className={`${inputClass} sm:col-span-3`} />
            <input placeholder="Horario/duración (opcional)" value={row.duration} onChange={(e) => update({ ...row, duration: e.target.value })} className={inputClass} />
            <input placeholder="Precio (opcional)" value={row.price} onChange={(e) => update({ ...row, price: e.target.value })} className={inputClass} />
          </>
        )}
        addLabel="+ Agregar programa/servicio"
      />

      {/* Personal destacado */}
      <RepeatableSection
        title="Personal destacado"
        rows={teamMembers}
        onChange={setTeamMembers}
        emptyRow={emptyTeamMember}
        renderRow={(row, update) => (
          <>
            <input placeholder="Nombre" value={row.name} onChange={(e) => update({ ...row, name: e.target.value })} className={inputClass} />
            <input placeholder="Cargo (ej. Directora)" value={row.role} onChange={(e) => update({ ...row, role: e.target.value })} className={inputClass} />
            <ImageUploadField label="Foto" value={row.photoUrl} onChange={(url) => update({ ...row, photoUrl: url })} kind="team" />
            <textarea placeholder="Reseña breve" rows={2} value={row.bio} onChange={(e) => update({ ...row, bio: e.target.value })} className={`${inputClass} sm:col-span-3`} />
          </>
        )}
        addLabel="+ Agregar miembro del personal"
      />

      {/* Testimonios */}
      <RepeatableSection
        title="Testimonios"
        rows={testimonials}
        onChange={setTestimonials}
        emptyRow={emptyTestimonial}
        renderRow={(row, update) => (
          <>
            <textarea placeholder="Testimonio" rows={2} value={row.quote} onChange={(e) => update({ ...row, quote: e.target.value })} className={`${inputClass} sm:col-span-3`} />
            <input placeholder="Nombre" value={row.authorName} onChange={(e) => update({ ...row, authorName: e.target.value })} className={inputClass} />
            <input placeholder="Rol (ej. Madre de familia)" value={row.authorRole} onChange={(e) => update({ ...row, authorRole: e.target.value })} className={inputClass} />
            <select value={row.rating} onChange={(e) => update({ ...row, rating: Number(e.target.value) })} className={inputClass}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} estrella{n === 1 ? '' : 's'}</option>)}
            </select>
          </>
        )}
        addLabel="+ Agregar testimonio"
      />

      {/* FAQs públicas */}
      <RepeatableSection
        title="Preguntas frecuentes (sitio público)"
        rows={faqs}
        onChange={setFaqs}
        emptyRow={emptyFaq}
        renderRow={(row, update) => (
          <>
            <input placeholder="Pregunta" value={row.question} onChange={(e) => update({ ...row, question: e.target.value })} className={`${inputClass} sm:col-span-3`} />
            <textarea placeholder="Respuesta" rows={2} value={row.answer} onChange={(e) => update({ ...row, answer: e.target.value })} className={`${inputClass} sm:col-span-3`} />
          </>
        )}
        addLabel="+ Agregar pregunta frecuente"
      />

      {/* Contacto y redes */}
      <section className={sectionClass}>
        <p className={sectionTitleClass}>Contacto y redes sociales</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">
          Teléfono, correo y dirección se administran en Configuración del colegio — aquí solo lo adicional.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Horario de atención" value={settings.contactHours} onChange={(e) => set('contactHours', e.target.value)} className={inputClass} />
          <input placeholder="URL de Google Maps" value={settings.contactMapsUrl} onChange={(e) => set('contactMapsUrl', e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Facebook (URL)" value={settings.socialFacebook} onChange={(e) => set('socialFacebook', e.target.value)} className={inputClass} />
          <input placeholder="Instagram (URL)" value={settings.socialInstagram} onChange={(e) => set('socialInstagram', e.target.value)} className={inputClass} />
          <input placeholder="YouTube (URL)" value={settings.socialYoutube} onChange={(e) => set('socialYoutube', e.target.value)} className={inputClass} />
          <input placeholder="TikTok (URL)" value={settings.socialTiktok} onChange={(e) => set('socialTiktok', e.target.value)} className={inputClass} />
          <input placeholder="LinkedIn (URL)" value={settings.socialLinkedin} onChange={(e) => set('socialLinkedin', e.target.value)} className={inputClass} />
        </div>
        <input placeholder="Frase del pie de página" value={settings.footerTagline} onChange={(e) => set('footerTagline', e.target.value)} className={inputClass} />
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 text-sm transition shadow-glow disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

function RepeatableSection<T>({
  title,
  rows,
  onChange,
  emptyRow,
  renderRow,
  addLabel,
}: {
  title: string
  rows: T[]
  onChange: (rows: T[]) => void
  emptyRow: () => T
  renderRow: (row: T, update: (row: T) => void) => React.ReactNode
  addLabel: string
}) {
  return (
    <section className={sectionClass}>
      <div className="flex items-center justify-between">
        <p className={sectionTitleClass}>{title}</p>
        <button
          type="button"
          onClick={() => onChange([...rows, emptyRow()])}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-accent-light"
        >
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 relative">
            {renderRow(row, (updated) => onChange(rows.map((r, idx) => (idx === i ? updated : r))))}
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 rounded-full bg-red-600 text-white p-1 shadow"
                aria-label="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// Sube directo al bucket público website-photos vía uploadWebsitePhotoAction
// -- reemplaza los campos de "pega la URL" por un botón real de subida,
// con miniatura de la imagen actual y opción de quitarla.
function ImageUploadField({
  label,
  value,
  onChange,
  kind,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  kind: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', kind)
    const result = await uploadWebsitePhotoAction(formData)
    setUploading(false)

    if (!result.ok) {
      setError(result.error ?? 'No se pudo subir la imagen')
      return
    }
    onChange(result.url ?? '')
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <Upload className="w-5 h-5 text-slate-300 dark:text-slate-600" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Subiendo…' : value ? 'Cambiar imagen' : 'Subir imagen'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFile}
                disabled={uploading}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
              >
                <X className="w-3 h-3" /> Quitar
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
