'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteStudentAction } from './actions'

export default function DeleteStudentButton({ studentId, fullName }: { studentId: string; fullName: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${fullName}? No se borra su historial, solo desaparece de los listados activos.`)) return
    setDeleting(true)
    const result = await deleteStudentAction(studentId)
    setDeleting(false)
    if (!result.ok) {
      alert(result.message)
      return
    }
    router.push('/dashboard/estudiantes')
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
