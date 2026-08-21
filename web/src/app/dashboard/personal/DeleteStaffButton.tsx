'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteStaffAction } from './actions'

export default function DeleteStaffButton({ staffId, fullName }: { staffId: string; fullName: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${fullName} de Personal? Si tenía acceso al sistema, se le quitará (salvo que también sea tutor de un hijo aquí).`)) return
    setDeleting(true)
    const result = await deleteStaffAction(staffId)
    setDeleting(false)
    if (!result.ok) {
      alert(result.message)
      return
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
    >
      {deleting ? 'Eliminando...' : '🗑️ Eliminar'}
    </button>
  )
}
