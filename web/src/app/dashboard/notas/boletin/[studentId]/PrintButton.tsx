'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
    >
      🖨️ Imprimir / Guardar PDF
    </button>
  )
}
