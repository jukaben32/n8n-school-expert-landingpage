'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MESSAGE_CATEGORY_LABELS, type MessageCategory } from '@/lib/messaging/categoryAccess'

interface MessageCardProps {
  id: string
  title: string
  body: string
  priority: 'normal' | 'urgent'
  publishedAt: string | null
  audienceLabel: string | null
  category: MessageCategory
  imageUrl: string | null
  isRead: boolean
  isStaff: boolean
  currentUserId: string
}

/**
 * MessageCard — Tarjeta de comunicado con funcionalidad de "marcar como leído".
 * La lectura se registra en Supabase (tabla message_reads) al hacer clic.
 */
export default function MessageCard({
  id, title, body, priority, publishedAt, audienceLabel, category, imageUrl, isRead, isStaff, currentUserId
}: MessageCardProps) {
  const [read, setRead] = useState(isRead)
  const [expanded, setExpanded] = useState(false)

  // Formatea la fecha de publicación en español
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString('es-DO', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      })
    : 'Borrador'

  async function markAsRead() {
    if (read) return
    const supabase = createClient()
    await supabase.from('message_reads').upsert({
      message_id: id,
      user_id: currentUserId,
    })
    setRead(true)
  }

  async function handleExpand() {
    setExpanded((v) => !v)
    // Marcar como leído al expandir el mensaje
    if (!expanded) await markAsRead()
  }

  return (
    <article
      id={`comunicado-${id}`}
      className={`rounded-2xl border transition ${
        priority === 'urgent'
          ? 'border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-900/10'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      }`}
    >
      {/* Cabecera del comunicado */}
      <button
        onClick={handleExpand}
        className="w-full flex items-start gap-4 p-4 text-left"
        aria-expanded={expanded}
      >
        {/* Indicador de lectura */}
        <div className="mt-1 shrink-0">
          {read ? (
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" title="Leído" />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-primary dark:bg-accent animate-pulse" title="No leído" />
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {priority === 'urgent' && (
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                Urgente
              </span>
            )}
            {category !== 'regular' && (
              <span className="text-xs font-semibold text-accent-dark dark:text-accent-light bg-accent/10 px-2 py-0.5 rounded-full">
                {MESSAGE_CATEGORY_LABELS[category]}
              </span>
            )}
            {isStaff && audienceLabel && (
              <span className="text-xs font-semibold text-dash-accent bg-primary/10 dark:bg-accent/10 px-2 py-0.5 rounded-full">
                Para: {audienceLabel}
              </span>
            )}
            <h3 className={`text-sm font-semibold truncate ${!read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
              {title}
            </h3>
            {imageUrl && <span aria-hidden="true" title="Incluye imagen">🖼️</span>}
          </div>
          {/* suppressHydrationWarning: el formato "short" de dia/mes puede variar
              entre el motor ICU del servidor y el del navegador */}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" suppressHydrationWarning>{dateStr}</p>
        </div>

        {/* Ícono expandir */}
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Cuerpo expandido */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              className="w-full max-h-[32rem] object-contain rounded-xl border border-slate-200 dark:border-slate-800 mb-3"
            />
          )}
          {body && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {body}
            </p>
          )}

          {/* Botón "Confirmar lectura" para padres */}
          {!isStaff && (
            <div className="mt-4 flex items-center gap-2">
              {read ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Lectura confirmada
                </span>
              ) : (
                <button
                  id={`btn-confirmar-lectura-${id}`}
                  onClick={markAsRead}
                  className="text-xs font-semibold text-dash-accent hover:underline"
                >
                  Confirmar lectura
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
