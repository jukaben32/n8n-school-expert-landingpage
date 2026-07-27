'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Family { id: string; name: string }

interface NewStudentFormProps {
  schoolId: string
  families: Family[]
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

/**
 * NewStudentForm — Formulario de alta de estudiante.
 * Modo "familia existente": solo crea el registro en `students`.
 * Modo "familia nueva": crea `families` + `guardians` (tutor principal)
 * + `students` + el vínculo en `student_guardians`, en ese orden.
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

  // Familia nueva + tutor principal
  const [familyName, setFamilyName] = useState('')
  const [guardianFirstName, setGuardianFirstName] = useState('')
  const [guardianLastName, setGuardianLastName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianRelationship, setGuardianRelationship] = useState('madre')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'existing' && !familyId) {
      setError('Selecciona una familia.')
      return
    }
    if (mode === 'new' && (!familyName || !guardianFirstName || !guardianLastName || !guardianPhone)) {
      setError('Completa el nombre de la familia y los datos del tutor principal.')
      return
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

        // 2. Crear el tutor principal
        const { data: newGuardian, error: guardianError } = await supabase
          .from('guardians')
          .insert({
            school_id: schoolId,
            family_id: targetFamilyId,
            first_name: guardianFirstName,
            last_name: guardianLastName,
            phone: guardianPhone,
            email: guardianEmail || null,
            relationship: guardianRelationship,
            is_primary: true,
          })
          .select('id')
          .single()
        if (guardianError || !newGuardian) throw guardianError ?? new Error('No se pudo crear el tutor.')

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

        // 4. Vincular estudiante <-> tutor
        const { error: linkError } = await supabase.from('student_guardians').insert({
          student_id: newStudent.id,
          guardian_id: newGuardian.id,
          relationship: guardianRelationship,
          is_primary: true,
        })
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

        // Vincular con el tutor principal de la familia existente -- este
        // paso faltaba por completo en este modo (no era intermitente).
        const { data: primaryGuardian } = await supabase
          .from('guardians')
          .select('id, relationship')
          .eq('family_id', targetFamilyId)
          .eq('is_primary', true)
          .maybeSingle()

        if (primaryGuardian) {
          const { error: linkError } = await supabase.from('student_guardians').insert({
            student_id: newStudent.id,
            guardian_id: primaryGuardian.id,
            relationship: primaryGuardian.relationship ?? 'tutor_legal',
            is_primary: true,
          })
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
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="familyName" className={labelClass}>Apellido / nombre de la familia</label>
              <input id="familyName" required value={familyName} onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Ej. Familia Pérez" className={inputClass} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Tutor principal
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gFirstName" className={labelClass}>Nombre</label>
                <input id="gFirstName" required value={guardianFirstName} onChange={(e) => setGuardianFirstName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="gLastName" className={labelClass}>Apellido</label>
                <input id="gLastName" required value={guardianLastName} onChange={(e) => setGuardianLastName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="gPhone" className={labelClass}>Teléfono</label>
                <input id="gPhone" required value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="+1 809 000 0000" className={inputClass} />
              </div>
              <div>
                <label htmlFor="gEmail" className={labelClass}>Correo (opcional)</label>
                <input id="gEmail" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label htmlFor="gRelationship" className={labelClass}>Parentesco</label>
                <select id="gRelationship" value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)} className={inputClass}>
                  <option value="madre">Madre</option>
                  <option value="padre">Padre</option>
                  <option value="tutor_legal">Tutor legal</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
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
