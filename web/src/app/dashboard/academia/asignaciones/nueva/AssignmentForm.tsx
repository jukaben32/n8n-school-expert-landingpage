'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AcademiaScope } from '@/lib/academia/staffContext'
import { assignTask } from '../actions'

export default function AssignmentForm({ scopes, lessons, initialLesson, initialGrade, initialSubject }: { scopes: AcademiaScope[]; lessons: { id: string; title: string; grade_level: string; subject_id: string }[]; initialLesson?: string; initialGrade?:string; initialSubject?:string }) {
  const router = useRouter()
  const chosen = lessons.find(l => l.id === initialLesson)
  const [grade, setGrade] = useState(chosen?.grade_level ?? initialGrade ?? scopes[0]?.grade_level ?? '')
  const [subject, setSubject] = useState(chosen?.subject_id ?? initialSubject ?? scopes[0]?.subject_id ?? '')
  const [kind, setKind] = useState('library')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const subjects = scopes.filter(s => s.grade_level === grade)
  const available = lessons.filter(l => l.grade_level === grade && l.subject_id === subject)
  const field = 'w-full rounded-xl border border-slate-300 bg-white text-slate-900 p-3'
  return <form className="dash-card p-6 space-y-5" onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); setError('')
    try { const result = await assignTask(form); if (result.error) setError(result.error); else { router.push(`/dashboard/academia/asignaciones/${result.id}`); router.refresh() } }
    catch { setError('No se pudo asignar la tarea. Vuelve a intentarlo.') } finally { setSaving(false) }
  }}>
    <label className="block">Curso<select name="grade" className={field} value={grade} onChange={e => { const next=scopes.find(s => s.grade_level === e.target.value)?.subject_id ?? ''; setGrade(e.target.value); setSubject(next); router.push(`/dashboard/academia/asignaciones/nueva?${new URLSearchParams({curso:e.target.value,materia:next})}`) }}>
      {[...new Set(scopes.map(s => s.grade_level))].map(g => <option key={g}>{g}</option>)}
    </select></label>
    <label className="block">Materia<select name="subject" className={field} value={subject} onChange={e => {setSubject(e.target.value);router.push(`/dashboard/academia/asignaciones/nueva?${new URLSearchParams({curso:grade,materia:e.target.value})}`)}}>{subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}</select></label>
    <label className="block">Actividad<select name="kind" className={field} value={kind} onChange={e => setKind(e.target.value)}><option value="library">Video / cuestionario de la biblioteca</option><option value="manual">Tarea manual</option></select></label>
    {kind === 'library' ? <label className="block">Lección<select name="lesson" className={field} required defaultValue={chosen?.id}><option value="">Seleccionar lección</option>{available.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
      {!available.length && <p className="text-sm text-amber-700">No hay lecciones en esta selección. Busca en Biblioteca por curso y materia, o crea una tarea manual.</p>}
    </label> : <>
      <label className="block">Título<input name="title" className={field} required maxLength={200} /></label>
      <label className="block">Entrega<select name="mode" className={field}><option value="text">Respuesta escrita en el portal</option><option value="classroom">En cuaderno / revisión en clase</option></select></label>
    </>}
    <label className="block">Instrucciones {kind === 'library' ? '(opcionales)' : ''}<textarea name="instructions" rows={5} className={field} required={kind === 'manual'} maxLength={10000} /></label>
    <label className="block">Fecha de entrega (opcional)<input name="due" type="date" className={field} /></label>
    <p className="text-sm text-slate-500">Se asignará a los estudiantes inscritos actualmente en este curso y se avisará a sus tutores. El contenido queda disponible para repaso mientras la tarea siga activa.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={saving || !scopes.length} className="dash-btn-primary px-5 py-3">{saving ? 'Asignando…' : 'Asignar tarea'}</button>
  </form>
}
