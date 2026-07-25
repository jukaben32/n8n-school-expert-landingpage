'use client'

import { useState } from 'react'
import { exportSchoolData } from './exportActions'

export default function ExportDataButton({ schoolSubdomain }: { schoolSubdomain: string }) {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'error'>('idle')

  async function handleExport() {
    setStatus('exporting')
    const result = await exportSchoolData()
    if (!result.ok || !result.data) {
      setStatus('error')
      return
    }

    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schoolos-${schoolSubdomain}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setStatus('idle')
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
        Tus datos son tuyos
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
        Descarga toda la información de tu colegio — estudiantes, familias, personal, facturas,
        pagos, comunicados, asistencia y Academia — en un solo archivo. Puedes hacerlo cuando
        quieras, sin pedirle permiso a nadie.
      </p>
      <button
        type="button"
        onClick={handleExport}
        disabled={status === 'exporting'}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 12m0 0l4.5-4.5M12 12V3" />
        </svg>
        {status === 'exporting' ? 'Preparando descarga...' : 'Exportar mis datos'}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">No se pudo generar la exportación. Intenta de nuevo.</p>
      )}
    </div>
  )
}
