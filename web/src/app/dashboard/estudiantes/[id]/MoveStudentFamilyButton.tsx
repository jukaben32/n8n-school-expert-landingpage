'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { moveStudentToFamilyAction, searchFamiliesForMoveAction, type FamilyOption } from './actions'

/**
 * "Cambiar de familia": pasa al estudiante a otra familia conservando su
 * ficha (y con ella asistencias y notas). Reemplaza el atajo de crearlo de
 * nuevo en la otra familia y borrar el viejo, que perdía el historial.
 */
export default function MoveStudentFamilyButton({
  studentId, fullName, currentFamilyId,
}: { studentId: string; fullName: string; currentFamilyId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FamilyOption[]>([])
  const [searching, setSearching] = useState(false)
  const [moving, setMoving] = useState(false)

  // Búsqueda con una pequeña pausa para no consultar en cada tecla.
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      const found = await searchFamiliesForMoveAction(query, currentFamilyId)
      if (!cancelled) {
        setResults(found)
        setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open, currentFamilyId])

  async function handleMove(family: FamilyOption) {
    const ok = confirm(
      `¿Pasar a ${fullName} a la familia ${family.name}?\n\n` +
      'Conserva su historial (asistencias, notas). Los tutores de la familia actual dejarán de verlo en el Portal Familiar. ' +
      'Las facturas ya emitidas se quedan donde se facturaron.'
    )
    if (!ok) return
    setMoving(true)
    const result = await moveStudentToFamilyAction(studentId, family.id)
    setMoving(false)
    alert(result.message)
    if (!result.ok) return
    setOpen(false)
    setQuery('')
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-primary dark:text-accent-light hover:underline"
      >
        ↔ Cambiar de familia
      </button>
    )
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Buscar la familia destino</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Apellidos de la familia, ej. Matos Montero"
        spellCheck={false}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {searching && <p className="text-xs text-slate-400">Buscando...</p>}
      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-slate-400">No se encontró ninguna familia con ese nombre.</p>
      )}
      <div className="space-y-1">
        {results.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={moving}
            onClick={() => handleMove(f)}
            className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
          >
            <span className="font-semibold text-slate-800 dark:text-slate-100">{f.name}</span>
            <span className="block text-xs text-slate-400 dark:text-slate-500">
              {f.tutor ?? 'Sin tutor'} · {f.studentCount} {f.studentCount === 1 ? 'estudiante' : 'estudiantes'}
            </span>
          </button>
        ))}
      </div>
      {moving && <p className="text-xs text-slate-500">Cambiando de familia...</p>}
    </div>
  )
}
