'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface ActionResult {
  ok: boolean
  message: string
}

async function resolveStudentsAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'estudiantes')) {
    return { ok: false as const, message: 'No tienes permiso para editar estudiantes.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

export interface UpdateStudentInput {
  studentId: string
  firstName: string
  lastName: string
  birthDate: string
  gender: string
}

export async function updateStudentAction(input: UpdateStudentInput): Promise<ActionResult> {
  const resolved = await resolveStudentsAdmin()
  if (!resolved.ok) return { ok: false, message: resolved.message }

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName || !lastName || !input.birthDate) {
    return { ok: false, message: 'Nombre, apellido y fecha de nacimiento son obligatorios.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .update({
      first_name: firstName,
      last_name: lastName,
      birth_date: input.birthDate,
      gender: input.gender || null,
    })
    .eq('id', input.studentId)
    .eq('school_id', resolved.schoolId)
  if (error) return { ok: false, message: 'No se pudo actualizar el estudiante.' }

  revalidatePath(`/dashboard/estudiantes/${input.studentId}`)
  return { ok: true, message: 'Actualizado.' }
}

/**
 * Elimina (soft-delete) un estudiante -- ej. un registro duplicado o
 * dado de baja definitiva. No borra su historial (asistencia, notas,
 * pagos...), solo lo saca de los listados activos.
 */
export async function deleteStudentAction(studentId: string): Promise<ActionResult> {
  const resolved = await resolveStudentsAdmin()
  if (!resolved.ok) return { ok: false, message: resolved.message }

  const admin = createAdminClient()
  const { error } = await admin
    .from('students')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', studentId)
    .eq('school_id', resolved.schoolId)
  if (error) return { ok: false, message: 'No se pudo eliminar el estudiante.' }

  revalidatePath('/dashboard/estudiantes')
  return { ok: true, message: 'Eliminado.' }
}
