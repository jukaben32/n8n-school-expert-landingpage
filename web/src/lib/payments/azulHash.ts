import crypto from 'node:crypto'

/**
 * Firmas (AuthHash) de la Página de Pago AZUL. Archivo PURO a propósito
 * (solo node:crypto, sin base de datos): así se puede probar contra los
 * ejemplos oficiales de Azul -- ver scripts/test-azul-hash.mjs.
 */

// Azul: "Se envía sin coma ni punto; los dos últimos dígitos representan
// los decimales." Ej. 1000 equivale a 10.00.
// Mínimo 3 dígitos: el ambiente de pruebas de Azul rechazó ITBIS "0" con
// "VALIDATION_ERROR:Itbis" (2026-10-26); exige "000". Las mensualidades no
// llevan ITBIS, así que sin esto NINGÚN pago podía empezar.
export function toAzulAmount(amount: number): string {
  return Math.round(amount * 100).toString().padStart(3, '0')
}

// Codificación verificada contra el ejemplo oficial que envió Azul
// ("Ejemplo Calculo Hash SALE", 2026-10-26, con resultado conocido): la
// LLAVE va siempre en UTF-8. Antes la llave también iba en UTF-16LE y la
// firma no coincidía con la de Azul -- ningún pago habría funcionado.
//  - Envío: texto en UTF-8 (igual al ejemplo PHP oficial).
//  - Respuesta: el documento técnico dice que Azul la arma "a partir de
//    una cadena Unicode" (su ejemplo PHP convierte solo el TEXTO a
//    UTF-16LE). Ver verifyResponseAuthHash().
function hmacSha512Hex(authKey: string, data: string, textEncoding: 'utf8' | 'utf16le' = 'utf8'): string {
  return crypto.createHmac('sha512', Buffer.from(authKey, 'utf8'))
    .update(Buffer.from(data, textEncoding))
    .digest('hex')
}

export interface RequestHashInput {
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
export function computeRequestAuthHash(input: RequestHashInput): string {
  const data =
    input.merchantId + input.merchantName + input.merchantType + input.currencyCode +
    input.orderNumber + input.amount + input.itbis + input.approvedUrl + input.declinedUrl +
    input.cancelUrl + '0' + '' + '' + '0' + '' + '' + input.authKey
  return hmacSha512Hex(input.authKey, data)
}

export interface ResponseHashInput {
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
export function computeResponseAuthHash(input: ResponseHashInput, textEncoding: 'utf8' | 'utf16le'): string {
  const data =
    input.orderNumber + input.amount + input.authorizationCode + input.dateTime +
    input.responseCode + input.isoCode + input.responseMessage + input.errorDescription +
    input.rrn + input.authKey
  return hmacSha512Hex(input.authKey, data, textEncoding)
}

/**
 * ¿La firma que mandó Azul es auténtica? Se prueba primero UTF-16LE (lo
 * que dice el documento técnico) y luego UTF-8 (el documento dice que
 * Azul acepta ambas en el envío). Las dos son HMAC con el AuthKey secreto
 * del colegio, así que aceptar cualquiera de las dos no debilita nada:
 * sin la llave nadie puede fabricar ninguna. Comparación en tiempo
 * constante para no filtrar la firma esperada byte a byte.
 */
export function verifyResponseAuthHash(input: ResponseHashInput, received: string): boolean {
  const got = Buffer.from(received.trim().toLowerCase(), 'utf8')
  return (['utf16le', 'utf8'] as const).some((enc) => {
    const expected = Buffer.from(computeResponseAuthHash(input, enc).toLowerCase(), 'utf8')
    return expected.length === got.length && crypto.timingSafeEqual(expected, got)
  })
}
