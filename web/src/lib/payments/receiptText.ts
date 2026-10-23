/**
 * Texto del recibo de pago que recibe la familia cuando AZUL aprueba un
 * pago con tarjeta. Es una función pura (sin base de datos ni red) para
 * poder usarla igual en el correo real y en el modelo de recibo que pidió
 * Azul (correo del 2026-10-20: "Enviar modelo del recibo o comprobante de
 * pago que le enviarán al cliente luego del pago").
 *
 * Es un RECIBO DE PAGO, no un comprobante fiscal: el NCF real lo emite el
 * colegio en Alegra (ver AGENTS.md, "Advertencia fiscal"). Por eso el
 * texto lo aclara al final.
 */

export interface PaymentReceiptData {
  schoolName: string
  schoolAddress: string | null // ya con el país (addressWithCountry)
  schoolPhone: string | null
  schoolEmail: string | null
  studentName: string | null
  concept: string
  invoiceReference: string
  amount: number
  paidAt: string // texto ya formateado, hora de República Dominicana
  authorizationCode: string
  azulReference: string | null
  refundPolicyUrl: string | null
}

// Monto en pesos dominicanos, igual que el resto del Portal (RD$5,000.00)
export function formatDOP(amount: number): string {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount)
}

/**
 * Azul manda DateTime como "AAAAMMDDHHMMSS" en hora local dominicana.
 * Si no viene o no tiene ese formato, se usa la hora actual de RD.
 */
export function formatAzulDateTime(raw: string | null | undefined, now: Date = new Date()): string {
  const m = raw?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`
  return new Intl.DateTimeFormat('es-DO', {
    timeZone: 'America/Santo_Domingo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now).replace(',', '')
}

export function buildPaymentReceiptText(d: PaymentReceiptData): { subject: string; body: string } {
  const contact = [d.schoolEmail && `escríbenos a ${d.schoolEmail}`, d.schoolPhone && `llámanos al ${d.schoolPhone}`]
    .filter(Boolean)
    .join(' o ')

  // Solo se incluyen las líneas que tienen dato, para no mostrar "null"
  const lines = [
    'Hola,',
    '',
    'Recibimos tu pago con tarjeta. Este es tu recibo.',
    '',
    'RECIBO DE PAGO',
    '----------------------------------------',
    d.schoolName,
    d.schoolAddress,
    [d.schoolPhone, d.schoolEmail].filter(Boolean).join(' · ') || null,
    '----------------------------------------',
    d.studentName ? `Estudiante: ${d.studentName}` : null,
    `Concepto: ${d.concept}`,
    `Factura: ${d.invoiceReference}`,
    `Monto pagado: ${formatDOP(d.amount)}`,
    `Fecha y hora: ${d.paidAt}`,
    'Forma de pago: Tarjeta, procesada por AZUL (Banco Popular Dominicano)',
    `Código de autorización: ${d.authorizationCode}`,
    d.azulReference ? `Referencia AZUL: ${d.azulReference}` : null,
    '----------------------------------------',
    '',
    'La factura ya aparece como pagada en el Portal Familiar.',
    '',
    'Este documento es un recibo de pago y no constituye un comprobante fiscal.',
    '',
    contact ? `¿Tienes preguntas o necesitas un reembolso? ${contact[0].toUpperCase()}${contact.slice(1)}, indicando el número de factura.` : null,
    d.refundPolicyUrl ? `Política de reembolsos: ${d.refundPolicyUrl}` : null,
  ]

  return {
    subject: `Recibo de pago — ${d.schoolName}`,
    // Las líneas '' son renglones en blanco a propósito; null = dato que no hay
    body: lines.filter((l): l is string => typeof l === 'string').join('\n'),
  }
}
