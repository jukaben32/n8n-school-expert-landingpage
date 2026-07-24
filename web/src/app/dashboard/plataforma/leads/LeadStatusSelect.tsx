'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const statusStyles: Record<string, string> = {
  nuevo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  contactado: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  convertido: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  descartado: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export default function LeadStatusSelect({ leadId, initialStatus }: { leadId: string; initialStatus: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    setStatus(newStatus)
    setSaving(true)
    const supabase = createClient()
    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    setSaving(false)
    router.refresh()
  }

  return (
    <select
      value={status}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      className={`text-xs font-bold rounded-full px-2.5 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-primary ${statusStyles[status] ?? statusStyles.nuevo}`}
    >
      <option value="nuevo">Nuevo</option>
      <option value="contactado">Contactado</option>
      <option value="convertido">Convertido</option>
      <option value="descartado">Descartado</option>
    </select>
  )
}
