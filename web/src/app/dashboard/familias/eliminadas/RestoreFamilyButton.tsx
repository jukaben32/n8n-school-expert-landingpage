'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { restoreFamilyAction } from '../[id]/actions'

/** Botón para devolver una familia eliminada a los listados activos. */
export default function RestoreFamilyButton({ familyId, familyName }: { familyId: string; familyName: string }) {
  const router = useRouter()
  const [restoring, setRestoring] = useState(false)

  async function handleRestore() {
    if (!confirm(`¿Restaurar a la familia ${familyName}? Volverá a aparecer en los listados, con los hijos que se eliminaron junto con ella.`)) return

    setRestoring(true)
    try {
      const result = await restoreFamilyAction(familyId)
      if (!result.ok) {
        alert(result.message)
        return
      }
      router.refresh()
    } catch (err) {
      console.error('[restaurar familia]', err)
      alert('No se pudo restaurar la familia. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={restoring}
      className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
    >
      {restoring ? 'Restaurando...' : '↩️ Restaurar'}
    </button>
  )
}
