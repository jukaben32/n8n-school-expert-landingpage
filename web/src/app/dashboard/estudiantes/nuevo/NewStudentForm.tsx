'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Family { id: string; name: string }

interface NewStudentFormProps {
  schoolId: string
  families: Family[]
}

interface DraftGuardian {
  key: string
  firstName: string
  lastName: string
  phone: string
  email: string
  relationship: string
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

const relationshipLabels: Record<string, string> = {
  madre: 'Madre', padre: 'Padre', tutor_legal: 'Tutor legal', otro: 'Otro',
}

function newGuardianDraft(relationship: string): DraftGuardian {
  return { key: crypto.randomUUID(), firstName: '', lastName: '', phone: '', email: '', relationship }
}

/**
 * NewStudentForm — Formulario de alta de estudiante.
 * Modo "familia existente": solo crea el registro en `students`, vinculado
 * al tutor principal ya existente de esa familia.
 * Modo "familia nueva": crea `families` + uno o VARIOS `guardians` (madre,
 * padre, tutor legal -- muchos niños viven con más de un responsable, o
 * con un tutor que no es ninguno de los dos padres) + `students` + los
 * vínculos correspondientes en `student_guardians`. El primero de la
 * lista queda marcado como tutor principal (is_primary).
 */
export default function NewStudentForm({ schoolId, families }: NewStudentFormProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'existing' | 'new'>(families.length > 0 ? 'existing' : 'new')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Datos del estudiante
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | 'O' | ''>('')
  const [enrollmentStatus, setEnrollmentStatus] = useState('inscrito')

  // Familia existente
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')

  // Familia nueva + uno o varios tutores
  const [familyName, setFamilyName] = useState('')
  const [guardians, setGuardians] = useState<DraftGuardian[]>([newGuardianDraft('madre')])

  function updateGuardian(key: string, patch: Partial<DraftGuardian>) {
    setGuardians((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)))
  }
  function addGuardian() {
    setGuardians((prev) => {
      const used = new Set(prev.map((g) => g.relationship))
      const next = !used.has('madre') ? 'madre' : !used.has('padre') ? 'padre' : 'tutor_legal'
      return prev.length >= 4 ? prev : [...prev, newGuardianDraft(next)]
    })
  }
  function removeGuardian(key: string) {
    setGuardians((prev) => (prev.length <= 1 ? prev : prev.filter((g) => g.key !== key)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'existing' && !familyId) {
      setError('Selecciona una familia.')
      return
    }
    if (mode === 'new') {
      if (!familyName) {
        setError('Completa el nombre de la familia.')
        return
      }
      for (const g of guardians) {
        if (!g.firstName || !g.lastName || !g.phone) {
          setError('Completa nombre, apellido y teléfono de cada tutor agregado.')
          return
        }
      }
    }

    setSaving(true)
    const supabase = createClient()

    try {
      let targetFamilyId = familyId

      if (mode === 'new') {
        // 1. Crear la familia
        const { data: newFamily, error: familyError } = await supabase
          .from('families')
          .insert({ school_id: schoolId, name: familyName })
          .select('id')
          .single()
        if (familyError || !newFamily) throw familyError ?? new Error('No se pudo crear la familia.')
        targetFamilyId = newFamily.id

        // 2. Crear el/los tutor(es) -- el primero de la lista queda como
        // tutor principal (is_primary), el resto se guarda igual pero sin
        // esa marca.
        const createdGuardians: { id: string; relationship: string; isPrimary: boolean }[] = []
        for (let i = 0; i < guardians.length; i++) {
          const g = guardians[i]
          const { data: newGuardian, error: guardianError } = await supabase
            .from('guardians')
            .insert({
              school_id: schoolId,
              family_id: targetFamilyId,
              first_name: g.firstName,
              last_name: g.lastName,
              phone: g.phone,
              email: g.email || null,
              relationship: g.relationship,
              is_primary: i === 0,
            })
            .select('id')
            .single()
          if (guardianError || !newGuardian) throw guardianError ?? new Error('No se pudo crear un tutor.')
          createdGuardians.push({ id: newGuardian.id, relationship: g.relationship, isPrimary: i === 0 })
        }

        // 3. Crear el estudiante
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert({
            school_id: schoolId,
            family_id: targetFamilyId,
            first_name: firstName,
            last_name: lastName,
            birth_date: birthDate,
            gender: gender || null,
            enrollment_status: enrollmentStatus,
          })
          .select('id')
          .single()
        if (studentError || !newStudent) throw studentError ?? new Error('No se pudo crear el estudiante.')

        // 4. Vincular al estudiante con TODOS los tutores creados
        const { error: linkError } = await supabase.from('student_guardians').insert(
          createdGuardians.map((g) => ({
            student_id: newStudent.id,
            guardian_id: g.id,
            relationship: g.relationship,
            is_primary: g.isPrimary,
          }))
        )
        if (linkError) throw linkError
      } else {
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert({
            school_id: schoolId,
            family_id: targetFamilyId,
            first_name: firstName,
            last_name: lastName,
            birth_date: birthDate,
            gender: gender || null,
            enrollment_status: enrollmentStatus,
          })
          .select('id')
          .single()
        if (studentError || !newStudent) throw studentError ?? new Error('No se pudo crear el estudiante.')

        // Vincular con TODOS los tutores ya existentes de esa familia, no
        // solo el principal -- si la familia tiene madre y padre
        // registrados, el nuevo hermano debe quedar ligado a ambos.
        const { data: existingGuardians } = await supabase
          .from('guardians')
          .select('id, relationship, is_primary')
          .eq('family_id', targetFamilyId)

        if (existingGuardians && existingGuardians.length > 0) {
          const { error: linkError } = await supabase.from('student_guardians').insert(
            existingGuardians.map((g) => ({
              student_id: newStudent.id,
              guardian_id: g.id,
              relationship: g.relationship ?? 'tutor_legal',
              is_primary: g.is_primary,
            }))
          )
          if (linkError) throw linkError
        }
      }

      router.push('/dashboard/estudiantes')
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || 'Ocurrió un error al guardar. Intenta de nuevo.'
      console.error('[nuevo estudiante]', err)
      setError(message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Selector de familia */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('existing')}
            disabled={families.length === 0}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === 'existing'
                ? 'bg-primary text-white shadow-glow'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Familia existente
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              mode === 'new'
                ? 'bg-primary text-white shadow-glow'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Familia nueva
          </button>
        </div>

        {mode === 'existing' ? (
          <div>
            <label htmlFor="family" className={labelClass}>Familia</label>
            <select
              id="family"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              className={inputClass}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              El estudiante quedará vinculado a todos los tutores ya registrados en esta familia.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="familyName" className={labelClass}>Apellido / nombre de la familia</label>
              <input id="familyName" required value={familyName} onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Ej. Familia Pérez" className={inputClass} />
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Padres / tutores — muchos estudiantes viven con más de uno
            </p>

            {guardians.map((g, i) => (
              <div key={g.key} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    {i === 0 ? 'Tutor principal' : `Tutor adicional ${i + 1}`}
                  </span>
                  {guardians.length > 1 && (
                    <button type="button" onClick={() => removeGuardian(g.key)} className="text-xs text-red-500 hover:text-red-600">
                      Quitar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`gFirstName-${g.key}`} className={labelClass}>Nombre</label>
                    <input id={`gFirstName-${g.key}`} required value={g.firstName} onChange={(e) => updateGuardian(g.key, { firstName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`gLastName-${g.key}`} className={labelClass}>Apellido</label>
                    <input id={`gLastName-${g.key}`} required value={g.lastName} onChange={(e) => updateGuardian(g.key, { lastName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`gPhone-${g.key}`} className={labelClass}>Teléfono</label>
                    <input id={`gPhone-${g.key}`} required value={g.phone} onChange={(e) => updateGuardian(g.key, { phone: e.target.value })}
                      placeholder="+1 809 000 0000" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`gEmail-${g.key}`} className={labelClass}>Correo (opcional)</label>
                    <input id={`gEmail-${g.key}`} type="email" value={g.email} onChange={(e) => updateGuardian(g.key, { email: e.target.value })} className={inputClass} />
                  </div>
                  <div className="col-span-2">
                    <label htmlFor={`gRelationship-${g.key}`} className={labelClass}>Parentesco</label>
                    <select id={`gRelationship-${g.key}`} value={g.relationship} onChange={(e) => updateGuardian(g.key, { relationship: e.target.value })} className={inputClass}>
                      {Object.entries(relationshipLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {guardians.length < 4 && (
              <button
                type="button"
                onClick={addGuardian}
                className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-primary/40 transition"
              >
                + Agregar otro padre/madre/tutor
              </button>
            )}
          </div>
        )}
      </div>

      {/* Datos del estudiante */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Datos del estudiante
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sFirstName" className={labelClass}>Nombre</label>
            <input id="sFirstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="sLastName" className={labelClass}>Apellido</label>
            <input id="sLastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="sBirthDate" className={labelClass}>Fecha de nacimiento</label>
            <input id="sBirthDate" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="sGender" className={labelClass}>Sexo</label>
            <select id="sGender" value={gender} onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'O' | '')} className={inputClass}>
              <option value="">Sin especificar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="O">Otro</option>
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="sStatus" className={labelClass}>Estado de inscripción</label>
            <select id="sStatus" value={enrollmentStatus} onChange={(e) => setEnrollmentStatus(e.target.value)} className={inputClass}>
              <option value="prospecto">Prospecto</option>
              <option value="solicitud">Solicitud</option>
              <option value="evaluacion">Evaluación</option>
              <option value="admitido">Admitido</option>
              <option value="inscrito">Inscrito</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          id="btn-guardar-estudiante"
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar estudiante'}
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
