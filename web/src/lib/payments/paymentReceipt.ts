import { createAdminClient } from '@/lib/supabase/admin'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { getPublicSiteUrl } from '@/lib/siteUrl'
import { addressWithCountry } from '@/app/colegio/[subdomain]/politicas/contenido'
import { buildPaymentReceiptText, formatAzulDateTime } from './receiptText'

type AdminClient = ReturnType<typeof createAdminClient>

interface ReceiptSubject {
  id: string
  family_id: string
  description: string
  ncf: string | null
  students: unknown
}

/**
 * De qué trata el recibo: la factura pagada o, en un pago de mensualidad
 * de prueba (sin factura), la familia y el estudiante de la transacción.
 */
async function loadReceiptSubject(admin: AdminClient, input: {
  invoiceId: string | null
  tuition?: { familyId: string; studentId: string; description: string }
}): Promise<ReceiptSubject | null> {
  if (input.invoiceId) {
    const { data, error } = await admin
      .from('invoices')
      .select('id, family_id, description, ncf, students(first_name, last_name)')
      .eq('id', input.invoiceId)
      .single()
    if (error || !data) {
      console.error('[sendAzulPaymentReceipt] factura no encontrada', error?.message)
      return null
    }
    return data
  }
  if (!input.tuition) return null
  const { data: student } = await admin
    .from('students')
    .select('first_name, last_name')
    .eq('id', input.tuition.studentId)
    .maybeSingle()
  return {
    // Sin factura, la referencia del recibo sale del estudiante
    id: input.tuition.studentId,
    family_id: input.tuition.familyId,
    description: input.tuition.description,
    ncf: null,
    students: student,
  }
}

/**
 * Envía el recibo de un pago con tarjeta APROBADO y verificado por
 * processAzulResult(). Best-effort, igual que notifyGuardianByEmail: si
 * algo falla solo se registra en consola -- el pago ya quedó confirmado
 * y la factura marcada como pagada, eso nunca se deshace por un correo.
 *
 * Destinatario: el tutor principal de la familia si tiene correo; si no,
 * el primero con correo (misma regla que los comunicados urgentes).
 */
export async function sendAzulPaymentReceipt(admin: AdminClient, input: {
  schoolId: string
  /** null solo en un pago de mensualidad en modo prueba (no se crea factura). */
  invoiceId: string | null
  /** Datos del pago de mensualidad cuando no hay factura (modo prueba). */
  tuition?: { familyId: string; studentId: string; description: string }
  amount: number
  authorizationCode: string
  azulReference: string | null
  azulDateTime: string
  isTest?: boolean
}): Promise<void> {
  try {
    const invoice = await loadReceiptSubject(admin, input)
    if (!invoice) return

    const [{ data: school }, { data: guardians }] = await Promise.all([
      admin.from('schools').select('name, subdomain, address, phone, email').eq('id', input.schoolId).single(),
      admin.from('guardians').select('email, is_primary').eq('family_id', invoice.family_id).order('is_primary', { ascending: false }),
    ])
    const guardianEmail = (guardians ?? []).find((g) => g.email)?.email ?? null
    if (!school || !guardianEmail) return

    const student = invoice.students as unknown as { first_name: string; last_name: string } | null
    const siteUrl = getPublicSiteUrl()
    const { subject, body } = buildPaymentReceiptText({
      schoolName: school.name,
      schoolAddress: addressWithCountry(school.address),
      schoolPhone: school.phone,
      schoolEmail: school.email,
      studentName: student ? `${student.first_name} ${student.last_name}`.trim() : null,
      concept: invoice.description,
      // El NCF, si la factura ya lo tiene; si no, un código corto de la factura
      invoiceReference: invoice.ncf || invoice.id.slice(0, 8).toUpperCase(),
      amount: input.amount,
      paidAt: formatAzulDateTime(input.azulDateTime),
      authorizationCode: input.authorizationCode,
      azulReference: input.azulReference,
      refundPolicyUrl: siteUrl && school.subdomain ? `${siteUrl}/colegio/${school.subdomain}/politicas/reembolsos` : null,
      isTest: input.isTest,
    })

    await notifyGuardianByEmail({ schoolName: school.name, guardianEmail, subject, body })
  } catch (err) {
    console.error('[sendAzulPaymentReceipt]', err)
  }
}
