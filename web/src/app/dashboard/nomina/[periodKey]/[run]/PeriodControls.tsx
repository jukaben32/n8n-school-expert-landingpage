'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { notifyPeriodBatchAction, setPeriodPublishedAction } from '../../actions'

export default function PeriodControls({ periodKey, run, total, published, pendingNotify }: {
  periodKey: number
  run: string
  total: number
  published: number
  pendingNotify: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function publish(next: boolean) {
    const question = next
      ? `¿Publicar ${total - published} comprobantes? Cada empleado podrá verlos al entrar a "Mi nómina". Aún no se envía ningún correo.`
      : `¿Retirar la publicación de ${published} comprobantes? Dejarán de verse hasta que vuelva a publicarlos.`
    if (!window.confirm(question)) return
    setBusy(true); setMessage(null)
    try {
      const res = await setPeriodPublishedAction(periodKey, run, next)
      if (!res.ok) setMessage({ kind: 'error', text: res.error ?? 'No se pudo actualizar.' })
      else { setMessage({ kind: 'ok', text: next ? 'Publicado.' : 'Publicación retirada.' }); router.refresh() }
    } catch {
      setMessage({ kind: 'error', text: 'Falló la conexión (puede ser que la sesión venció o hubo una actualización). Recargue la página e intente de nuevo; no se guardó nada a medias.' })
    } finally { setBusy(false) }
  }

  async function notify() {
    if (!window.confirm(`¿Enviar el aviso por correo a ${pendingNotify} empleados? El correo NO lleva montos: solo les avisa que ya pueden entrar a "Mi nómina".`)) return
    setBusy(true); setMessage(null)
    let sent = 0
    const failed: string[] = []
    let attempted: string[] = []
    try {
      for (let guard = 0; guard < 30; guard++) {
        const res = await notifyPeriodBatchAction(periodKey, run, attempted)
        if (!res.ok) { setMessage({ kind: 'error', text: res.error ?? 'No se pudo enviar.' }); break }
        sent += res.sent
        failed.push(...res.failed.map((f) => `${f.name} (${f.reason})`))
        attempted = [...attempted, ...res.attemptedIds]
        setMessage({ kind: 'ok', text: `Enviando… ${sent} enviados${res.remaining > 0 ? `, faltan ${res.remaining}` : ''}.` })
        if (res.remaining <= 0 || res.attemptedIds.length === 0) break
      }
      setMessage({
        kind: failed.length > 0 ? 'error' : 'ok',
        text: `${sent} avisos enviados.${failed.length > 0 ? ` No se pudo avisar a: ${failed.join('; ')}.` : ''}`,
      })
      router.refresh()
    } catch {
      setMessage({ kind: 'error', text: 'Falló la conexión a mitad del envío. Recargue la página: los ya enviados quedan marcados y no se repiten.' })
    } finally { setBusy(false) }
  }

  const draftCount = total - published
  return (
    <div className="dash-card p-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || draftCount === 0} onClick={() => publish(true)} className="dash-btn-primary text-sm px-5 py-2.5 disabled:opacity-50">
          Publicar {draftCount > 0 ? `(${draftCount})` : ''}
        </button>
        <button type="button" disabled={busy || pendingNotify === 0} onClick={notify} className="dash-btn-primary text-sm px-5 py-2.5 disabled:opacity-50">
          Avisar por correo {pendingNotify > 0 ? `(${pendingNotify})` : ''}
        </button>
        <button type="button" disabled={busy || published === 0} onClick={() => publish(false)} className="rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 disabled:opacity-50">
          Retirar publicación
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>
        Orden: 1) revise los comprobantes (toque un nombre para verlo), 2) publique, 3) avise por correo. Un comprobante publicado no se puede editar.
      </p>
      {message && (
        <p role="status" className={`text-sm font-semibold ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{message.text}</p>
      )}
    </div>
  )
}
