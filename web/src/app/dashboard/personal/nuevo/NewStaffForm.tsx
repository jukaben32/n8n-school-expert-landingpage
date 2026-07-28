'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NewStaffFormProps { schoolId: string }

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

export default function NewStaffForm({ schoolId }: NewStaffFormProps) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('teacher')
  const [educationLevel, setEducationLevel] = useState('')
  const [degreeTitle, setDegreeTitle] = useState('')
  const [almaMater, setAlmaMater] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [certifications, setCertifications] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Nombre, apellido y correo son obligatorios.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('staff').insert({
      school_id: schoolId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      role,
      education_level: educationLevel || null,
      degree_title: degreeTitle.trim() || null,
      alma_mater: almaMater.trim() || null,
      graduation_year: graduationYear ? Number(graduationYear) : null,
      specialty: specialty.trim() || null,
      certifications: certifications.trim() || null,
    })
    if (dbError) {
      setError('No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
      return
    }
    router.push('/dashboard/personal')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Datos de contacto</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className={labelClass}>Nombre</label>
            <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="lastName" className={labelClass}>Apellido</label>
            <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Correo</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>Teléfono</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label htmlFor="role" className={labelClass}>Puesto</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="director">Director</option>
              <option value="coordinator">Coordinador</option>
              <option value="teacher">Docente</option>
              <option value="assistant">Asistente</option>
              <option value="finance">Finanzas</option>
              <option value="reception">Recepción</option>
              <option value="nurse">Enfermería</option>
              <option value="admin">Administración</option>
              <option value="security">Seguridad</option>
              <option value="janitor">Conserje</option>
              <option value="cafeteria_assistant">Auxiliar de Cafetería</option>
              <option value="cleaning_assistant">Auxiliar de Limpieza</option>
              <option value="doorman">Portero</option>
              <option value="secretary">Secretaria</option>
              <option value="teaching_secretary">Secretaria Docente</option>
              <option value="teaching_assistant">Ayudante Docente</option>
              <option value="administrator">Administrador</option>
              <option value="psychologist">Psicóloga</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ficha profesional (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="educationLevel" className={labelClass}>Nivel académico</label>
            <select id="educationLevel" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className={inputClass}>
              <option value="">Sin especificar</option>
              <option value="tecnico">Técnico</option>
              <option value="bachiller">Bachiller</option>
              <option value="licenciatura">Licenciatura</option>
              <option value="maestria">Maestría</option>
              <option value="doctorado">Doctorado</option>
            </select>
          </div>
          <div>
            <label htmlFor="graduationYear" className={labelClass}>Año de egreso</label>
            <input id="graduationYear" type="number" min="1950" max="2100" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label htmlFor="degreeTitle" className={labelClass}>Título obtenido</label>
            <input id="degreeTitle" value={degreeTitle} onChange={(e) => setDegreeTitle(e.target.value)} placeholder="Ej. Licenciada en Educación Inicial" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label htmlFor="almaMater" className={labelClass}>Egresado de</label>
            <input id="almaMater" value={almaMater} onChange={(e) => setAlmaMater(e.target.value)} placeholder="Ej. Universidad Autónoma de Santo Domingo" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label htmlFor="specialty" className={labelClass}>Especialidad / área</label>
            <input id="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ej. Matemática, Educación Especial..." className={inputClass} />
          </div>
          <div className="col-span-2">
            <label htmlFor="certifications" className={labelClass}>Certificaciones adicionales</label>
            <input id="certifications" value={certifications} onChange={(e) => setCertifications(e.target.value)} placeholder="Ej. Certificación Montessori, TESOL..." className={inputClass} />
          </div>
        </div>
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
          {saving ? 'Guardando...' : 'Guardar'}
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
