import crypto from 'node:crypto'
import { computeRequestAuthHash, toAzulAmount, verifyResponseAuthHash } from './azulHash'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAzulPaymentReceipt } from '@/lib/payments/paymentReceipt'

/**
 * Integración con "Página de Pago AZUL" -- la opción de página alojada
 * por Azul (Banco Popular Dominicano), confirmada como la preferida
 * (evita manejar datos de tarjeta en nuestro servidor, evita el alcance
 * de cumplimiento PCI de la Parte A del mandato). Verificado contra el
 * manual oficial "E-commerce AZUL" (dev.azul.com.do), descargado el
 * 2026-07-28 -- no de memoria.
 *
 * El navegador del cliente hace un POST tipo HTML form directo al
 * dominio de Azul con estos campos "hidden"; nuestro servidor arma los
 * campos (incluyendo el AuthHash) pero nunca ve ni toca un número de
 * tarjeta.
 *
 * Credenciales por colegio: cada colegio afiliado tiene su propia cuenta
 * comercial de Azul (MerchantId/AuthKey propios) -- ver
 * private.school_payment_settings. Esta función siempre resuelve las
 * credenciales por school_id explícito, nunca usa un valor global.
 */

const AZUL_URLS = {
  test: 'https://pruebas.azul.com.do/PaymentPage/',
  production: 'https://pagos.azul.com.do/PaymentPage/Default.aspx',
} as const

type AzulEnvironment = keyof typeof AZUL_URLS

interface SchoolAzulCredentials {
  merchantId: string
  merchantName: string
  merchantType: string
  currencyCode: string
  authKey: string
  environment: AzulEnvironment
}

type AdminClient = ReturnType<typeof createAdminClient>

async function getSchoolAzulCredentials(admin: AdminClient, schoolId: string): Promise<SchoolAzulCredentials | null> {
  const { data, error } = await admin
    .rpc('get_school_payment_credentials', { p_school_id: schoolId })
    .maybeSingle()

  if (error || !data) return null
  const row = data as {
    azul_merchant_id: string | null
    azul_merchant_name: string | null
    azul_merchant_type: string | null
    azul_currency_code: string | null
    azul_auth_key: string | null
    azul_environment: string | null
  }

  if (!row.azul_merchant_id || !row.azul_merchant_name || !row.azul_auth_key) return null

  return {
    merchantId: row.azul_merchant_id,
    merchantName: row.azul_merchant_name,
    merchantType: row.azul_merchant_type || 'ECommerce',
    currencyCode: row.azul_currency_code || '$',
    authKey: row.azul_auth_key,
    environment: row.azul_environment === 'production' ? 'production' : 'test',
  }
}

/**
 * ¿Este colegio ya tiene cargadas sus credenciales de Azul?
 *
 * Sirve para no mostrarle al padre un botón de "Pagar con tarjeta" que lo
 * único que puede hacer es responderle "este colegio todavía no tiene
 * configurado el pago con tarjeta". Nunca devuelve ningún dato de la
 * credencial -- solo sí/no.
 */
export async function schoolHasAzulConfigured(schoolId: string): Promise<boolean> {
  if (!schoolId) return false
  const admin = createAdminClient()
  const credentials = await getSchoolAzulCredentials(admin, schoolId)
  return credentials !== null
}

