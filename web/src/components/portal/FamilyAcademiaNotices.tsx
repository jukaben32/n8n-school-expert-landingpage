'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Notice = { id: string; student_id: string; lesson_id: string; assignment_id: string|null; students: { first_name: string }; lessons: { title: string } }

// Same protected endpoint in the portal and the bell; no arbitrary child IDs.
export default function FamilyAcademiaNotices({ compact = false, onCountChange }: { compact?: boolean; onCountChange?: (count: number) => void }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [count, setCount] = useState(0)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/family/academia-notifications', { cache: 'no-store', signal: controller.signal })
        if (response.status === 401) { setNotices([]); setCount(0); onCountChange?.(0); return }
        if (!response.ok) throw new Error('Notice fetch failed')
        const data = await response.json()
        setNotices(data.notices); setCount(data.count); onCountChange?.(data.count); setError(false)
      } catch { if (!controller.signal.aborted) setError(true) }
    }
    void load()
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [onCountChange])
  async function markRead(id: string) {
    try {
      const response = await fetch('/api/family/academia-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!response.ok) throw new Error('Acknowledgement failed')
      setNotices(rows => rows.filter(row => row.id !== id)); setCount(value => Math.max(0, value - 1))
      onCountChange?.(Math.max(0, count - 1))
    } catch { setError(true) }
  }
  // Colores explícitos para cada superficie: en el portal la tarjeta es
  // verde claro (texto verde oscuro, como el aviso ámbar de ausencias) y en
  // la campanita la tarjeta es oscura (textos claros del tema dash-*).
  // Nunca heredar: el color heredado cambia con el modo oscuro del teléfono.
  const tone = compact
    ? { title: 'text-dash-text', link: 'text-dash-accent-light', muted: 'text-dash-text-muted', error: 'text-dash-warning' }
    : { title: 'text-emerald-900', link: 'text-emerald-800', muted: 'text-slate-600', error: 'text-amber-800' }
  if (!count && !error) return compact ? <p className="px-4 py-3 text-sm text-dash-text-faint">Sin tareas nuevas por revisar.</p> : null
  return <section aria-label="Avisos de tareas" className={compact ? 'border-t border-white/10 p-4' : 'rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3'}>
    <h2 className={`font-semibold text-sm ${tone.title}`}>🎓 {count} aviso{count !== 1 ? 's' : ''} de tareas por revisar</h2>
    {error && <p role="alert" className={`text-xs ${tone.error}`}>No se pudo actualizar el aviso. Vuelve a intentarlo.</p>}
    <ul className="space-y-3 mt-3">
      {notices.map(n => <li key={n.id} className="text-sm">
        <Link className={`font-semibold underline underline-offset-2 ${tone.link}`} href={`/dashboard/portal-familiar/hijos/${n.student_id}/lecciones/${n.assignment_id ?? n.lesson_id}`}>{n.students.first_name}: {n.lessons.title}</Link>
        <button type="button" className={`block text-xs mt-1 underline ${tone.muted}`} onClick={() => void markRead(n.id)}>Marcar aviso como leído</button>
      </li>)}
    </ul>
    {!compact && <p className={`text-xs ${tone.muted}`}>Leer un aviso no completa la tarea. Tu hijo responde desde su cuenta.</p>}
  </section>
}
