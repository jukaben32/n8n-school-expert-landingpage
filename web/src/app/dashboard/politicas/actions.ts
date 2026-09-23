'use server'

// OJO: un archivo 'use server' solo exporta funciones async -- ni
// constantes ni tipos (ver AGENTS.md, el `export type` que tumbó el alta
// de estudiantes una semana). Las interfaces de abajo NO se exportan.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface ActionResult {
  ok: boolean
  error?: string
  id?: string
}

interface CreatePolicyInput {
  title: string
  body: string
}

/** Publica una política interna nueva (solo dirección). */
export async function createStaffPolicyAction(input: CreatePolicyInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'politicas_gestionar')) {
    return { ok: false, error: 'No tienes permiso para publicar políticas.' }
  }

  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) return { ok: false, error: 'El título y el texto de la política son obligatorios.' }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  // Cliente de sesión a propósito: la policy staff_policies_manage es la
  // que garantiza que solo dirección de ESTE colegio puede publicar.
  const { data, error } = await supabase
    .from('staff_policies')
    .insert({ school_id: schoolId, title, body, created_by: profile.id })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: `No se pudo publicar la política. ${error?.message ?? ''}`.trim() }

  revalidatePath('/dashboard/politicas')
  return { ok: true, id: data.id }
}

/** Activa o retira una política (una retirada ya no se puede firmar). */
export async function setStaffPolicyActiveAction(policyId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'politicas_gestionar')) {
    return { ok: false, error: 'No tienes permiso para esto.' }
  }

  const { data, error } = await supabase
    .from('staff_policies')
    .update({ is_active: active })
    .eq('id', policyId)
    .select('id')
  // Sin .select() una policy que bloquea el update no da error: 0 filas.
  if (error || !data || data.length === 0) return { ok: false, error: 'No se pudo actualizar la política.' }

  revalidatePath('/dashboard/politicas')
  revalidatePath(`/dashboard/politicas/${policyId}`)
  return { ok: true }
}

interface SignPolicyInput {
  policyId: string
  fullName: string
  nationalId: string
  position: string
  password: string
}

/**
 * Firma de una política por el propio empleado. Igual que la firma de
 * Autorizaciones: exige volver a escribir la contraseña (mitiga que otra
 * persona firme desde un teléfono ya desbloqueado) y congela en la firma
 * el texto exacto que se aceptó.
 */
export async function signStaffPolicyAction(input: SignPolicyInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'politicas')) {
    return { ok: false, error: 'Solo el personal del colegio puede firmar políticas internas.' }
  }
  if (!profile.staff_id) {
    return { ok: false, error: 'Tu cuenta no está vinculada a una ficha de personal. Pide a Dirección que la vincule.' }
  }

  const fullName = input.fullName.trim()
  const nationalId = input.nationalId.trim()
  const position = input.position.trim()
  if (!fullName || !nationalId || !position) {
    return { ok: false, error: 'Completa tu nombre, tu cédula y tu cargo para firmar.' }
  }
  if (!input.password) return { ok: false, error: 'Vuelve a escribir tu contraseña para confirmar la firma.' }

  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: input.password })
  if (reauthError) return { ok: false, error: 'Contraseña incorrecta. Vuelve a intentarlo.' }

  // El texto se lee aquí en el servidor, nunca del navegador: lo que se
  // congela en la firma es lo que de verdad está publicado.
  const { data: policy } = await supabase
    .from('staff_policies')
    .select('id, school_id, title, body, is_active')
    .eq('id', input.policyId)
    .maybeSingle()
  if (!policy) return { ok: false, error: 'No se encontró la política.' }
  if (!policy.is_active) return { ok: false, error: 'Esta política ya no está vigente y no se puede firmar.' }

  const { error } = await supabase.from('staff_policy_signatures').insert({
    policy_id: policy.id,
    school_id: policy.school_id,
    staff_id: profile.staff_id,
    profile_id: profile.id,
    signer_full_name: fullName,
    signer_national_id: nationalId,
    signer_position: position,
    policy_title_snapshot: policy.title,
    policy_body_snapshot: policy.body,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya firmaste esta política.' }
    return { ok: false, error: `No se pudo registrar tu firma. ${error.message}` }
  }

  revalidatePath('/dashboard/politicas')
  revalidatePath(`/dashboard/politicas/${policy.id}`)
  return { ok: true }
}
