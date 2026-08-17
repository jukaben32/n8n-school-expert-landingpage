'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StartConversationForm({ families }: { families: { id: string; name: string }[] }) {
  const router = useRouter()
  const [familyId, setFamilyId] = useState('')

  if (families.length === 0) return null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (familyId) router.push(`/dashboard/mensajes/${familyId}`)
      }}
      className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
    >
      <select
        value={familyId}
        onChange={(e) => setFamilyId(e.target.value)}
        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Iniciar conversación con una familia…</option>
        {families.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!familyId}
        className="rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 text-sm transition disabled:opacity-60 shrink-0"
      >
        Escribir
      </button>
    </form>
  )
}
