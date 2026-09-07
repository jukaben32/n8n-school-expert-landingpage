'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

const InvoiceSchema = z.object({
  familyId: z.string().uuid('Familia inválida.'),
  studentId: z.string().uuid('Estudiante inválido.').nullable().optional(),
  conceptId: z.string().uuid('Concepto inválido.').nullable().optional(),
  description: z.string().trim().min(1, 'Escribe una descripción.').max(200, 'La descripción es demasiado larga.'),
  amount: z.number().finite().positive('Indica un monto mayor a cero.'),
  applyTax: z.boolean(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha límite inválida.'),
})

interface ActionResult {
  ok: boolean
  error?: string
}

async function resolveTesoreriaStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.', supabase: null }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'tesoreria')) {
    return { ok: false as const, error: 'No tienes permiso para generar facturas.', supabase: null }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, staffProfileId: profile.id as string, schoolId, supabase }
}

/**
 * Genera una factura validando en servidor que familia, estudiante y
 * concepto pertenecen al colegio activo. El cliente no decide school_id,
 * created_by ni el descuento final.
 */
export async function createTreasuryInvoice(input: unknown): Promise<ActionResult> {
  const parsed = InvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { familyId, studentId, conceptId, description, amount, applyTax, dueDate } = parsed.data

  const { data: family } = await admin
    .from('families')
    .select('id')
    .eq('id', familyId)
    .eq('school_id', staff.schoolId)
    .is('deleted_at', null)
    .single()
  if (!family) return { ok: false, error: 'No se encontró la familia.' }

  if (studentId) {
    const { data: student } = await admin
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('school_id', staff.schoolId)
      .eq('family_id', familyId)
      .is('deleted_at', null)
      .single()
    if (!student) return { ok: false, error: 'El estudiante no pertenece a esa familia.' }
  }

  if (conceptId) {
    const { data: concept } = await admin
      .from('billing_concepts')
      .select('id')
      .eq('id', conceptId)
      .eq('school_id', staff.schoolId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()
    if (!concept) return { ok: false, error: 'El concepto de cobro no está disponible.' }
  }

  let discountPercent = 0
  if (studentId) {
    const { data: discount } = await admin.rpc('calculate_sibling_discount', { p_student_id: studentId }).single()
    const parsedDiscount = discount as { qualifies?: boolean; discount_percent?: number } | null
    discountPercent = parsedDiscount?.qualifies ? Number(parsedDiscount.discount_percent ?? 0) : 0
  }

  const roundedAmount = Math.round(amount * 100) / 100
  const discountAmount = Math.round(roundedAmount * (discountPercent / 100) * 100) / 100
  const discountedAmount = Math.round((roundedAmount - discountAmount) * 100) / 100
  const taxAmount = applyTax ? Math.round(discountedAmount * 0.18 * 100) / 100 : 0
  const totalAmount = Math.round((discountedAmount + taxAmount) * 100) / 100

  const { data: ncf, error: ncfError } = await staff.supabase.rpc('generate_ncf', {
    p_school_id: staff.schoolId,
    p_ncf_type: '02',
  })
  if (ncfError || !ncf) return { ok: false, error: 'No se pudo generar el comprobante fiscal.' }

  const { error: invoiceError } = await admin.from('invoices').insert({
    school_id: staff.schoolId,
    family_id: familyId,
    student_id: studentId ?? null,
    concept_id: conceptId ?? null,
    description,
    amount: roundedAmount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    due_date: dueDate,
    status: 'pendiente',
    ncf,
    ncf_type: '02',
    created_by: staff.staffProfileId,
  })
  if (invoiceError) return { ok: false, error: `No se pudo generar la factura: ${invoiceError.message}` }

  revalidatePath('/dashboard/tesoreria')
  revalidatePath('/dashboard/tesoreria/facturar')
  return { ok: true }
}
