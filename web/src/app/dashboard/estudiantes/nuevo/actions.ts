'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import {
  createStudentWithFamily,
  type CreateStudentWithFamilyInput,
  type DraftGuardianInput,
  type StudentFieldsInput,
} from '@/lib/students/createStudentWithFamily'

export type SubmitNewStudentInput =
  | { mode: 'new'; student: StudentFieldsInput; familyName: string; guardians: DraftGuardianInput[] }
  | { mode: 'existing'; student: StudentFieldsInput; familyId: string }

interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Server Action del formulario manual de alta de estudiante -- resuelve la
 * sesión y llama a createStudentWithFamily(), el mismo núcleo que usa la
 * bandeja de revisión de fichas escaneadas (dashboard/estudiantes/escaneos).
 */
export async function submitNewStudent(input: SubmitNewStudentInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'estudiantes_nuevo')) {
    return { ok: false, error: 'No tienes permiso para dar de alta estudiantes.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const fullInput: CreateStudentWithFamilyInput =
    input.mode === 'new'
      ? { mode: 'new', schoolId, student: input.student, familyName: input.familyName, guardians: input.guardians }
      : { mode: 'existing', schoolId, student: input.student, familyId: input.familyId }

  const result = await createStudentWithFamily(supabase, fullInput)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/dashboard/estudiantes')
  return { ok: true }
}