// Correos de tutores que pueden pagar mientras el colegio tenga cargadas
// credenciales de PRUEBA (variable de entorno AZUL_TEST_GUARDIAN_EMAILS,
// separados por coma). Las tarjetas de prueba de Azul son públicas: sin
// este filtro, cualquier familia vería el botón en modo prueba.
function azulTesterEmails(): string[] {
  return (process.env.AZUL_TEST_GUARDIAN_EMAILS ?? '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

/**
 * ¿Esta persona puede pagar con tarjeta en este colegio?
 * - Credenciales de PRODUCCIÓN: cualquier tutor.
 * - Credenciales de PRUEBA: solo los correos de AZUL_TEST_GUARDIAN_EMAILS.
 * - Sin credenciales: nadie.
 */
export async function schoolCardPaymentAvailableFor(schoolId: string, email: string | null | undefined): Promise<boolean> {
  if (!schoolId) return false
  const credentials = await getSchoolAzulCredentials(createAdminClient(), schoolId)
  if (!credentials) return false
  if (credentials.environment === 'production') return true
  return !!email && azulTesterEmails().includes(email.trim().toLowerCase())
}

export interface AzulPaymentForm {
  actionUrl: string
  fields: Record<string, string>
}

export type BuildAzulPaymentFormResult =
  | { ok: true; form: AzulPaymentForm }
  | { ok: false; error: string }

/**
 * Arma el formulario (URL + campos hidden, incluyendo AuthHash) que el
 * NAVEGADOR del cliente debe enviar por POST a Azul. También registra la
 * transacción en `azul_transactions` para poder correlacionar la
 * respuesta cuando Azul redirija de vuelta.
 */
export async function buildAzulPaymentForm(params: {
  schoolId: string
  familyId: string
  invoiceId: string
  siteUrl: string
}): Promise<BuildAzulPaymentFormResult> {
  const admin = createAdminClient()

  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select('id, school_id, family_id, total_amount, tax_amount, status')
    .eq('id', params.invoiceId)
    .eq('school_id', params.schoolId)
    .eq('family_id', params.familyId)
    .is('deleted_at', null)
    .single()

  if (invoiceError || !invoice) {
    return { ok: false, error: 'No se encontró la factura.' }
  }
  if (invoice.status !== 'pendiente' && invoice.status !== 'vencido') {
    return { ok: false, error: 'Esta factura ya no está pendiente de pago.' }
  }

  const credentials = await getSchoolAzulCredentials(admin, params.schoolId)
  if (!credentials) {
    return { ok: false, error: 'Este colegio todavía no tiene configurado el pago con tarjeta.' }
  }

  const orderNumber = crypto.randomUUID().replace(/-/g, '')
  const amount = toAzulAmount(invoice.total_amount)
  const itbis = toAzulAmount(invoice.tax_amount || 0)

  const approvedUrl = `${params.siteUrl}/api/pagos/azul/resultado`
  const declinedUrl = approvedUrl
  const cancelUrl = `${approvedUrl}?cancelado=1`

  const { error: insertError } = await admin.from('azul_transactions').insert({
    school_id: params.schoolId,
    invoice_id: invoice.id,
    order_number: orderNumber,
    amount: invoice.total_amount,
    status: 'pending',
  })
  if (insertError) {
    return { ok: false, error: 'No se pudo iniciar la transacción de pago.' }
  }

  const authHash = computeRequestAuthHash({
    merchantId: credentials.merchantId,
    merchantName: credentials.merchantName,
    merchantType: credentials.merchantType,
    currencyCode: credentials.currencyCode,
    orderNumber,
    amount,
    itbis,
    approvedUrl,
    declinedUrl,
    cancelUrl,
    authKey: credentials.authKey,
  })

  return {
    ok: true,
    form: {
      actionUrl: AZUL_URLS[credentials.environment],
      fields: {
        MerchantId: credentials.merchantId,
        MerchantName: credentials.merchantName,
        MerchantType: credentials.merchantType,
        CurrencyCode: credentials.currencyCode,
        OrderNumber: orderNumber,
        Amount: amount,
        ITBIS: itbis,
        ApprovedUrl: approvedUrl,
        DeclinedUrl: declinedUrl,
        CancelUrl: cancelUrl,
        UseCustomField1: '0',
        CustomField1Label: '',
        CustomField1Value: '',
        UseCustomField2: '0',
        CustomField2Label: '',
        CustomField2Value: '',
        AuthHash: authHash,
      },
    },
  }
}

export interface AzulResultParams {
  orderNumber: string
  amount: string
  authorizationCode: string
  dateTime: string
  responseCode: string
  isoCode: string
  responseMessage: string
  errorDescription: string
  rrn: string
  azulOrderId: string
  authHash: string
}

// test = el colegio tiene credenciales de PRUEBA: el resultado es real de
// Azul, pero no se registró ningún cobro ni se tocó la factura.
export type ProcessAzulResultOutcome =
  | { outcome: 'approved'; test: boolean }
  | { outcome: 'declined'; test: boolean }
  | { outcome: 'invalid'; reason: string }

/**
 * Procesa el redirect de vuelta de Azul. Regla de seguridad clave (no
 * negociable, pedida explícitamente en el mandato): NUNCA se marca una
 * factura como pagada solo porque el navegador dice "aprobada" -- se
 * recalcula el AuthHash de respuesta con el AuthKey del colegio
 * (nunca viaja en la URL) y se compara contra el que mandó Azul. Si no
 * coincide, se trata como inválida sin importar qué diga ResponseCode.
 */
export async function processAzulResult(params: AzulResultParams): Promise<ProcessAzulResultOutcome> {
  const admin = createAdminClient()

  const { data: txn } = await admin
    .from('azul_transactions')
    .select('id, school_id, invoice_id, status')
    .eq('order_number', params.orderNumber)
    .maybeSingle()

  if (!txn) {
    return { outcome: 'invalid', reason: 'Transacción desconocida.' }
  }

  const credentials = await getSchoolAzulCredentials(admin, txn.school_id)
  const isTest = credentials?.environment === 'test'

  // Idempotencia: si el navegador recarga la URL de retorno, no se
  // reprocesa (evita duplicar el registro en `payments`).
  if (txn.status !== 'pending') {
    return txn.status === 'approved' ? { outcome: 'approved', test: isTest } : { outcome: 'declined', test: isTest }
  }

  if (!credentials) {
    return { outcome: 'invalid', reason: 'El colegio ya no tiene credenciales de Azul configuradas.' }
  }

  const hashOk = verifyResponseAuthHash({
    orderNumber: params.orderNumber,
    amount: params.amount,
    authorizationCode: params.authorizationCode,
    dateTime: params.dateTime,
    responseCode: params.responseCode,
    isoCode: params.isoCode,
    responseMessage: params.responseMessage,
    errorDescription: params.errorDescription,
    rrn: params.rrn,
    authKey: credentials.authKey,
  }, params.authHash)

  if (!hashOk) {
    await admin.from('azul_transactions').update({
      status: 'error',
      response_payload: { ...params, hashVerified: false },
      updated_at: new Date().toISOString(),
    }).eq('id', txn.id)
    return { outcome: 'invalid', reason: 'No se pudo verificar la firma de la respuesta de Azul.' }
  }

  const approved = params.isoCode === '00'

  await admin.from('azul_transactions').update({
    status: approved ? 'approved' : 'declined',
    response_payload: { ...params, hashVerified: true },
    updated_at: new Date().toISOString(),
  }).eq('id', txn.id)

  if (!approved) {
    return { outcome: 'declined', test: isTest }
  }

  // MODO PRUEBA: el pago lo aprobó el ambiente de pruebas de Azul con una
  // tarjeta de prueba -- no entró dinero. Nunca se registra en `payments`
  // ni se marca la factura como pagada; solo queda la transacción anotada
  // (azul_transactions) y se manda el recibo marcado "[PRUEBA]" para poder
  // revisarlo durante la certificación.
  if (isTest) {
    const testReceipt = {
      schoolId: txn.school_id,
      invoiceId: txn.invoice_id,
      amount: Number(params.amount) / 100,
      authorizationCode: params.authorizationCode,
      azulReference: params.azulOrderId || params.rrn || null,
      azulDateTime: params.dateTime,
      isTest: true,
    }
    after(() => sendAzulPaymentReceipt(admin, testReceipt))
    return { outcome: 'approved', test: true }
  }

  const { data: invoice } = await admin
    .from('invoices')
    .select('total_amount')
    .eq('id', txn.invoice_id)
    .single()

  await admin.from('payments').insert({
    school_id: txn.school_id,
    invoice_id: txn.invoice_id,
    amount_paid: invoice?.total_amount ?? Number(params.amount) / 100,
    payment_method: 'azul',
    gateway_reference: params.azulOrderId || params.rrn,
    gateway_response: params,
    notes: `Pago con tarjeta vía Azul. Autorización ${params.authorizationCode}.`,
  })

  await admin.from('invoices').update({
    status: 'pagado',
    paid_at: new Date().toISOString(),
  }).eq('id', txn.invoice_id)

  // Recibo por correo (requisito de Azul). Solo llega aquí un pago con la
  // firma verificada y una sola vez por transacción (ver idempotencia arriba).
  // after(): se envía DESPUÉS de redirigir al padre, para que un correo lento
  // nunca lo deje esperando ni le muestre un error con el pago ya registrado.
  // sendAzulPaymentReceipt nunca lanza error.
  const receipt = {
    schoolId: txn.school_id,
    invoiceId: txn.invoice_id,
    amount: invoice?.total_amount ?? Number(params.amount) / 100,
    authorizationCode: params.authorizationCode,
    azulReference: params.azulOrderId || params.rrn || null,
    azulDateTime: params.dateTime,
  }
  after(() => sendAzulPaymentReceipt(admin, receipt))

  return { outcome: 'approved', test: false }
}
