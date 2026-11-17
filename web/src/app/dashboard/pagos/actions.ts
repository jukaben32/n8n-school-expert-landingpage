'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveGuardianIdentity } from '@/lib/auth/resolveGuardianIdentity'
import { createClient } from '@/lib/supabase/server'
import { buildAzulPaymentForm, buildAzulTuitionPaymentForm, schoolCardPaymentAvailableFor, type AzulPaymentForm } from '@/lib/payments/azul'
import { getPublicSiteUrl } from '@/lib/siteUrl'
import { getFamilyTuitionOverview } from '@/lib/payments/familyTuition'
import { buildTuitionQuote, formatPeriodMonth } from '@/lib/payments/tuitionPlan'

const RECEIPT_BUCKET = 'comprobantes-pago'
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

interface ActionResult {
  ok: boolean
  error?: string
}

export type StartAzulPaymentResult =
  | { ok: true; form: AzulPaymentForm }
  | { ok: false; error: string }

/**
 * Arma el formulario que el navegador de la familia debe enviar a Azul
 * (Parte A del pago con tarjeta). No procesa el pago aquí -- eso pasa del
 * lado de Azul y vuelve por /api/pagos/azul/resultado.
 */
export async function startAzulPayment(invoiceId: string): Promise<StartAzulPaymentResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  // Misma regla que el botón, pero aplicada en el servidor: con credenciales
  // de PRUEBA solo pueden iniciar un pago los correos autorizados.
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!(await schoolCardPaymentAvailableFor(identity.schoolId, user?.email))) {
    return { ok: false, error: 'El pago con tarjeta no está disponible todavía.' }
  }

  const siteUrl = getPublicSiteUrl()
  if (!siteUrl) return { ok: false, error: 'Falta configurar NEXT_PUBLIC_SITE_URL.' }

  return buildAzulPaymentForm({
    schoolId: identity.schoolId,
    familyId: identity.familyId,
    invoiceId,
    siteUrl,
  })
}

/**
 * Pago de la mensualidad de un hijo con tarjeta, con la opción de
 * adelantar meses. El navegador solo dice QUÉ hijo y CUÁNTOS meses; el
 * monto, los meses y el descuento los vuelve a calcular el servidor con
 * los mismos datos que Cuentas por Cobrar (getFamilyTuitionOverview), así
 * que nadie puede cambiar lo que se cobra desde el navegador.
 */
export async function startTuitionCardPayment(studentId: string, monthsAhead: number): Promise<StartAzulPaymentResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!(await schoolCardPaymentAvailableFor(identity.schoolId, user?.email))) {
    return { ok: false, error: 'El pago con tarjeta no está disponible todavía.' }
  }

  const siteUrl = getPublicSiteUrl()
  if (!siteUrl) return { ok: false, error: 'Falta configurar NEXT_PUBLIC_SITE_URL.' }

  if (typeof studentId !== 'string' || !studentId) return { ok: false, error: 'Falta indicar el estudiante.' }
  const requestedMonths = Number.isInteger(monthsAhead) && monthsAhead > 0 ? monthsAhead : 0

  // Filtrado por la familia de la sesión: si el estudiante no es de esta
  // familia, sale vacío.
  const overview = await getFamilyTuitionOverview({
    schoolId: identity.schoolId,
    familyId: identity.familyId,
    studentId,
  })
  const student = overview.students[0]
  if (!student) return { ok: false, error: 'No se encontró la mensualidad de este estudiante.' }

  if (requestedMonths > 0 && !overview.prepayEnabled) {
    return { ok: false, error: 'El colegio no tiene habilitado el pago de meses por adelantado.' }
  }
  if (requestedMonths > student.future.length) {
    return { ok: false, error: 'No quedan tantos meses por adelantar este año escolar.' }
  }

  const quote = buildTuitionQuote({
    principalDue: student.currentAmount + student.overduePrincipal,
    lateFee: student.lateFee,
    future: student.future,
    monthsAhead: requestedMonths,
    tiers: overview.prepayTiers,
  })
  if (!(quote.total > 0)) return { ok: false, error: 'No hay nada pendiente por pagar.' }

  const parts: string[] = []
  if (quote.principalDue > 0) parts.push(`pendiente${student.oldestReference ? ` desde ${student.oldestReference}` : ''}`)
  if (quote.lateFee > 0) parts.push('recargo por mora aparte')
  if (quote.monthsAhead > 0) {
    const first = formatPeriodMonth(quote.months[0].periodMonth)
    const last = formatPeriodMonth(quote.months[quote.months.length - 1].periodMonth)
    const range = quote.monthsAhead === 1 ? first : `${first} a ${last}`
    parts.push(`adelanto de ${quote.monthsAhead} ${quote.monthsAhead === 1 ? 'mes' : 'meses'} (${range})${quote.discountPercent > 0 ? `, ${quote.discountPercent}% de descuento` : ''}`)
  }

  return buildAzulTuitionPaymentForm({
    schoolId: identity.schoolId,
    familyId: identity.familyId,
    studentId: student.studentId,
    siteUrl,
    plan: {
      principalDue: quote.principalDue,
      lateFee: quote.lateFee,
      monthsAhead: quote.monthsAhead,
      prepayGross: quote.prepayGross,
      discountPercent: quote.discountPercent,
      prepayDiscount: quote.prepayDiscount,
      total: quote.total,
      months: quote.months.map((m) => m.periodMonth),
      description: `Mensualidad — pago con tarjeta en el Portal Familiar (${parts.join('; ')})`,
    },
  })
}

