'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Campana de notificaciones de la barra superior. Hoy agrega una sola
 * fuente real: conversaciones directas sin leer (mismo conteo que ya
 * usa el badge de "Mensajes" en el Sidebar) -- no es un centro de
 * notificaciones completo con lectura individual por ítem, eso sería
 * una función nueva más grande. Si el conteo es 0, el ícono se ve
 * apagado pero sigue siendo clickeable.
 */
export default function NotificationBell({ unreadMessagesCount }: { unreadMessagesCount: number }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative p-2 rounded-full text-dash-text-muted hover:bg-dash-surface hover:text-dash-text transition"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadMessagesCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-dash-danger-strong text-dash-danger-bg text-[9px] font-bold px-1">
            {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-dash-border bg-dash-surface-raised shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-dash-border">
            <p className="text-sm font-semibold text-dash-text">Notificaciones</p>
          </div>
          {unreadMessagesCount > 0 ? (
            <a
              href="/dashboard/mensajes"
              className="flex items-center gap-3 px-4 py-3 hover:bg-dash-surface transition"
            >
              <span aria-hidden="true">💬</span>
              <p className="text-sm text-dash-text">
                {unreadMessagesCount} conversación{unreadMessagesCount !== 1 ? 'es' : ''} sin responder
              </p>
            </a>
          ) : (
            <p className="px-4 py-4 text-sm text-dash-text-faint text-center">Sin novedades por ahora.</p>
          )}
        </div>
      )}
    </div>
  )
}
