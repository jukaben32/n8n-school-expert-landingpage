'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { roleLabels, educationLabels } from '@/lib/staff/roleLabels'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 transition focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-transparent'
const labelClass = 'block text-sm font-medium text-white/80 mb-1.5'

export default function StaffRegistrationForm({ schoolId }: { schoolId: string }) {
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // FormData en vez de estado controlado -- evita el problema ya conocido
    // de que el autocompletado del navegador no dispara onChange (mismo
    // bug que ya se corrigió una vez en LeadForm.tsx).
    const formData = new FormData(e.currentTarget)
    const firstName = String(formData.get('firstName') || '').trim()
    const lastName = String(formData.get('lastName') || '').trim()
    const email = String(formData.get('email') || '').trim()
    const desiredRole = String(formData.get('desiredRole') || '')

    if (!firstName || !lastName || !email || !desiredRole) {
      setError('Completa al menos nombre, apellido, correo y puesto.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const graduationYearRaw = String(formData.get('graduationYear') || '').trim()

    const { error: insertError } = await supabase.from('staff_registrations').insert({
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: String(formData.get('phone') || '').trim() || null,
      national_id: String(formData.get('nationalId') || '').trim() || null,
      desired_role: desiredRole,
      specialty: String(formData.get('specialty') || '').trim() || null,
      education_level: String(formData.get('educationLevel') || '') || null,
      degree_title: String(formData.get('degreeTitle') || '').trim() || null,
      alma_mater: String(formData.get('almaMater') || '').trim() || null,
      graduation_year: graduationYearRaw ? Number(graduationYearRaw) : null,
      certifications: String(formData.get('certifications') || '').trim() || null,
    })

    if (insertError) {
      console.error('[registro de personal]', insertError)
      setError('No se pudo enviar tu registro. Intenta de nuevo o contacta a la dirección del colegio.')
      setSaving(false)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-3xl mb-3" aria-hidden="true">✓</p>
        <p className="text-white font-semibold">¡Registro enviado!</p>
        <p className="text-white/60 text-sm mt-1.5">
          La dirección del colegio va a revisar tus datos y activar tu acceso al sistema pronto.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className={labelClass}>Nombre</label>
          <input id="firstName" name="firstName" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="lastName" className={labelClass}>Apellido</label>
          <input id="lastName" name="lastName" required className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>Correo electrónico</label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="phone" className={labelClass}>Teléfono</label>
          <input id="phone" name="phone" placeholder="809-000-0000" className={inputClass} />
        </div>
        <div>
          <label htmlFor="nationalId" className={labelClass}>Cédula</label>
          <input id="nationalId" name="nationalId" placeholder="000-0000000-0" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="desiredRole" className={labelClass}>Puesto</label>
        <select id="desiredRole" name="desiredRole" required className={inputClass}>
          <option value="" className="text-slate-900">Selecciona tu puesto...</option>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value} className="text-slate-900">{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="specialty" className={labelClass}>Materia / curso / área (opcional)</label>
        <input id="specialty" name="specialty" placeholder="Ej. Inglés (Nivel Primario) 1er Ciclo" className={inputClass} />
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-white/40 pt-2">Ficha profesional (opcional)</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="educationLevel" className={labelClass}>Nivel académico</label>
          <select id="educationLevel" name="educationLevel" className={inputClass} defaultValue="">
            <option value="" className="text-slate-900">Sin especificar</option>
            {Object.entries(educationLabels).map(([value, label]) => (
              <option key={value} value={value} className="text-slate-900">{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="graduationYear" className={labelClass}>Año de egreso</label>
          <input id="graduationYear" name="graduationYear" type="number" min="1960" max="2030" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="degreeTitle" className={labelClass}>Título obtenido</label>
        <input id="degreeTitle" name="degreeTitle" placeholder="Ej. Licenciada en Educación Inicial" className={inputClass} />
      </div>

      <div>
        <label htmlFor="almaMater" className={labelClass}>Egresado de</label>
        <input id="almaMater" name="almaMater" placeholder="Ej. Universidad Autónoma de Santo Domingo" className={inputClass} />
      </div>

      <div>
        <label htmlFor="certifications" className={labelClass}>Certificaciones adicionales</label>
        <input id="certifications" name="certifications" placeholder="Ej. Certificación Montessori, TESOL..." className={inputClass} />
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
      >
        {saving ? 'Enviando...' : 'Enviar mi registro'}
      </button>
    </form>
  )
}
