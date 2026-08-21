'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

async function resolveStaffReviewer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'personal')) {
    return { ok: false as const, error: 'No tienes permiso para revisar registros de personal.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId, reviewerProfileId: profile.id as string }
}

export interface PendingStaffRegistration {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  national_id: string | null
  desired_role: string
  specialty: string | null
  education_level: string | null
  degree_title: string | null
  alma_mater: string | null
  graduation_year: number | null
  certifications: string | null
  created_at: string
}

export async function listPendingStaffRegistrations(): Promise<PendingStaffRegistration[]> {
  const reviewer = await resolveStaffReviewer()
  if (!reviewer.ok) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('staff_registrations')
    .select('id, first_name, last_name, email, phone, national_id, desired_role, specialty, education_level, degree_title, alma_mater, graduation_year, certifications, created_at')
    .eq('school_id', reviewer.schoolId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true })

  return (data ?? []) as PendingStaffRegistration[]
}

interface ActionResult {
  ok: boolean
  error?: string
  staffId?: string
}

/**
 * Aprueba un registro de personal -- crea el registro real en `staff`
 * con los datos que dirección confirmó en pantalla (nunca los del
 * registro original sin revisar, mismo principio que confirmEnrollmentScan
 * / approveVendorInvoice: la persona en pantalla siempre puede corregir
 * antes de confirmar).
 */
export async function approveStaffRegistration(
  registrationId: string,
  corrected: Omit<PendingStaffRegistration, 'id' | 'created_at'>
): Promise<ActionResult> {
  const reviewer = await resolveStaffReviewer()
  if (!reviewer.ok) return { ok: false, error: reviewer.error }

  const supabase = await createClient()

  const { data: registration } = await supabase
    .from('staff_registrations')
    .select('id, status, school_id')
    .eq('id', registrationId)
    .eq('school_id', reviewer.schoolId)
    .single()

  if (!registration) return { ok: false, error: 'No se encontró ese registro.' }
  if (registration.status !== 'pendiente') return { ok: false, error: 'Este registro ya fue revisado.' }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .insert({
      school_id: reviewer.schoolId,
      first_name: corrected.first_name,
      last_name: corrected.last_name,
      email: corrected.email,
      phone: corrected.phone,
      role: corrected.desired_role,
      specialty: corrected.specialty,
      education_level: corrected.education_level,
      degree_title: corrected.degree_title,
      alma_mater: corrected.alma_mater,
      graduation_year: corrected.graduation_year,
      certifications: corrected.certifications,
    })
    .select('id')
    .single()

  if (staffError || !staff) {
    return { ok: false, error: `No se pudo crear el registro de personal: ${staffError?.message ?? 'error desconocido'}` }
  }

  const { error: updateError } = await supabase
    .from('staff_registrations')
    .update({
      status: 'aprobado',
      reviewed_by: reviewer.reviewerProfileId,
      reviewed_at: new Date().toISOString(),
      created_staff_id: staff.id,
    })
    .eq('id', registrationId)

  if (updateError) {
    return { ok: false, error: `El personal se creó, pero no se pudo marcar el registro como aprobado: ${updateError.message}`, staffId: staff.id }
  }

  revalidatePath('/dashboard/personal')
  revalidatePath('/dashboard/personal/registros')
  return { ok: true, staffId: staff.id }
}

export async function rejectStaffRegistration(registrationId: string, reason: string): Promise<ActionResult> {
  const reviewer = await resolveStaffReviewer()
  if (!reviewer.ok) return { ok: false, error: reviewer.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('staff_registrations')
    .update({
      status: 'rechazado',
      reviewed_by: reviewer.reviewerProfileId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('id', registrationId)
    .eq('school_id', reviewer.schoolId)
    .eq('status', 'pendiente')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/personal/registros')
  return { ok: true }
}
