'use client'

interface Props {
  fileName: string
  header: string[]
  rows: string[][]
}

// Excel en español espera ";" como separador y un BOM para leer bien las tildes.
function toCsv(header: string[], rows: string[][]) {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

export default function ListadoActions({ fileName, header, rows }: Props) {
  function download() {
    const blob = new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
      >
        Imprimir / PDF
      </button>
      <button
        type="button"
        onClick={download}
        className="text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
      >
        Descargar Excel
      </button>
    </div>
  )
}
