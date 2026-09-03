'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { generateAccessCode, generateStudentPassword, studentLoginEmail } from '@/lib/auth/studentAccess'

/**
 * Accesos de estudiantes.
 *
 * Los estudiantes no tienen correo, así que no hay ningún flujo de
 * invitación por email que sirva aquí. Se les crea la cuenta directamente
 * con un código de acceso y una contraseña temporal, y el colegio se las
 * entrega impresas -- el mismo camino que ya se usa con los tutores sin
 * correo (`createPhoneBasedAccess` en dashboard/familias/actions.ts).
 *
 * La contraseña solo se puede mostrar UNA VEZ, justo después de crearla:
 * Supabase guarda el hash, no la contraseña. Si se pierde, se genera una
 * nueva con `resetStudentPassword`.
 */

export interface StudentCredential {
  studentId: string
  name: string
  gradeLevel: string | null
  /** Lo que el estudiante escribe en la casilla de entrada. */
  accessCode: string
  password: string
}

export interface AccessResult {
  ok: boolean
  message: string
  credentials?: StudentCredential[]
  /** Estudiantes que se omitieron porque ya tenían acceso. */
  skipped?: number
}

type AdminClient = ReturnType<typeof createAdminClient>

interface StudentRow {
  id: string
  first_name: string
  last_name: string
  grade_level: string | null
  school_id: string
  access_code: string | null
}

/** Verifica sesión y permiso, y devuelve el colegio activo. */
async function resolveOperator() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'estudiantes_accesos')) {
    return { ok: false as const, message: 'No tienes permiso para crear accesos de estudiantes.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

/**
 * Reserva un código de acceso libre para este estudiante.
 *
 * El índice único de `students.access_code` es el que decide: si dos
 * generaciones simultáneas sacaran el mismo código, una de las dos falla
 * y se reintenta. Por eso el bucle está sobre el UPDATE y no sobre un
 * SELECT previo, que sí dejaría una ventana de carrera.
 */
async function reserveAccessCode(admin: AdminClient, studentId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateAccessCode()
    const { error } = await admin.from('students').update({ access_code: code }).eq('id', studentId)
    if (!error) return code
    if (error.code !== '23505') return null // error distinto a "código repetido"
  }
  return null
}

/** Crea la cuenta de un estudiante y devuelve sus credenciales. */
async function createAccessFor(
  admin: AdminClient,
  student: StudentRow
): Promise<{ ok: true; credential: StudentCredential } | { ok: false; message: string }> {
  const name = `${student.first_name} ${student.last_name}`.trim()

  const accessCode = student.access_code ?? (await reserveAccessCode(admin, student.id))
  if (!accessCode) {
    return { ok: false, message: `No se pudo generar el código de ${name}.` }
  }

  const password = generateStudentPassword()
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: studentLoginEmail(accessCode),
    password,
    email_confirm: true, // no hay correo real que confirmar: entra directo con estas credenciales
    user_metadata: { full_name: name, student_id: student.id },
  })

  const authId = created?.user?.id
  if (createError || !authId) {
    return { ok: false, message: `No se pudo crear el acceso de ${name}: ${createError?.message ?? 'error desconocido'}` }
  }

  const { error: profileError } = await admin.from('users_profiles').insert({
    auth_id: authId,
    school_id: student.school_id,
    student_id: student.id,
    role: 'student',
  })

  if (profileError) {
    // Sin perfil la cuenta no sirve para nada y además caería en el portal
    // de padres por defecto (ver dashboard/layout.tsx) -- se deshace.
    await admin.auth.admin.deleteUser(authId)
    return { ok: false, message: `No se pudo vincular el perfil de ${name}: ${profileError.message}` }
  }

  return {
    ok: true,
    credential: { studentId: student.id, name, gradeLevel: student.grade_level, accessCode, password },
  }
}

