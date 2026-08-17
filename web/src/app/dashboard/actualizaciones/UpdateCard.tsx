'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteClassUpdateAction } from './actions'

export default function UpdateCard({
  id, caption, photoUrl, targetLabel, createdAt,
}: {
  id: string
  caption: string | null
  photoUrl: string | null
  targetLabel: string
  createdAt: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteClassUpdateAction(id)
    if (!result.ok) setDeleting(false)
    else router.refresh()
  }

  const dateStr = new Date(createdAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden relative">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Eliminar"
        className="absolute top-2 right-2 z-10 rounded-full bg-black/40 hover:bg-red-600 text-white p-1.5 transition disabled:opacity-60"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <div className="aspect-square bg-slate-100 dark:bg-slate-800">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={caption ?? ''} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-primary dark:text-accent-light">{targetLabel}</p>
        {caption && <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{caption}</p>}
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">{dateStr}</p>
      </div>
    </div>
  )
}
