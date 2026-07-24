'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Note { id: string; note: string; created_at: string }

export default function LeadNotes({ leadId, notes }: { leadId: string; notes: Note[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(notes.length > 0)

  async function addNote() {
    if (!text.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('users_profiles').select('id').eq('auth_id', user.id).single()
      : { data: null }

    await supabase.from('lead_notes').insert({
      lead_id: leadId,
      author_id: profile?.id ?? null,
      note: text.trim(),
    })
    setText('')
    setSaving(false)
    router.refresh()
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-primary transition"
      >
        {open ? 'Ocultar notas' : `Notas (${notes.length})`}
      </button>

      {open && (
        <div className="mt-2.5 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="text-xs bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
              <p className="text-slate-600 dark:text-slate-300">{n.note}</p>
              <p className="text-slate-400 dark:text-slate-500 mt-1">{formatDate(n.created_at)}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote() } }}
              placeholder="Agregar una nota..."
              className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={addNote}
              disabled={saving || !text.trim()}
              className="text-xs font-semibold rounded-lg bg-primary text-white px-3 py-2 disabled:opacity-50"
            >
              {saving ? '...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
