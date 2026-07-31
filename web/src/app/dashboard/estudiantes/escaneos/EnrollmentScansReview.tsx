'use client'

import { useState } from 'react'
import {
  confirmEnrollmentScan,
  getEnrollmentScanSignedUrl,
  listPendingEnrollmentScans,
  rejectEnrollmentScan,
  uploadEnrollmentScans,
  type PendingEnrollmentScan,
} from './actions'
import type { SubmitNewStudentInput } from '../nuevo/actions'
import type { GuardianRelationship } from '@/lib/students/createStudentWithFamily'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

const relationshipLabels: Record<string, string> = {
  madre: 'Madre', padre: 'Padre', tutor_legal: 'Tutor legal', otro: 'Otro',
}

interface DraftGuardian {
  key: string
  firstName: string
  lastName: string
  phone: string
  email: string
  relationship: GuardianRelationship
  nationalId: string
  address: string
  originProvince: string
  nationality: string
}

interface DraftReview {
  firstName: string
  lastName: string
  birthDate: string
  birthPlace: string
  gradeLevel: string
  studentCode: string
  healthNotes: string
  familyName: string
  emergencyName: string
  emergencyPhone: string
  emergencyRelationship: string
  guardians: DraftGuardian[]
}

function draftFromScan(scan: PendingEnrollmentScan): DraftReview {
  const d = scan.extracted_data
  const guardians: DraftGuardian[] = (d?.tutores ?? []).map((t, i) => ({
    key: `${scan.id}-${i}`,
    firstName: t.nombre ?? '',
    lastName: t.apellido ?? '',
    phone: t.telefono ?? '',
    email: '',
    relationship: t.parentesco ?? 'otro',
    nationalId: t.cedula ?? '',
    address: t.direccion ?? '',
    originProvince: t.provincia_origen ?? '',
    nationality: t.nacionalidad ?? '',
  }))

  return {
    firstName: d?.estudiante.nombre ?? '',
    lastName: d?.estudiante.apellido ?? '',
    birthDate: d?.estudiante.fecha_nacimiento ?? '',
    birthPlace: d?.estudiante.lugar_nacimiento ?? '',
    gradeLevel: d?.estudiante.curso ?? '',
    studentCode: d?.estudiante.matricula ?? '',
    healthNotes: d?.estudiante.historial_salud ?? '',
    familyName: d?.estudiante.apellido ? `Familia ${d.estudiante.apellido}` : '',
    emergencyName: d?.contacto_emergencia.nombre ?? '',
    emergencyPhone: d?.contacto_emergencia.telefono ?? '',
    emergencyRelationship: d?.contacto_emergencia.parentesco ?? '',
    guardians: guardians.length > 0 ? guardians : [emptyGuardian(`${scan.id}-0`)],
  }
}

function emptyGuardian(key: string): DraftGuardian {
  return { key, firstName: '', lastName: '', phone: '', email: '', relationship: 'madre', nationalId: '', address: '', originProvince: '', nationality: '' }
}

