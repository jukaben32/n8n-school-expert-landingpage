import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * createStudentWithFamily — único camino de creación de estudiante +
 * familia + tutor(es) en MentorIApp.
 *
 * Antes esta lógica vivía solo dentro de NewStudentForm.tsx (componente de
 * cliente). Se extrajo aquí para que la bandeja de revisión de fichas
 * escaneadas (dashboard/estudiantes/escaneos) pueda crear un estudiante con
 * el mismo código exacto que el formulario manual -- así no hay dos caminos
 * de creación que puedan divergir (ver AGENTS.md).
 *
 * Recibe un cliente de Supabase ya autenticado (el de la sesión del staff
 * que llama, vía @/lib/supabase/server) -- respeta las mismas políticas de
 * RLS que ya protegían la creación manual; esta función no resuelve sesión
 * ni permisos por sí misma, eso es responsabilidad de quien la llama.
 */

export type GuardianRelationship = 'madre' | 'padre' | 'tutor_legal' | 'otro'

export interface DraftGuardianInput {
  firstName: string
  lastName: string
  phone: string
  email?: string | null
  relationship: GuardianRelationship
  /** Campos que solo llena la bandeja de fichas escaneadas -- el formulario manual los deja undefined. */
  nationalId?: string | null
  address?: string | null
  originProvince?: string | null
  nationality?: string | null
}

export interface StudentFieldsInput {
  firstName: string
  lastName: string
  birthDate: string
  gender?: 'M' | 'F' | 'O' | null
  enrollmentStatus: string
  /** Campos que solo llena la bandeja de fichas escaneadas -- el formulario manual los deja undefined. */
  birthPlace?: string | null
  gradeLevel?: string | null
  studentCode?: string | null
  healthNotes?: string | null
  emergencyContact?: { nombre: string | null; telefono: string | null; parentesco: string | null } | null
}

export type CreateStudentWithFamilyInput =
  | { mode: 'new'; schoolId: string; student: StudentFieldsInput; familyName: string; guardians: DraftGuardianInput[] }
  | { mode: 'existing'; schoolId: string; student: StudentFieldsInput; familyId: string }

export type CreateStudentWithFamilyResult =
  | { ok: true; studentId: string; familyId: string }
  | { ok: false; error: string }

function buildStudentRow(schoolId: string, familyId: string, student: StudentFieldsInput) {
  return {
    school_id: schoolId,
    family_id: familyId,
    first_name: student.firstName,
    last_name: student.lastName,
    birth_date: student.birthDate,
    gender: student.gender || null,
    enrollment_status: student.enrollmentStatus,
    birth_place: student.birthPlace || null,
    grade_level: student.gradeLevel || null,
    student_code: student.studentCode || null,
    medical_notes: student.healthNotes ? { notas: student.healthNotes } : null,
    emergency_contact: student.emergencyContact ?? null,
  }
}

export async function createStudentWithFamily(
  supabase: SupabaseClient,
  input: CreateStudentWithFamilyInput
): Promise<CreateStudentWithFamilyResult> {
  if (input.mode === 'new') {
    if (input.guardians.length === 0) {
      return { ok: false, error: 'Se necesita al menos un tutor.' }
    }

    const { data: newFamily, error: familyError } = await supabase
      .from('families')
      .insert({ school_id: input.schoolId, name: input.familyName })
      .select('id')
      .single()
    if (familyError || !newFamily) {
      return { ok: false, error: familyError?.message ?? 'No se pudo crear la familia.' }
    }
    const familyId = newFamily.id as string

    // El primero de la lista queda como tutor principal (is_primary).
    const createdGuardians: { id: string; relationship: string; isPrimary: boolean }[] = []
    for (let i = 0; i < input.guardians.length; i++) {
      const g = input.guardians[i]
      const { data: newGuardian, error: guardianError } = await supabase
        .from('guardians')
        .insert({
          school_id: input.schoolId,
          family_id: familyId,
          first_name: g.firstName,
          last_name: g.lastName,
          phone: g.phone,
          email: g.email || null,
          relationship: g.relationship,
          is_primary: i === 0,
          national_id: g.nationalId || null,
          address: g.address || null,
          origin_province: g.originProvince || null,
          nationality: g.nationality || null,
        })
        .select('id')
        .single()
      if (guardianError || !newGuardian) {
        return { ok: false, error: guardianError?.message ?? 'No se pudo crear un tutor.' }
      }
      createdGuardians.push({ id: newGuardian.id as string, relationship: g.relationship, isPrimary: i === 0 })
    }

    const { data: newStudent, error: studentError } = await supabase
      .from('students')
      .insert(buildStudentRow(input.schoolId, familyId, input.student))
      .select('id')
      .single()
    if (studentError || !newStudent) {
      return { ok: false, error: studentError?.message ?? 'No se pudo crear el estudiante.' }
    }
    const studentId = newStudent.id as string

    const { error: linkError } = await supabase.from('student_guardians').insert(
      createdGuardians.map((g) => ({
        student_id: studentId,
        guardian_id: g.id,
        relationship: g.relationship,
        is_primary: g.isPrimary,
      }))
    )
    if (linkError) return { ok: false, error: linkError.message }

    return { ok: true, studentId, familyId }
  }

  // mode === 'existing' -- se vincula con TODOS los tutores ya registrados
  // de esa familia, no solo el principal.
  const { data: newStudent, error: studentError } = await supabase
    .from('students')
    .insert(buildStudentRow(input.schoolId, input.familyId, input.student))
    .select('id')
    .single()
  if (studentError || !newStudent) {
    return { ok: false, error: studentError?.message ?? 'No se pudo crear el estudiante.' }
  }
  const studentId = newStudent.id as string

  const { data: existingGuardians } = await supabase
    .from('guardians')
    .select('id, relationship, is_primary')
    .eq('family_id', input.familyId)

  if (existingGuardians && existingGuardians.length > 0) {
    const { error: linkError } = await supabase.from('student_guardians').insert(
      existingGuardians.map((g) => ({
        student_id: studentId,
        guardian_id: g.id,
        relationship: g.relationship ?? 'tutor_legal',
        is_primary: g.is_primary,
      }))
    )
    if (linkError) return { ok: false, error: linkError.message }
  }

  return { ok: true, studentId, familyId: input.familyId }
}
