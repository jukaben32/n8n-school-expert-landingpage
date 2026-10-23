import { createAdminClient } from '@/lib/supabase/admin'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { getPublicSiteUrl } from '@/lib/siteUrl'
import { addressWithCountry } from '@/app/colegio/[subdomain]/politicas/contenido'
import { buildPaymentReceiptText, formatAzulDateTime } from './receiptText'

type AdminClient = ReturnType<typeof createAdminClient>

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
  invoiceId: string
  amount: number
  authorizationCode: string
  azulReference: string | null
  azulDateTime: string
}): Promise<void> {
  try {
    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .select('id, family_id, description, ncf, students(first_name, last_name)')
      .eq('id', input.invoiceId)
      .single()
    if (invoiceError || !invoice) {
      console.error('[sendAzulPaymentReceipt] factura no encontrada', invoiceError?.message)
      return
    }

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
    })

    await notifyGuardianByEmail({ schoolName: school.name, guardianEmail, subject, body })
  } catch (err) {
    console.error('[sendAzulPaymentReceipt]', err)
  }
}
