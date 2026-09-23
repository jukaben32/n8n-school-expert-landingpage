'use server'

// Solo funciones async exportadas (ver AGENTS.md).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { APPLICATION_STATUSES } from '@/lib/jobs/labels'

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'personal')) return null
  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { supabase, profile, schoolId }
}

/**
 * Enlace temporal (5 min) para ver el CV o las certificaciones. El bucket es
 * privado y sin policies, así que se firma con service_role DESPUÉS de
 * comprobar que la solicitud es de este colegio.
 */
export async function getJobApplicationFileUrl(applicationId: string, kind: 'cv' | 'certificados'): Promise<{ ok: boolean; url?: string; error?: string }> {
  const ctx = await requireManager()
  if (!ctx) return { ok: false, error: 'No tienes permiso para esto.' }
  const { data: app } = await ctx.supabase
    .from('job_applications')
    .select('school_id, cv_path, certificates_path')
    .eq('id', applicationId)
    .eq('school_id', ctx.schoolId)
    .maybeSingle()
  const path = kind === 'cv' ? app?.cv_path : app?.certificates_path
  if (!app || !path) return { ok: false, error: 'No se encontró el archivo.' }
  const { data, error } = await createAdminClient().storage.from('solicitudes-empleo').createSignedUrl(path, 300)
  if (error || !data) return { ok: false, error: 'No se pudo abrir el archivo.' }
  return { ok: true, url: data.signedUrl }
}

export async function updateJobApplicationStatus(applicationId: string, status: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireManager()
  if (!ctx) return { ok: false, error: 'No tienes permiso para esto.' }
  if (!APPLICATION_STATUSES.some((s) => s.value === status)) return { ok: false, error: 'Estado no válido.' }
  const { data, error } = await ctx.supabase
    .from('job_applications')
    .update({ status, review_notes: notes.trim() || null, reviewed_by: ctx.profile.id, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId)
    .eq('school_id', ctx.schoolId)
    .select('id')
  if (error || !data || data.length === 0) return { ok: false, error: 'No se pudo guardar.' }
  revalidatePath('/dashboard/personal/solicitudes')
  return { ok: true }
}
