'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStudentAction } from './actions'

interface StudentFields {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  gender: string | null
}

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

export default function EditStudentButton({ student }: { student: StudentFields }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(student.first_name)
  const [lastName, setLastName] = useState(student.last_name)
  const [birthDate, setBirthDate] = useState(student.birth_date)
  const [gender, setGender] = useState(student.gender ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    setSaving(true)
    const result = await updateStudentAction({ studentId: student.id, firstName, lastName, birthDate, gender })
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
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
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
          <label className={labelClass}>Fecha de nacimiento</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Género</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
            <option value="" className="text-slate-900">Sin especificar</option>
            <option value="masculino" className="text-slate-900">Masculino</option>
            <option value="femenino" className="text-slate-900">Femenino</option>
          </select>
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