export default function EnrollmentScansReview({ initialScans }: { initialScans: PendingEnrollmentScan[] }) {
  const [scans, setScans] = useState(initialScans)
  const [uploadMode, setUploadMode] = useState<'files' | 'multiPagePdf'>('files')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [openScanId, setOpenScanId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftReview>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<{ id: string; url: string } | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function refreshScans() {
    setScans(await listPendingEnrollmentScans())
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    setUploadNotice(null)
    const form = e.currentTarget
    const files = (form.elements.namedItem('file') as HTMLInputElement)?.files
    if (!files || files.length === 0) {
      setUploadError('Selecciona al menos un archivo.')
      return
    }

    const formData = new FormData()
    formData.set('mode', uploadMode)
    for (const file of Array.from(files)) formData.append('file', file)

    setUploading(true)
    const result = await uploadEnrollmentScans(formData)
    setUploading(false)

    if (!result.ok) {
      setUploadError(result.error)
      return
    }
    setUploadNotice(`Se procesaron ${result.created} ficha(s). Revísalas abajo antes de confirmar.`)
    form.reset()
    await refreshScans()
  }

  function toggleOpen(scan: PendingEnrollmentScan) {
    if (openScanId === scan.id) {
      setOpenScanId(null)
      return
    }
    setOpenScanId(scan.id)
    setDrafts((prev) => (prev[scan.id] ? prev : { ...prev, [scan.id]: draftFromScan(scan) }))
  }

  function updateDraft(scanId: string, patch: Partial<DraftReview>) {
    setDrafts((prev) => ({ ...prev, [scanId]: { ...prev[scanId], ...patch } }))
  }

  function updateGuardian(scanId: string, key: string, patch: Partial<DraftGuardian>) {
    setDrafts((prev) => ({
      ...prev,
      [scanId]: { ...prev[scanId], guardians: prev[scanId].guardians.map((g) => (g.key === key ? { ...g, ...patch } : g)) },
    }))
  }

  function addGuardian(scanId: string) {
    setDrafts((prev) => ({ ...prev, [scanId]: { ...prev[scanId], guardians: [...prev[scanId].guardians, emptyGuardian(`${scanId}-${Date.now()}`)] } }))
  }

  function removeGuardian(scanId: string, key: string) {
    setDrafts((prev) => {
      const draft = prev[scanId]
      if (draft.guardians.length <= 1) return prev
      return { ...prev, [scanId]: { ...draft, guardians: draft.guardians.filter((g) => g.key !== key) } }
    })
  }

  async function handlePreview(scanId: string) {
    const url = await getEnrollmentScanSignedUrl(scanId)
    if (!url) return
    setPreviewUrl({ id: scanId, url })
  }

  async function handleConfirm(scan: PendingEnrollmentScan) {
    const draft = drafts[scan.id]
    if (!draft) return
    setConfirmError(null)

    if (!draft.firstName || !draft.lastName || !draft.birthDate) {
      setConfirmError('Completa al menos nombre, apellido y fecha de nacimiento del estudiante.')
      return
    }
    for (const g of draft.guardians) {
      if (!g.firstName || !g.lastName || !g.phone) {
        setConfirmError('Completa nombre, apellido y teléfono de cada tutor.')
        return
      }
    }

    const input: SubmitNewStudentInput = {
      mode: 'new',
      student: {
        firstName: draft.firstName,
        lastName: draft.lastName,
        birthDate: draft.birthDate,
        enrollmentStatus: 'inscrito',
        birthPlace: draft.birthPlace || null,
        gradeLevel: draft.gradeLevel || null,
        studentCode: draft.studentCode || null,
        healthNotes: draft.healthNotes || null,
        emergencyContact:
          draft.emergencyName || draft.emergencyPhone
            ? { nombre: draft.emergencyName || null, telefono: draft.emergencyPhone || null, parentesco: draft.emergencyRelationship || null }
            : null,
      },
      familyName: draft.familyName || `Familia ${draft.lastName}`,
      guardians: draft.guardians.map((g) => ({
        firstName: g.firstName,
        lastName: g.lastName,
        phone: g.phone,
        email: g.email || null,
        relationship: g.relationship,
        nationalId: g.nationalId || null,
        address: g.address || null,
        originProvince: g.originProvince || null,
        nationality: g.nationality || null,
      })),
    }

    setBusyId(scan.id)
    const result = await confirmEnrollmentScan(scan.id, input)
    setBusyId(null)
    if (!result.ok) {
      setConfirmError(result.error ?? 'No se pudo confirmar la ficha.')
      return
    }
    setScans((prev) => prev.filter((s) => s.id !== scan.id))
    setOpenScanId(null)
  }

  async function handleReject(scanId: string) {
    setBusyId(scanId)
    const result = await rejectEnrollmentScan(scanId, rejectReason)
    setBusyId(null)
    if (!result.ok) {
      setConfirmError(result.error ?? 'No se pudo rechazar la ficha.')
      return
    }
    setScans((prev) => prev.filter((s) => s.id !== scanId))
    setRejectingId(null)
    setRejectReason('')
  }

  return (
    <div className="space-y-6">
      {/* Subida */}
      <form onSubmit={handleUpload} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setUploadMode('files')}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${uploadMode === 'files' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            Varias fotos/PDFs sueltos
          </button>
          <button type="button" onClick={() => setUploadMode('multiPagePdf')}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${uploadMode === 'multiPagePdf' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            Un PDF con varias fichas
          </button>
        </div>

        <div>
          <label htmlFor="file" className={labelClass}>
            {uploadMode === 'files' ? 'Selecciona una o varias fichas (imagen o PDF por ficha)' : 'Selecciona el PDF escaneado (una ficha por página)'}
          </label>
          <input
            id="file"
            name="file"
            type="file"
            multiple={uploadMode === 'files'}
            accept={uploadMode === 'files' ? 'image/jpeg,image/png,image/webp,application/pdf' : 'application/pdf'}
            className={inputClass}
          />
        </div>

        {uploadError && (
          <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {uploadError}
          </div>
        )}
        {uploadNotice && (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            {uploadNotice}
          </div>
        )}

        <button type="submit" disabled={uploading}
          className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 text-sm transition shadow-glow disabled:opacity-60">
          {uploading ? 'Procesando con IA...' : 'Subir y extraer datos'}
        </button>
      </form>

      {/* Bandeja de revisión */}
      {confirmError && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {confirmError}
        </div>
      )}

      {scans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📄</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">No hay fichas pendientes de revisión.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => {
            const draft = drafts[scan.id]
            const isOpen = openScanId === scan.id
            const confidencePct = scan.confidence != null ? Math.round(scan.confidence * 100) : null
            return (
              <article key={scan.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {scan.extracted_data?.estudiante.nombre ?? '(sin nombre legible)'} {scan.extracted_data?.estudiante.apellido ?? ''}
                      {scan.source_page ? ` — página ${scan.source_page}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(scan.created_at).toLocaleString('es-DO')}</p>
                    {scan.extraction_error && (
                      <p className="text-xs text-red-500 mt-1">No se pudo leer automáticamente: {scan.extraction_error}</p>
                    )}
                  </div>
                  {confidencePct != null && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${confidencePct >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {confidencePct}% de confianza
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handlePreview(scan.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                    Ver ficha original
                  </button>
                  <button type="button" onClick={() => toggleOpen(scan)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent-light hover:bg-primary/20 transition">
                    {isOpen ? 'Ocultar' : 'Revisar y confirmar'}
                  </button>
                  <button type="button" onClick={() => setRejectingId(rejectingId === scan.id ? null : scan.id)} disabled={busyId === scan.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60">
                    Descartar
                  </button>
                </div>

                {previewUrl?.id === scan.id && (
                  <a href={previewUrl.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary dark:text-accent-light underline">
                    Abrir ficha original en una pestaña nueva (enlace válido por 5 minutos)
                  </a>
                )}

                {rejectingId === scan.id && (
                  <div className="flex gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo (opcional)" className={inputClass} />
                    <button type="button" onClick={() => handleReject(scan.id)} disabled={busyId === scan.id}
                      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60">
                      Confirmar
                    </button>
                  </div>
                )}

                {isOpen && draft && (
                  <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Estudiante</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={labelClass}>Nombre</label><input className={inputClass} value={draft.firstName} onChange={(e) => updateDraft(scan.id, { firstName: e.target.value })} /></div>
                        <div><label className={labelClass}>Apellido</label><input className={inputClass} value={draft.lastName} onChange={(e) => updateDraft(scan.id, { lastName: e.target.value })} /></div>
                        <div><label className={labelClass}>Fecha de nacimiento</label><input type="date" className={inputClass} value={draft.birthDate} onChange={(e) => updateDraft(scan.id, { birthDate: e.target.value })} /></div>
                        <div><label className={labelClass}>Lugar de nacimiento</label><input className={inputClass} value={draft.birthPlace} onChange={(e) => updateDraft(scan.id, { birthPlace: e.target.value })} /></div>
                        <div><label className={labelClass}>Curso</label><input className={inputClass} value={draft.gradeLevel} onChange={(e) => updateDraft(scan.id, { gradeLevel: e.target.value })} /></div>
                        <div><label className={labelClass}>Matrícula</label><input className={inputClass} value={draft.studentCode} onChange={(e) => updateDraft(scan.id, { studentCode: e.target.value })} /></div>
                        <div className="col-span-2"><label className={labelClass}>Historial de salud</label><textarea className={inputClass} rows={2} value={draft.healthNotes} onChange={(e) => updateDraft(scan.id, { healthNotes: e.target.value })} /></div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Familia</p>
                      <div><label className={labelClass}>Apellido / nombre de la familia</label><input className={inputClass} value={draft.familyName} onChange={(e) => updateDraft(scan.id, { familyName: e.target.value })} /></div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Padres / tutores</p>
                      {draft.guardians.map((g, i) => (
                        <div key={g.key} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{i === 0 ? 'Tutor principal' : `Tutor ${i + 1}`}</span>
                            {draft.guardians.length > 1 && (
                              <button type="button" onClick={() => removeGuardian(scan.id, g.key)} className="text-xs text-red-500 hover:text-red-600">Quitar</button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className={labelClass}>Nombre</label><input className={inputClass} value={g.firstName} onChange={(e) => updateGuardian(scan.id, g.key, { firstName: e.target.value })} /></div>
                            <div><label className={labelClass}>Apellido</label><input className={inputClass} value={g.lastName} onChange={(e) => updateGuardian(scan.id, g.key, { lastName: e.target.value })} /></div>
                            <div><label className={labelClass}>Teléfono</label><input className={inputClass} value={g.phone} onChange={(e) => updateGuardian(scan.id, g.key, { phone: e.target.value })} /></div>
                            <div><label className={labelClass}>Correo (opcional)</label><input type="email" className={inputClass} value={g.email} onChange={(e) => updateGuardian(scan.id, g.key, { email: e.target.value })} /></div>
                            <div><label className={labelClass}>Cédula</label><input className={inputClass} value={g.nationalId} onChange={(e) => updateGuardian(scan.id, g.key, { nationalId: e.target.value })} /></div>
                            <div>
                              <label className={labelClass}>Parentesco</label>
                              <select className={inputClass} value={g.relationship} onChange={(e) => updateGuardian(scan.id, g.key, { relationship: e.target.value as GuardianRelationship })}>
                                {Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </div>
                            <div className="col-span-2"><label className={labelClass}>Dirección</label><input className={inputClass} value={g.address} onChange={(e) => updateGuardian(scan.id, g.key, { address: e.target.value })} /></div>
                            <div><label className={labelClass}>Provincia de origen</label><input className={inputClass} value={g.originProvince} onChange={(e) => updateGuardian(scan.id, g.key, { originProvince: e.target.value })} /></div>
                            <div><label className={labelClass}>Nacionalidad</label><input className={inputClass} value={g.nationality} onChange={(e) => updateGuardian(scan.id, g.key, { nationality: e.target.value })} /></div>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => addGuardian(scan.id)}
                        className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-primary/40 transition">
                        + Agregar otro padre/madre/tutor
                      </button>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Contacto de emergencia</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className={labelClass}>Nombre</label><input className={inputClass} value={draft.emergencyName} onChange={(e) => updateDraft(scan.id, { emergencyName: e.target.value })} /></div>
                        <div><label className={labelClass}>Teléfono</label><input className={inputClass} value={draft.emergencyPhone} onChange={(e) => updateDraft(scan.id, { emergencyPhone: e.target.value })} /></div>
                        <div><label className={labelClass}>Parentesco</label><input className={inputClass} value={draft.emergencyRelationship} onChange={(e) => updateDraft(scan.id, { emergencyRelationship: e.target.value })} /></div>
                      </div>
                    </div>

                    <button type="button" onClick={() => handleConfirm(scan)} disabled={busyId === scan.id}
                      id={`btn-confirmar-ficha-${scan.id}`}
                      className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 text-sm transition shadow-glow disabled:opacity-60">
                      {busyId === scan.id ? 'Creando estudiante...' : 'Confirmar y crear estudiante'}
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
