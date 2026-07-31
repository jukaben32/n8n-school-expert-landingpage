'use client'

import { useState } from 'react'

export interface SchoolComparisonRow {
  id: string
  name: string
  subdomain: string
  students: number
  staff: number
  morosidadPercent: number
  asistenciaPercent: number | null
  aiMessagesWeek: number
}

type SortKey = 'name' | 'students' | 'staff' | 'morosidadPercent' | 'asistenciaPercent' | 'aiMessagesWeek'

const columns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Colegio' },
  { key: 'students', label: 'Estudiantes' },
  { key: 'staff', label: 'Staff' },
  { key: 'morosidadPercent', label: '% Morosidad' },
  { key: 'asistenciaPercent', label: 'Asistencia (30d)' },
  { key: 'aiMessagesWeek', label: 'Uso IA (7d)' },
]

export default function SchoolsComparisonTable({
  schools,
  enterSchoolAction,
}: {
  schools: SchoolComparisonRow[]
  enterSchoolAction: (schoolId: string) => Promise<void>
}) {
  const [sortKey, setSortKey] = useState<SortKey>('morosidadPercent')
  const [sortDesc, setSortDesc] = useState(true)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  const sorted = [...schools].sort((a, b) => {
    let aVal: string | number = a[sortKey] ?? -1
    let bVal: string | number = b[sortKey] ?? -1
    if (sortKey === 'name') {
      aVal = a.name.toLowerCase()
      bVal = b.name.toLowerCase()
      return sortDesc ? bVal.toString().localeCompare(aVal.toString()) : aVal.toString().localeCompare(bVal.toString())
    }
    return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number)
  })

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-accent-light transition"
                >
                  {col.label}
                  {sortKey === col.key && <span aria-hidden="true">{sortDesc ? '↓' : '↑'}</span>}
                </button>
              </th>
            ))}
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((school) => (
            <tr key={school.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900 dark:text-white">{school.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">/{school.subdomain}</p>
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{school.students}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{school.staff}</td>
              <td className="px-4 py-3">
                <span className={`font-semibold ${school.morosidadPercent >= 30 ? 'text-red-600 dark:text-red-400' : school.morosidadPercent > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {school.morosidadPercent}%
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                {school.asistenciaPercent !== null ? `${school.asistenciaPercent}%` : '—'}
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{school.aiMessagesWeek}</td>
              <td className="px-4 py-3 text-right">
                <form action={enterSchoolAction.bind(null, school.id)}>
                  <button
                    type="submit"
                    className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
                  >
                    Entrar como director
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
