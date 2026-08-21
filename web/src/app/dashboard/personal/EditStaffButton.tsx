'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStaffAction } from './actions'
import { roleLabels, educationLabels } from '@/lib/staff/roleLabels'

interface StaffFields {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: string
  specialty: string | null
  education_level: string | null
  degree_title: string | null
  alma_mater: string | null
}

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

export default function EditStaffButton({ staff }: { staff: StaffFields }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(staff.first_name)
  const [lastName, setLastName] = useState(staff.last_name)
  const [email, setEmail] = useState(staff.email)
  const [phone, setPhone] = useState(staff.phone ?? '')
  const [role, setRole] = useState(staff.role)
  const [specialty, setSpecialty] = useState(staff.specialty ?? '')
  const [educationLevel, setEducationLevel] = useState(staff.education_level ?? '')
  const [degreeTitle, setDegreeTitle] = useState(staff.degree_title ?? '')
  const [almaMater, setAlmaMater] = useState(staff.alma_mater ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    setSaving(true)
    const result = await updateStaffAction({
      staffId: staff.id, firstName, lastName, email, phone, role, specialty, educationLevel, degreeTitle, almaMater,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs font-semibold text-primary dark:text-accent-light hover:underline"
      >
        ✏️ Editar
      </button>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Nombre</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Apellido</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Correo</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Puesto</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value} className="text-slate-900">{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Nivel académico</label>
          <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className={inputClass}>
            <option value="" className="text-slate-900">Sin especificar</option>
            {Object.entries(educationLabels).map(([value, label]) => (
              <option key={value} value={value} className="text-slate-900">{label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Especialidad</label>
          <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Título obtenido</label>
          <input value={degreeTitle} onChange={(e) => setDegreeTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Egresado de</label>
          <input value={almaMater} onChange={(e) => setAlmaMater(e.target.value)} className={inputClass} />
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-full bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 transition disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setEditing(false)}
          className="rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
