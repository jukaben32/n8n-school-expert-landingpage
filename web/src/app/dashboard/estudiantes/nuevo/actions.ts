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

export type SubmitNewStudentInput = (
  | { mode: 'new'; student: StudentFieldsInput; familyName: string; guardians: DraftGuardianInput[] }
  | { mode: 'existing'; student: StudentFieldsInput; familyId: string }
) & {
  /** true cuando el usuario ya vio la alerta de posible duplicado y confirmó crear igual. */
  confirmDuplicate?: boolean
}

export interface DuplicateStudentMatch {
  id: string
  firstName: string
  lastName: string
  gradeLevel: string | null
  enrollmentStatus: string
}

interface ActionResult {
  ok: boolean
  error?: string
  /** Presente solo cuando hay coincidencias por nombre y todavía no se confirmó -- el formulario debe pedir confirmación en vez de guardar. */
  duplicates?: DuplicateStudentMatch[]
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

  // Alerta de posible duplicado -- antes se podía crear el mismo estudiante
  // dos veces (mismo nombre y apellido) sin ningún aviso (reporte real del
  // colegio, 2026-09-02). No se bloquea -- puede haber dos hermanos o dos
  // niños distintos con el mismo nombre -- solo se pide confirmar una vez
  // que la persona ve que ya existe alguien con ese nombre.
  if (!input.confirmDuplicate) {
    const { data: matches } = await supabase
      .from('students')
      .select('id, first_name, last_name, grade_level, enrollment_status')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .ilike('first_name', input.student.firstName.trim())
      .ilike('last_name', input.student.lastName.trim())
    if (matches && matches.length > 0) {
      return {
        ok: false,
        error: 'Ya existe un estudiante con este nombre y apellido.',
        duplicates: matches.map((m) => ({
          id: m.id as string,
          firstName: m.first_name as string,
          lastName: m.last_name as string,
          gradeLevel: m.grade_level as string | null,
          enrollmentStatus: m.enrollment_status as string,
        })),
      }
    }
  }

  const fullInput: CreateStudentWithFamilyInput =
    input.mode === 'new'
      ? { mode: 'new', schoolId, student: input.student, familyName: input.familyName, guardians: input.guardians }
      : { mode: 'existing', schoolId, student: input.student, familyId: input.familyId }

  const result = await createStudentWithFamily(supabase, fullInput)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/dashboard/estudiantes')
  return { ok: true }
}
