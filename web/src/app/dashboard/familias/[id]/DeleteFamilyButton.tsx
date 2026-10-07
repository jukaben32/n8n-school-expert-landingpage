'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteFamilyAction } from './actions'

/** Botón de baja de una familia (solo se muestra a dirección). */
export default function DeleteFamilyButton({ familyId, familyName }: { familyId: string; familyName: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(
      `¿Eliminar a la familia ${familyName}?\n\n` +
      'Sus hijos también saldrán de los listados activos y sus tutores ya no podrán usar el Portal Familiar. ' +
      'No se borra nada: facturas, pagos, asistencia y notas quedan guardados como historial.'
    )) return

    setDeleting(true)
    try {
      const result = await deleteFamilyAction(familyId)
      if (!result.ok) {
        alert(result.message)
        return
      }
      router.push('/dashboard/familias')
      router.refresh()
    } catch (err) {
      console.error('[eliminar familia]', err)
      alert('No se pudo eliminar la familia. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
    >
      {deleting ? 'Eliminando...' : '🗑️ Eliminar familia'}
    </button>
  )
}
