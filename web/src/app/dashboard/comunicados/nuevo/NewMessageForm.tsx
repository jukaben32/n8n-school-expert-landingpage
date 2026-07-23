'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NewMessageFormProps {
  schoolId: string
  authorProfileId: string
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

/**
 * NewMessageForm — Crea un comunicado en la tabla `messages`.
 * "Guardar borrador" deja published_at en null (solo visible para staff).
 * "Publicar ahora" establece published_at = now() (visible para familias).
 */
export default function NewMessageForm({ schoolId, authorProfileId }: NewMessageFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(publish: boolean) {
    setError(null)
    if (!title.trim() || !body.trim()) {
      setError('El título y el contenido son obligatorios.')
      return
    }
    setSaving(publish ? 'publish' : 'draft')

    const supabase = createClient()
    const { error: dbError } = await supabase.from('messages').insert({
      school_id: schoolId,
      author_id: authorProfileId,
      title: title.trim(),
      body: body.trim(),
      audience_type: 'all',
      priority,
      published_at: publish ? new Date().toISOString() : null,
    })

    if (dbError) {
      setError('No se pudo guardar el comunicado. Intenta de nuevo.')
      setSaving(null)
      return
    }

    router.push('/dashboard/comunicados')
    router.refresh()
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label htmlFor="title" className={labelClass}>Título</label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Suspensión de clases por lluvias"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="body" className={labelClass}>Contenido</label>
          <textarea
            id="body"
            required
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe el mensaje que recibirán las familias..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>Prioridad</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPriority('normal')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                priority === 'normal'
                  ? 'bg-primary text-white shadow-glow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setPriority('urgent')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                priority === 'urgent'
                  ? 'bg-orange-500 text-white shadow-glow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Urgente
            </button>
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
          type="button"
          id="btn-publicar-comunicado"
          disabled={saving !== null}
          onClick={() => handleSave(true)}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving === 'publish' ? 'Publicando...' : 'Publicar ahora'}
        </button>
        <button
          type="button"
          id="btn-guardar-borrador"
          disabled={saving !== null}
          onClick={() => handleSave(false)}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
        >
          {saving === 'draft' ? 'Guardando...' : 'Guardar borrador'}
        </button>
      </div>
    </form>
  )
}
