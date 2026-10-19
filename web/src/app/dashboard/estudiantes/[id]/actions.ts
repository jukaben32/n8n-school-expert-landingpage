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

export interface FamilyOption {
  id: string
  name: string
  /** Tutor principal (o el primero), para distinguir dos familias con el mismo nombre. */
  tutor: string | null
  studentCount: number
}

/**
 * Busca familias activas para "Cambiar de familia". Va con el cliente admin
 * porque ya se repitió la autorización arriba (resolveStudentsAdmin) y se
 * filtra siempre por el colegio activo.
 */
export async function searchFamiliesForMoveAction(query: string, excludeFamilyId: string): Promise<FamilyOption[]> {
  const resolved = await resolveStudentsAdmin()
  if (!resolved.ok) return []

  // Mismo saneo que el buscador global: una coma o un paréntesis rompen el filtro de PostgREST.
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[,()%*\\"']/g, '').trim())
    .filter((w) => w.length >= 2)
    .slice(0, 4)
  if (words.length === 0) return []

  const admin = createAdminClient()
  let q = admin
    .from('families')
    .select('id, name, guardians(first_name, last_name, is_primary, deleted_at), students(id, deleted_at)')
    .eq('school_id', resolved.schoolId)
    .is('deleted_at', null)
    .neq('id', excludeFamilyId)
  for (const w of words) q = q.ilike('name', `%${w}%`)
  const { data, error } = await q.order('name').limit(8)
  if (error) {
    console.error('[cambiar de familia] búsqueda', error)
    return []
  }

  type Row = {
    id: string
    name: string
    guardians: { first_name: string; last_name: string; is_primary: boolean; deleted_at: string | null }[] | null
    students: { id: string; deleted_at: string | null }[] | null
  }
  return ((data ?? []) as unknown as Row[]).map((f) => {
    const tutores = (f.guardians ?? []).filter((g) => !g.deleted_at)
    const principal = tutores.find((g) => g.is_primary) ?? tutores[0]
    return {
      id: f.id,
      name: f.name,
      tutor: principal ? `${principal.first_name} ${principal.last_name}` : null,
      studentCount: (f.students ?? []).filter((s) => !s.deleted_at).length,
    }
  })
}

/**
 * Cambia un estudiante de familia SIN crear una ficha nueva.
 *
 * Reporte real (2026-10-19): para pasar a un niño a otra familia, secretaría
 * lo creaba de nuevo dentro de la familia correcta y eliminaba el viejo -- y
 * con el viejo se iban de los listados sus asistencias y notas, porque todo
 * el historial cuelga del id del estudiante. Aquí el id no cambia: solo se
 * mueve `family_id` y se rehacen sus vínculos con tutores.
 *
 * Qué se mueve solo, porque se lee en vivo por `family_id`: Portal Familiar,
 * mensajes, asistente de IA y el descuento por hermanos (se recalcula en
 * ambas familias). Cuentas por Cobrar suma los pagos por `student_id`, así
 * que lo ya pagado no se pierde.
 *
 * Qué NO se toca: las facturas ya emitidas se quedan en la familia a la que
 * se facturaron (son comprobantes fiscales, e-CF en Alegra).
 */
export async function moveStudentToFamilyAction(studentId: string, targetFamilyId: string): Promise<ActionResult> {
  const resolved = await resolveStudentsAdmin()
  if (!resolved.ok) return { ok: false, message: resolved.message }
  const { schoolId } = resolved

  if (typeof studentId !== 'string' || !studentId || typeof targetFamilyId !== 'string' || !targetFamilyId) {
    return { ok: false, message: 'Falta indicar el estudiante o la familia.' }
  }

  const admin = createAdminClient()

  // 1. El estudiante y la familia destino tienen que ser de este colegio y estar activos.
  const { data: student } = await admin
    .from('students')
    .select('id, family_id, families(name)')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!student) return { ok: false, message: 'No se encontró el estudiante.' }

  const oldFamilyId = student.family_id as string
  const oldFamilyName = (student.families as unknown as { name: string } | null)?.name ?? 'la familia anterior'
  if (oldFamilyId === targetFamilyId) {
    return { ok: false, message: 'El estudiante ya pertenece a esa familia.' }
  }

  const { data: target } = await admin
    .from('families')
    .select('id, name')
    .eq('id', targetFamilyId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!target) return { ok: false, message: 'No se encontró la familia destino.' }

  const { data: targetGuardians, error: guardiansError } = await admin
    .from('guardians')
    .select('id, relationship, is_primary')
    .eq('family_id', targetFamilyId)
    .is('deleted_at', null)
  if (guardiansError) {
    console.error('[cambiar de familia] tutores destino', guardiansError)
    return { ok: false, message: 'No se pudieron leer los tutores de la familia destino. No se hizo ningún cambio.' }
  }

  // 2. Mover la ficha (mismo id: asistencias, notas, puntos e incidencias se quedan con él).
  const { error: moveError } = await admin
    .from('students')
    .update({ family_id: targetFamilyId })
    .eq('id', studentId)
    .eq('school_id', schoolId)
  if (moveError) {
    console.error('[cambiar de familia]', moveError)
    return { ok: false, message: 'No se pudo cambiar de familia. No se hizo ningún cambio.' }
  }

  // 3. Vincularlo con los tutores de la familia nueva (igual que un alta en
  //    familia existente: con TODOS sus tutores, no solo el principal).
  const targetIds = (targetGuardians ?? []).map((g) => g.id as string)
  if (targetIds.length > 0) {
    const { error: linkError } = await admin.from('student_guardians').upsert(
      (targetGuardians ?? []).map((g) => ({
        student_id: studentId,
        guardian_id: g.id,
        relationship: g.relationship ?? 'tutor_legal',
        is_primary: g.is_primary,
      })),
      { onConflict: 'student_id,guardian_id', ignoreDuplicates: true }
    )
    if (linkError) {
      console.error('[cambiar de familia] vínculos nuevos, se revierte', linkError)
      await admin.from('students').update({ family_id: oldFamilyId }).eq('id', studentId).eq('school_id', schoolId)
      return { ok: false, message: 'No se pudo vincular con los tutores de la familia nueva. No se hizo ningún cambio.' }
    }
  }

  // 4. Quitar los vínculos con los tutores de la familia anterior: si no,
  //    seguirían viendo al niño en su Portal Familiar.
  let unlink = admin.from('student_guardians').delete().eq('student_id', studentId)
  if (targetIds.length > 0) unlink = unlink.not('guardian_id', 'in', `(${targetIds.join(',')})`)
  const { error: unlinkError } = await unlink
  if (unlinkError) console.error('[cambiar de familia] vínculos viejos', unlinkError)

  // 5. Avisos útiles para quien hizo el cambio.
  const { count: remaining } = await admin
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', oldFamilyId)
    .is('deleted_at', null)

  const avisos = [`Listo: ahora pertenece a ${target.name}. Su historial (asistencias, notas) se conserva.`]
  if (targetIds.length === 0) avisos.push(`${target.name} no tiene tutores registrados todavía.`)
  if (unlinkError) avisos.push(`No se pudieron quitar los tutores de ${oldFamilyName}; avisa a soporte.`)
  if ((remaining ?? 0) === 0) avisos.push(`${oldFamilyName} quedó sin estudiantes; dirección puede eliminarla si ya no hace falta.`)

  revalidatePath(`/dashboard/estudiantes/${studentId}`)
  revalidatePath(`/dashboard/familias/${oldFamilyId}`)
  revalidatePath(`/dashboard/familias/${targetFamilyId}`)
  revalidatePath('/dashboard/familias')
  return { ok: true, message: avisos.join(' ') }
}
