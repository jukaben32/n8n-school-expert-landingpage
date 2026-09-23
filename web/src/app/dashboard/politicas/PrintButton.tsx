'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
    >
      🖨️ Imprimir / Guardar PDF
    </button>
  )
}