/**
 * Parte B: la familia sube un comprobante de transferencia. Esto SOLO crea
 * un registro "pendiente" -- nunca marca la factura como pagada. Confirmar
 * o rechazar es una acción exclusiva de Tesorería (ver
 * web/src/app/dashboard/tesoreria/actions.ts).
 */
export async function uploadPaymentReceipt(formData: FormData): Promise<ActionResult> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return { ok: false, error: identity.error }

  const invoiceId = formData.get('invoiceId')
  const amountRaw = formData.get('amount')
  const file = formData.get('file')

  if (typeof invoiceId !== 'string' || !invoiceId) {
    return { ok: false, error: 'Falta indicar la factura.' }
  }
  const amount = Number(amountRaw)
  if (!amount || amount <= 0) {
    return { ok: false, error: 'Indica el monto transferido.' }
  }
  if (!(file instanceof File)) {
    return { ok: false, error: 'Adjunta una foto o PDF del comprobante.' }
  }
  if (file.size === 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return { ok: false, error: 'El archivo es demasiado grande (máximo 10MB).' }
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
    return { ok: false, error: 'Solo se aceptan imágenes (JPG/PNG/WEBP) o PDF.' }
  }

  const admin = createAdminClient()

  // Filtrado explícito: la factura debe pertenecer a la familia y colegio
  // ya resueltos por la sesión -- no se confía en el invoiceId del cliente
  // por sí solo.
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .eq('school_id', identity.schoolId)
    .eq('family_id', identity.familyId)
    .is('deleted_at', null)
    .single()

  if (!invoice) return { ok: false, error: 'No se encontró la factura.' }
  if (invoice.status === 'pagado') return { ok: false, error: 'Esta factura ya está pagada.' }

  const extension = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
  const receiptId = crypto.randomUUID()
  const path = `${identity.schoolId}/${identity.familyId}/${receiptId}.${extension}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return { ok: false, error: `No se pudo subir el comprobante: ${uploadError.message}` }
  }

  const { error: insertError } = await admin.from('payment_receipts').insert({
    id: receiptId,
    school_id: identity.schoolId,
    family_id: identity.familyId,
    invoice_id: invoiceId,
    guardian_id: identity.guardianId,
    amount,
    storage_path: path,
    status: 'pendiente',
  })

  if (insertError) {
    // El archivo ya se subió -- se intenta limpiar para no dejar huérfanos.
    await admin.storage.from(RECEIPT_BUCKET).remove([path])
    return { ok: false, error: `No se pudo registrar el comprobante: ${insertError.message}` }
  }

  return { ok: true }
}

export interface MyReceipt {
  id: string
  invoice_id: string
  amount: number
  status: 'pendiente' | 'confirmado' | 'rechazado'
  rejection_reason: string | null
  created_at: string
}

export async function getMyReceipts(): Promise<MyReceipt[]> {
  const identity = await resolveGuardianIdentity()
  if (!identity.ok) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('payment_receipts')
    .select('id, invoice_id, amount, status, rejection_reason, created_at')
    .eq('family_id', identity.familyId)
    .order('created_at', { ascending: false })

  return (data ?? []) as MyReceipt[]
}
