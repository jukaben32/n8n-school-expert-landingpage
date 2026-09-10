'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import {
  createStudentWithFamily,
  type CreateStudentWithFamilyInput,
  type DraftGuardianInput,
  type DuplicateStudentMatch,
  type StudentFieldsInput,
} from '@/lib/students/createStudentWithFamily'

// ⛔ NO volver a re-exportar nada desde este archivo, ni siquiera un tipo.
//
// Aquí vivía `export type { DuplicateStudentMatch }`, y **tumbó el alta de
// estudiante entera durante una semana** (del 2026-09-03, último estudiante
// creado, al 2026-09-10). Turbopack NO borra un re-export de tipo en un
// archivo 'use server': lo compila como un re-export de VALOR, y como el
// nombre solo existe en el sistema de tipos, el módulo revienta al evaluarse.
// El log de producción, textual:
//
//   ReferenceError: DuplicateStudentMatch is not defined
//       at module evaluation (.next/server/chunks/ssr/web_19-xrre._.js)
//
// Se traduce en un HTTP 500 en la POST de la Server Action, así que el botón
// Guardar no responde nada. Ni `tsc`, ni `eslint`, ni `next build` lo avisan
// -- es puramente de runtime, igual que el bug de EXTERNAL_PAYMENT_SOURCES
// del 2026-09-03.
//
// Quien necesite el tipo lo importa de su origen
// (@/lib/students/createStudentWithFamily), que es lo que ya hacía bien
// EnrollmentScansReview.tsx.

export type SubmitNewStudentInput = (
  | { mode: 'new'; student: StudentFieldsInput; familyName: string; guardians: DraftGuardianInput[] }
  | { mode: 'existing'; student: StudentFieldsInput; familyId: string }
) & {
  /** true cuando el usuario ya vio la alerta de posible duplicado y confirmó crear igual. */
  confirmDuplicate?: boolean
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

  const fullInput: CreateStudentWithFamilyInput =
    input.mode === 'new'
      ? { mode: 'new', schoolId, student: input.student, familyName: input.familyName, guardians: input.guardians }
      : { mode: 'existing', schoolId, student: input.student, familyId: input.familyId }

  // La alerta de duplicados la aplica createStudentWithFamily() -- el mismo
  // camino que usa la bandeja de fichas escaneadas.
  const result = await createStudentWithFamily(supabase, fullInput, {
    allowDuplicate: input.confirmDuplicate,
  })
  if (!result.ok) return { ok: false, error: result.error, duplicates: result.duplicates }

  revalidatePath('/dashboard/estudiantes')
  return { ok: true }
}
