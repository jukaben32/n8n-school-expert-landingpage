'use client'

/**
 * Descargar el listado de estudiantes (Excel/Google Sheets vía CSV) o
 * imprimirlo (el diálogo de impresión del navegador permite "Guardar como
 * PDF"). Mismo patrón que ExportStaffButton.tsx en Personal.
 *
 * Todo ocurre en el navegador con los datos que la página ya cargó -- no
 * consulta nada nuevo ni pasa por el servidor, y respeta el filtro de curso
 * ya aplicado en la consulta.
 */
export default function ExportStudentsButton({
  filas,
  curso,
}: {
  filas: { nombre: string; curso: string; familia: string; nacimiento: string; estado: string }[]
  curso?: string
}) {
  function nombreArchivo(extension: string) {
    const cursoSlug = curso
      ? curso
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      : 'todos'
    return `estudiantes-${cursoSlug}-${new Date().toISOString().slice(0, 10)}.${extension}`
  }

  function descargarCSV() {
    const encabezados = ['Nombre', 'Curso', 'Familia', 'Nacimiento', 'Estado']
    // Se escapan las comillas dobles duplicándolas, como manda el formato CSV.
    const escapar = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
    const lineas = [
      encabezados.map(escapar).join(','),
      ...filas.map((f) => [f.nombre, f.curso, f.familia, f.nacimiento, f.estado].map(escapar).join(',')),
    ]
    // El BOM al inicio hace que Excel abra bien los acentos y la ñ.
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo('csv')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={descargarCSV}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2.5 hover:bg-slate-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 12m0 0l4.5-4.5M12 12V3" />
        </svg>
        Descargar Excel
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2.5 hover:bg-slate-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.32 0a41.94 41.94 0 00-11.32 0m11.32 0l-.001-.001M6.34 18l-.001.001M6.75 8.25V4.5a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v3.75m-10.5 0h10.5m-10.5 0a2.25 2.25 0 00-2.25 2.25v4.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25v-4.5a2.25 2.25 0 00-2.25-2.25" />
        </svg>
        Imprimir / PDF
      </button>
    </div>
  )
}
