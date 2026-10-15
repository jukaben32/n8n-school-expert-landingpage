'use client'

import { useState } from 'react'
import Link from 'next/link'
import { importPayslipsAction, previewPayslipImportAction } from '../actions'

type Preview = Awaited<ReturnType<typeof previewPayslipImportAction>>

export default function ImportForm() {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [done, setDone] = useState(false)

  const connectionError = 'Falló la conexión (puede ser que la sesión venció o hubo una actualización). Recargue la página e intente de nuevo; no se guardó nada a medias.'

  async function review() {
    setBusy(true); setMessage(null); setDone(false)
    try {
      const res = await previewPayslipImportAction(text)
      setPreview(res)
      const initial: Record<string, string> = {}
      for (const p of res.people) if (!p.staffId && p.suggestedStaffId) initial[p.excelId] = p.suggestedStaffId
      setMapping(initial)
      if (!res.ok) setMessage({ kind: 'error', text: res.error ?? 'No se pudo revisar.' })
    } catch { setMessage({ kind: 'error', text: connectionError }) }
    finally { setBusy(false) }
  }

  async function save() {
    setBusy(true); setMessage(null)
    try {
      const res = await importPayslipsAction(text, mapping)
      if (!res.ok) { setMessage({ kind: 'error', text: res.error ?? 'No se pudo guardar.' }); return }
      setDone(true)
      setMessage({
        kind: 'ok',
        text: `${res.saved} comprobantes guardados como borrador.${res.skipped && res.skipped.length > 0 ? ` Omitidos: ${res.skipped.join('; ')}.` : ''}`,
      })
    } catch { setMessage({ kind: 'error', text: connectionError }) }
    finally { setBusy(false) }
  }

  const unmapped = preview?.people.filter((p) => !p.staffId && !mapping[p.excelId]) ?? []
  const canSave = !!preview?.ok && preview.errors.length === 0 && unmapped.length === 0 && !done

  return (
    <div className="space-y-5">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDone(false) }}
        rows={8}
        placeholder="Pegue aquí las filas copiadas de la hoja Cierres (columnas A a Z)…"
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-3 text-xs font-mono"
      />
      <button type="button" onClick={review} disabled={busy || text.trim() === ''} className="dash-btn-primary text-sm px-5 py-2.5 disabled:opacity-50">
        {busy ? 'Revisando…' : 'Revisar'}
      </button>

      {preview && preview.errors.length > 0 && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-1">
          <p className="font-semibold">Hay filas con errores. Corrija la hoja y vuelva a pegar:</p>
          {preview.errors.slice(0, 12).map((e) => <p key={e} className="text-xs">• {e}</p>)}
          {preview.errors.length > 12 && <p className="text-xs">… y {preview.errors.length - 12} más.</p>}
        </div>
      )}

      {preview?.ok && (
        <div className="dash-card p-5 space-y-4">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
            {preview.rowCount} comprobantes en: {preview.periods.map((p) => `${p.label} (${p.count})`).join(' · ')}
          </p>
          {preview.alreadyPublished.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--dash-warning)' }}>
              Ya hay comprobantes PUBLICADOS en {preview.alreadyPublished.join(', ')}: esos no se modifican (se omiten).
            </p>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--dash-text-muted)' }}>Quién es quién</p>
            {preview.people.map((p) => (
              <div key={p.excelId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-56 truncate" title={p.name}>{p.excelId} · {p.name}</span>
                {p.staffId ? (
                  <span className="text-xs font-semibold" style={{ color: 'var(--dash-accent)' }}>
                    ✓ {preview.staff.find((s) => s.id === p.staffId)?.name ?? 'vinculado'}
                  </span>
                ) : (
                  <select
                    value={mapping[p.excelId] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [p.excelId]: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-sm"
                  >
                    <option value="">— Elija el empleado —</option>
                    {preview.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={save} disabled={busy || !canSave} className="dash-btn-primary text-sm px-5 py-2.5 disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar como borrador'}
          </button>
          {unmapped.length > 0 && <p className="text-xs" style={{ color: 'var(--dash-warning)' }}>Falta elegir {unmapped.length} empleado(s).</p>}
        </div>
      )}

      {message && <p role="status" className={`text-sm font-semibold ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{message.text}</p>}
      {done && <Link href="/dashboard/nomina" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>Ir a publicar →</Link>}
    </div>
  )
}
