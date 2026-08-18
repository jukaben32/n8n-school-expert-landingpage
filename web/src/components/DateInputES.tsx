'use client'

import { useMemo } from 'react'

// Reemplaza <input type="date"> nativo -- el selector nativo del
// navegador se muestra en el idioma/formato del SISTEMA OPERATIVO de
// cada persona (MM/DD/AAAA si su navegador está en inglés), sin importar
// el lang="es" de la página -- eso no se puede forzar vía HTML/CSS en
// ningún navegador. Con Día/Mes/Año explícitos (mes por nombre, nunca por
// número) el orden queda inequívoco para todo el personal, sin importar
// la configuración de su navegador.
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface DateInputESProps {
  value: string // 'YYYY-MM-DD' o ''
  onChange: (value: string) => void
  id?: string
  required?: boolean
  fieldClassName?: string
}

export default function DateInputES({ value, onChange, id, required, fieldClassName }: DateInputESProps) {
  const [year, month, day] = useMemo(() => {
    const [y, m, d] = (value || '').split('-')
    return [y ?? '', m ?? '', d ?? '']
  }, [value])

  function update(newDay: string, newMonth: string, newYear: string) {
    if (newDay && newMonth && newYear && newYear.length === 4) {
      onChange(`${newYear}-${newMonth}-${newDay}`)
    } else {
      onChange('')
    }
  }

  const fieldClass =
    fieldClassName ??
    'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

  return (
    <div id={id} className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
      <select value={day} required={required} onChange={(e) => update(e.target.value, month, year)} className={fieldClass} aria-label="Día">
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select value={month} required={required} onChange={(e) => update(day, e.target.value, year)} className={fieldClass} aria-label="Mes">
        <option value="">Mes</option>
        {MESES.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>
      <input
        type="number"
        value={year}
        required={required}
        placeholder="Año"
        min={1900}
        max={2100}
        onChange={(e) => update(day, month, e.target.value)}
        className={fieldClass}
        aria-label="Año"
      />
    </div>
  )
}
