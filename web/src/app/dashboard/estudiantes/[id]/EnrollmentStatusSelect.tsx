'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const statusStyles: Record<string, string> = {
  prospecto:  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  inscrito:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  admitido:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  retirado:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function EnrollmentStatusSelect({ studentId, initialStatus }: { studentId: string; initialStatus: string | null }) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus ?? 'prospecto')
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    setStatus(newStatus)
    setSaving(true)
    const supabase = createClient()
    await supabase.from('students').update({ enrollment_status: newStatus }).eq('id', studentId)
    setSaving(false)
    router.refresh()
  }

  return (
    <select
      value={status}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      className={`text-xs font-bold uppercase tracking-wider rounded-full px-3 py-1.5 border-0 focus:outline-none focus:ring-2 focus:ring-primary ${statusStyles[status] ?? statusStyles.prospecto}`}
    >
      <option value="prospecto" className="text-slate-900 bg-white normal-case font-normal">Prospecto</option>
      <option value="solicitud" className="text-slate-900 bg-white normal-case font-normal">Solicitud</option>
      <option value="evaluacion" className="text-slate-900 bg-white normal-case font-normal">Evaluación</option>
      <option value="admitido" className="text-slate-900 bg-white normal-case font-normal">Admitido</option>
      <option value="inscrito" className="text-slate-900 bg-white normal-case font-normal">Inscrito</option>
      <option value="retirado" className="text-slate-900 bg-white normal-case font-normal">Retirado</option>
    </select>
  )
}
