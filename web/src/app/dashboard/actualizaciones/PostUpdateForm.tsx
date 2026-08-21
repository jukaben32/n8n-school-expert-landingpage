'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { createClassUpdateAction } from './actions'

interface Student { id: string; name: string }
type ImageConsentStatus = 'no_autorizado' | 'pendiente'

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary'

const statusLabel: Record<ImageConsentStatus, string> = {
  no_autorizado: 'NO autorizó el uso de imagen',
  pendiente: 'todavía no ha respondido la autorización de imagen',
}

export default function PostUpdateForm({
  students,
  gradeLevelOptions,
  studentsByGrade = {},
  restrictedStudents = {},
}: {
  students: Student[]
  gradeLevelOptions: string[]
  studentsByGrade?: Record<string, Student[]>
  restrictedStudents?: Record<string, ImageConsentStatus>
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [targetMode, setTargetMode] = useState<'student' | 'grade'>('student')
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [gradeLevel, setGradeLevel] = useState(gradeLevelOptions[0] ?? '')
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona una foto.')
      return
    }
    if (targetMode === 'student' && !studentId) {
      setError('Elige un estudiante.')
      return
    }
    if (targetMode === 'grade' && !gradeLevel.trim()) {
      setError('Escribe o elige un grado/sección.')
      return
    }

    setPosting(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('caption', caption)
    if (targetMode === 'student') formData.append('studentId', studentId)
    else formData.append('gradeLevel', gradeLevel)

    const result = await createClassUpdateAction(formData)
    setPosting(false)

    if (!result.ok) {
      setError(result.error ?? 'No se pudo publicar.')
      return
    }

    setCaption('')
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTargetMode('student')}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            targetMode === 'student' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Un estudiante
        </button>
        <button
          type="button"
          onClick={() => setTargetMode('grade')}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            targetMode === 'grade' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Todo un grado/sección
        </button>
      </div>

      {targetMode === 'student' ? (
        <>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputClass}>
            {students.length === 0 && <option value="">No hay estudiantes</option>}
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {restrictedStudents[studentId] && (
            <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-400">
              ⚠️ Este estudiante <strong>{statusLabel[restrictedStudents[studentId]]}</strong> (Ley 136-03). No publiques una foto donde se le identifique de frente.
            </p>
          )}
        </>
      ) : (
        <>
          <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={inputClass}>
            {gradeLevelOptions.length === 0 && <option value="">No hay grados/secciones disponibles</option>}
            {gradeLevelOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {(() => {
            const restrictedInGrade = (studentsByGrade[gradeLevel] ?? []).filter((s) => restrictedStudents[s.id])
            if (restrictedInGrade.length === 0) return null
            return (
              <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-400">
                ⚠️ En este grado, estos estudiantes no tienen autorización de imagen vigente (Ley 136-03) — no deben aparecer identificables de frente:
                <ul className="mt-1 list-disc list-inside">
                  {restrictedInGrade.map((s) => (
                    <li key={s.id}>{s.name} <span className="opacity-70">({statusLabel[restrictedStudents[s.id]]})</span></li>
                  ))}
                </ul>
              </div>
            )
          })()}
        </>
      )}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={2}
        placeholder="¿Qué estuvo haciendo hoy? (opcional)"
        className={`${inputClass} resize-none`}
      />

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
          <Camera className="w-3.5 h-3.5" />
          {preview ? 'Cambiar foto' : 'Elegir foto'}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
        </label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
        )}
      </div>

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={posting}
        className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 text-sm transition shadow-glow disabled:opacity-60"
      >
        {posting ? 'Publicando…' : 'Publicar'}
      </button>
    </form>
  )
}
