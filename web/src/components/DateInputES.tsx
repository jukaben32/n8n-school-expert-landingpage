'use client'

import { useEffect, useRef, useState } from 'react'

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

interface DateParts {
  day: string
  month: string
  year: string
}

function splitValue(value: string): DateParts {
  const [y, m, d] = (value || '').split('-')
  return { year: y ?? '', month: m ?? '', day: d ?? '' }
}

export default function DateInputES({ value, onChange, id, required, fieldClassName }: DateInputESProps) {
  // Estado propio para día/mes/año -- mientras la fecha está incompleta
  // (ej. ya se eligió el día pero falta el mes) no existe ningún string
  // 'YYYY-MM-DD' válido que reportarle al padre, así que ese estado
  // intermedio solo puede vivir aquí. Si este componente derivara todo
  // directamente de `value` (como antes), cada selección parcial hacía
  // onChange('') hacia el padre, que volvía con value='' y borraba la
  // selección que se acababa de hacer.
  const [parts, setParts] = useState<DateParts>(() => splitValue(value))
  const lastEmitted = useRef(value)

  // Resincroniza desde afuera solo cuando el cambio de `value` no vino de
  // este mismo componente (ej. se cargó un draft distinto, o se limpió el
  // formulario) -- así no se pisa una selección parcial en curso.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setParts(splitValue(value))
    }
  }, [value])

  function update(newDay: string, newMonth: string, newYear: string) {
    setParts({ day: newDay, month: newMonth, year: newYear })
    const complete = Boolean(newDay && newMonth && newYear && newYear.length === 4)
    const cleared = !newDay && !newMonth && !newYear
    if (complete) {
      const next = `${newYear}-${newMonth}-${newDay}`
      lastEmitted.current = next
      onChange(next)
    } else if (cleared) {
      lastEmitted.current = ''
      onChange('')
    }
  }

  const { day, month, year } = parts

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
