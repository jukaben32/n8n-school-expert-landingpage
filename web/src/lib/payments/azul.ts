import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

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

// Azul: "Se envía sin coma ni punto; los dos últimos dígitos representan
// los decimales." Ej. 1000 equivale a 10.00.
function toAzulAmount(amount: number): string {
  return Math.round(amount * 100).toString()
}

// El manual (acápite "Manejo de la Autenticación") calcula el hash sobre
// una cadena Unicode (UTF-16LE) en los ejemplos oficiales (C#/PHP) -- se
// sigue ese formato exactamente en vez de confiar en la nota genérica de
// que "el sistema acepta UTF-8 o Unicode indistintamente", para no
// arriesgar un mismatch de hash que no se puede probar en vivo sin
// credenciales reales de Azul.
function hmacSha512Hex(authKey: string, data: string): string {
  return crypto.createHmac('sha512', Buffer.from(authKey, 'utf16le'))
    .update(Buffer.from(data, 'utf16le'))
    .digest('hex')
}

interface RequestHashInput {
  merchantId: string
  merchantName: string
  merchantType: string
  currencyCode: string
  orderNumber: string
  amount: string
  itbis: string
  approvedUrl: string
  declinedUrl: string
  cancelUrl: string
  authKey: string
}

// Orden exacto documentado para una transacción de venta:
// MerchantId + MerchantName + MerchantType + CurrencyCode + OrderNumber +
// Amount + ITBIS + ApprovedUrl + DeclinedUrl + CancelUrl + UseCustomField1
// + CustomField1Label + CustomField1Value + UseCustomField2 +
// CustomField2Label + CustomField2Value + AuthKey
// (UseCustomField1/2 se envían siempre en "0" con labels/values vacíos --
// no se usan en este flujo).
function computeRequestAuthHash(input: RequestHashInput): string {
  const data =
    input.merchantId + input.merchantName + input.merchantType + input.currencyCode +
    input.orderNumber + input.amount + input.itbis + input.approvedUrl + input.declinedUrl +
    input.cancelUrl + '0' + '' + '' + '0' + '' + '' + input.authKey
  return hmacSha512Hex(input.authKey, data)
}

interface ResponseHashInput {
  orderNumber: string
  amount: string
  authorizationCode: string
  dateTime: string
  responseCode: string
  isoCode: string
  responseMessage: string
  errorDescription: string
  rrn: string
  authKey: string
}

// Orden exacto documentado para la respuesta:
// OrderNumber + Amount + AuthorizationCode + DateTime + ResponseCode +
// ISOCode + ResponseMessage + ErrorDescription + RRN + AuthKey
function computeResponseAuthHash(input: ResponseHashInput): string {
  const data =
    input.orderNumber + input.amount + input.authorizationCode + input.dateTime +
    input.responseCode + input.isoCode + input.responseMessage + input.errorDescription +
    input.rrn + input.authKey
  return hmacSha512Hex(input.authKey, data)
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

export type ProcessAzulResultOutcome =
  | { outcome: 'approved' }
  | { outcome: 'declined' }
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

  // Idempotencia: si el navegador recarga la URL de retorno, no se
  // reprocesa (evita duplicar el registro en `payments`).
  if (txn.status !== 'pending') {
    return txn.status === 'approved' ? { outcome: 'approved' } : { outcome: 'declined' }
  }

  const credentials = await getSchoolAzulCredentials(admin, txn.school_id)
  if (!credentials) {
    return { outcome: 'invalid', reason: 'El colegio ya no tiene credenciales de Azul configuradas.' }
  }

  const expectedHash = computeResponseAuthHash({
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
  })

  if (expectedHash.toLowerCase() !== params.authHash.toLowerCase()) {
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
    return { outcome: 'declined' }
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

  return { outcome: 'approved' }
}