/** Crea el acceso de un solo estudiante. */
export async function grantStudentAccess(studentId: string): Promise<AccessResult> {
  const operator = await resolveOperator()
  if (!operator.ok) return { ok: false, message: operator.message }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id, first_name, last_name, grade_level, school_id, access_code')
    .eq('id', studentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!student || student.school_id !== operator.schoolId) {
    return { ok: false, message: 'No se encontró ese estudiante en este colegio.' }
  }

  const { data: existing } = await admin
    .from('users_profiles')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()
  if (existing) {
    return { ok: false, message: 'Este estudiante ya tiene acceso. Usa "Nueva contraseña" si la perdió.' }
  }

  const result = await createAccessFor(admin, student as StudentRow)
  if (!result.ok) return { ok: false, message: result.message }

  revalidatePath('/dashboard/estudiantes/accesos')
  return {
    ok: true,
    message: 'Acceso creado. Entrégale estas credenciales al estudiante.',
    credentials: [result.credential],
  }
}

/**
 * Crea de una vez el acceso de todos los estudiantes de un curso que
 * todavía no lo tienen. Es la vía normal: el colegio imprime la lista y
 * la reparte en el aula.
 */
export async function grantGradeAccess(gradeLevel: string): Promise<AccessResult> {
  const operator = await resolveOperator()
  if (!operator.ok) return { ok: false, message: operator.message }
  if (!gradeLevel) return { ok: false, message: 'Elige un curso.' }

  const admin = createAdminClient()

  const { data: students } = await admin
    .from('students')
    .select('id, first_name, last_name, grade_level, school_id, access_code')
    .eq('school_id', operator.schoolId)
    .eq('grade_level', gradeLevel)
    .eq('enrollment_status', 'inscrito')
    .is('deleted_at', null)
    .order('last_name')

  const roster = (students ?? []) as StudentRow[]
  if (roster.length === 0) return { ok: false, message: 'Ese curso no tiene estudiantes inscritos.' }

  const { data: withAccess } = await admin
    .from('users_profiles')
    .select('student_id')
    .in('student_id', roster.map((s) => s.id))
  const alreadyHave = new Set((withAccess ?? []).map((p) => p.student_id as string))

  const pending = roster.filter((s) => !alreadyHave.has(s.id))
  if (pending.length === 0) {
    return { ok: false, message: 'Todos los estudiantes de este curso ya tienen acceso.' }
  }

  const credentials: StudentCredential[] = []
  const errors: string[] = []
  for (const student of pending) {
    const result = await createAccessFor(admin, student)
    if (result.ok) credentials.push(result.credential)
    else errors.push(result.message)
  }

  revalidatePath('/dashboard/estudiantes/accesos')

  if (credentials.length === 0) {
    return { ok: false, message: errors[0] ?? 'No se pudo crear ningún acceso.' }
  }
  return {
    ok: true,
    message: errors.length === 0
      ? `Se crearon ${credentials.length} accesos. Imprime la lista y repártela en el aula.`
      : `Se crearon ${credentials.length} accesos, pero ${errors.length} fallaron: ${errors[0]}`,
    credentials,
    skipped: alreadyHave.size,
  }
}

/** Genera una contraseña nueva para un estudiante que perdió la suya. */
export async function resetStudentPassword(studentId: string): Promise<AccessResult> {
  const operator = await resolveOperator()
  if (!operator.ok) return { ok: false, message: operator.message }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id, first_name, last_name, grade_level, school_id, access_code')
    .eq('id', studentId)
    .maybeSingle()
  if (!student || student.school_id !== operator.schoolId) {
    return { ok: false, message: 'No se encontró ese estudiante en este colegio.' }
  }

  const { data: profile } = await admin
    .from('users_profiles')
    .select('auth_id')
    .eq('student_id', studentId)
    .maybeSingle()
  if (!profile) {
    return { ok: false, message: 'Este estudiante todavía no tiene acceso.' }
  }

  const password = generateStudentPassword()
  const { error } = await admin.auth.admin.updateUserById(profile.auth_id as string, { password })
  if (error) return { ok: false, message: `No se pudo cambiar la contraseña: ${error.message}` }

  revalidatePath('/dashboard/estudiantes/accesos')
  return {
    ok: true,
    message: 'Contraseña nueva generada. La anterior ya no funciona.',
    credentials: [{
      studentId: student.id,
      name: `${student.first_name} ${student.last_name}`.trim(),
      gradeLevel: student.grade_level,
      accessCode: (student.access_code as string) ?? '',
      password,
    }],
  }
}
