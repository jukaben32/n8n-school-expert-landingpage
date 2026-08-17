'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function GradeLevelInput({ studentId, initialValue }: { studentId: string; initialValue: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    if (value === (initialValue ?? '')) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('students').update({ grade_level: value.trim() || null }).eq('id', studentId)
    setSaving(false)
    router.refresh()
  }

  return (
    <input
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Grado/sección — ej. Kinder A"
      className="text-xs font-semibold rounded-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
    />
  )
}
