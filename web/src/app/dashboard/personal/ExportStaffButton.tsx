'use client'

/**
 * Descargar el listado de personal e imprimirlo.
 *
 * El colegio lleva su "Lista de Profesores" en papel (nombre, curso,
 * teléfono). Esto permite sacar la misma lista desde el sistema, que ya es
 * la fuente real, sin tener que copiarla a mano.
 *
 * Todo ocurre en el navegador con los datos que la página ya cargó: no
 * consulta nada nuevo ni pasa por el servidor.
 */
export default function ExportStaffButton({
  filas,
}: {
  filas: { nombre: string; puesto: string; telefono: string; correo: string; grados: string; acceso: string }[]
}) {
  function descargarCSV() {
    const encabezados = ['Nombre', 'Puesto', 'Teléfono', 'Correo', 'Grados asignados', 'Acceso al sistema']
    // Se escapan las comillas dobles duplicándolas, como manda el formato CSV.
    const escapar = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
    const lineas = [
      encabezados.map(escapar).join(','),
      ...filas.map((f) => [f.nombre, f.puesto, f.telefono, f.correo, f.grados, f.acceso].map(escapar).join(',')),
    ]
    // El BOM al inicio hace que Excel abra bien los acentos y la ñ.
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `personal-${new Date().toISOString().slice(0, 10)}.csv`
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
        Descargar lista
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2.5 hover:bg-slate-50 transition"
      >
        Imprimir
      </button>
    </div>
  )
}
