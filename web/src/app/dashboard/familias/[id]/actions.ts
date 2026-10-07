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

// Solo dirección da de baja una familia: recepción y finanzas ven familias,
// pero esto saca del sistema activo a todos sus hijos y tutores.
const ROLES_QUE_ELIMINAN = ['super_admin', 'school_admin', 'director']

/** Sesión + permiso de dirección + colegio activo. Lo usan eliminar y restaurar. */
async function resolveFamilyDirector() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'familias') || !ROLES_QUE_ELIMINAN.includes(profile.role)) {
    return { ok: false as const, message: 'Solo la dirección del colegio puede eliminar o restaurar una familia.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

/**
 * Elimina (soft-delete) una familia: queda en la base de datos como
 * historial, pero deja de aparecer en listados, facturación y mensajes.
 *
 * NO se borra nada: ni facturas, ni pagos, ni asistencia, ni notas, ni los
 * tutores y sus cuentas. Solo se pone `deleted_at` en la familia y en sus
 * hijos que seguían activos, con la MISMA fecha exacta -- así una
 * restauración puede devolver únicamente lo que se eliminó junto con la
 * familia y no a un hijo que ya estaba dado de baja antes.
 *
 * Los tutores quedan "dormidos": resolveGuardianIdentity ya no los deja
 * operar en el Portal Familiar mientras su familia esté eliminada.
 */
export async function deleteFamilyAction(familyId: string): Promise<ActionResult> {
  const resolved = await resolveFamilyDirector()
  if (!resolved.ok) return { ok: false, message: resolved.message }
  const { schoolId } = resolved

  if (typeof familyId !== 'string' || !familyId) {
    return { ok: false, message: 'Falta indicar la familia.' }
  }

  const admin = createAdminClient()

  const { data: family } = await admin
    .from('families')
    .select('id')
    .eq('id', familyId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!family) return { ok: false, message: 'No se encontró la familia.' }

  // No se da de baja a una familia que todavía debe: se perdería de vista
  // en Cuentas por Cobrar.
  const { count: deudas, error: deudasError } = await admin
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('school_id', schoolId)
    .in('status', ['pendiente', 'vencido'])
    .is('deleted_at', null)
  if (deudasError) {
    console.error('[eliminar familia] no se pudieron revisar las facturas', deudasError)
    return { ok: false, message: 'No se pudo revisar si la familia tiene facturas pendientes. Intenta de nuevo.' }
  }
  if ((deudas ?? 0) > 0) {
    return {
      ok: false,
      message: `Esta familia tiene ${deudas} ${deudas === 1 ? 'factura pendiente' : 'facturas pendientes'}. Cóbralas o anúlalas antes de eliminarla.`,
    }
  }

  const eliminadaEn = new Date().toISOString()

  const { error: familyError } = await admin
    .from('families')
    .update({ deleted_at: eliminadaEn })
    .eq('id', familyId)
    .eq('school_id', schoolId)
  if (familyError) {
    console.error('[eliminar familia]', familyError)
    return { ok: false, message: 'No se pudo eliminar la familia.' }
  }

  const { error: studentsError } = await admin
    .from('students')
    .update({ deleted_at: eliminadaEn })
    .eq('family_id', familyId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
  if (studentsError) {
    console.error('[eliminar familia] fallaron los hijos, se revierte la familia', studentsError)
    // Se deja todo como estaba: mejor que no pase nada a una familia
    // eliminada con hijos todavía activos.
    await admin.from('families').update({ deleted_at: null }).eq('id', familyId).eq('school_id', schoolId)
    return { ok: false, message: 'No se pudo eliminar la familia. No se hizo ningún cambio.' }
  }

  revalidatePath('/dashboard/familias')
  revalidatePath('/dashboard/estudiantes')
  return { ok: true, message: 'Familia eliminada. Su historial se conserva.' }
}

/**
 * Restaura una familia eliminada: vuelve a los listados activos junto con
 * los hijos que se eliminaron CON ella (los que tienen exactamente la misma
 * fecha `deleted_at`). Un hijo que ya estaba dado de baja antes -- por
 * ejemplo un registro duplicado -- se queda eliminado.
 *
 * Los tutores no necesitan nada: su cuenta nunca se tocó, y en cuanto la
 * familia vuelve a estar activa, resolveGuardianIdentity los deja entrar.
 */
export async function restoreFamilyAction(familyId: string): Promise<ActionResult> {
  const resolved = await resolveFamilyDirector()
  if (!resolved.ok) return { ok: false, message: resolved.message }
  const { schoolId } = resolved

  if (typeof familyId !== 'string' || !familyId) {
    return { ok: false, message: 'Falta indicar la familia.' }
  }

  const admin = createAdminClient()

  const { data: family } = await admin
    .from('families')
    .select('id, deleted_at')
    .eq('id', familyId)
    .eq('school_id', schoolId)
    .not('deleted_at', 'is', null)
    .maybeSingle()
  if (!family?.deleted_at) return { ok: false, message: 'No se encontró esa familia eliminada.' }

  const eliminadaEn = family.deleted_at as string

  const { error: familyError } = await admin
    .from('families')
    .update({ deleted_at: null })
    .eq('id', familyId)
    .eq('school_id', schoolId)
  if (familyError) {
    console.error('[restaurar familia]', familyError)
    return { ok: false, message: 'No se pudo restaurar la familia.' }
  }

  const { error: studentsError } = await admin
    .from('students')
    .update({ deleted_at: null })
    .eq('family_id', familyId)
    .eq('school_id', schoolId)
    .eq('deleted_at', eliminadaEn)
  if (studentsError) {
    console.error('[restaurar familia] fallaron los hijos, se revierte la familia', studentsError)
    await admin.from('families').update({ deleted_at: eliminadaEn }).eq('id', familyId).eq('school_id', schoolId)
    return { ok: false, message: 'No se pudo restaurar la familia. No se hizo ningún cambio.' }
  }

  revalidatePath('/dashboard/familias')
  revalidatePath('/dashboard/familias/eliminadas')
  revalidatePath('/dashboard/estudiantes')
  return { ok: true, message: 'Familia restaurada.' }
}
