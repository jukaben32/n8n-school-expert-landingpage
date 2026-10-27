#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba del recibo de pago con tarjeta (requisito de Azul) y de la
 * dirección con país que muestran el sitio y las políticas.
 *
 *   node --experimental-strip-types scripts/test-payment-receipt.mjs
 *
 * No toca ninguna base ni ninguna API: `receiptText.ts` y `contenido.ts`
 * son puros a propósito. La dirección es la real de Gran Manantial tal
 * como está guardada (con "R. D." y doble espacio).
 */
import { buildPaymentReceiptText, formatAzulDateTime, formatDOP } from '../web/src/lib/payments/receiptText.ts'
import { addressWithCountry } from '../web/src/app/colegio/[subdomain]/politicas/contenido.ts'

let fallos = 0
const check = (etiqueta, real, esperado) => {
  const ok = real === esperado
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${etiqueta} -> ${real}${ok ? '' : `  (esperado: ${esperado})`}`)
}
const contiene = (etiqueta, texto, parte) => check(etiqueta, texto.includes(parte), true)

console.log('== Dirección con país (Azul la exige completa) ==')
check('la real de Gran Manantial', addressWithCountry('Calle 2da #24, Villa Magdalena San Pedro de Macorís,  R. D.'),
  'Calle 2da #24, Villa Magdalena San Pedro de Macorís, República Dominicana')
check('termina en RD sin puntos', addressWithCountry('Calle 5, Santo Domingo RD'), 'Calle 5, Santo Domingo, República Dominicana')
check('ya dice el país', addressWithCountry('Av. Duarte 10, República Dominicana'), 'Av. Duarte 10, República Dominicana')
check('no menciona el país', addressWithCountry('Calle 1, La Romana'), 'Calle 1, La Romana, República Dominicana')
check('sin dirección', addressWithCountry(null), null)

console.log('\n== Fecha y monto ==')
check('DateTime de Azul', formatAzulDateTime('20261023103012'), '23/10/2026 10:30')
check('formato inesperado usa hora de RD', /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(formatAzulDateTime('ayer', new Date('2026-10-23T14:30:00Z'))), true)
check('pesos dominicanos', formatDOP(5000).includes('5,000.00'), true)

console.log('\n== Recibo completo ==')
const base = {
  schoolName: 'Centro Educativo Gran Manantial de Sabiduría',
  schoolAddress: 'Calle 2da #24, Villa Magdalena San Pedro de Macorís, República Dominicana',
  schoolPhone: '809-246-3587',
  schoolEmail: 'Cegmas@outlook.com',
  studentName: 'Ana Pérez',
  concept: 'Mensualidad octubre 2026',
  invoiceReference: 'B0100000123',
  amount: 5000,
  paidAt: '23/10/2026 10:30',
  authorizationCode: 'OK1234',
  azulReference: '987654321',
  refundPolicyUrl: 'https://www.educacionmanantial.com/colegio/gran-manantial-de-sabiduria/politicas/reembolsos',
}
const { subject, body } = buildPaymentReceiptText(base)
check('asunto', subject, 'Recibo de pago — Centro Educativo Gran Manantial de Sabiduría')
contiene('monto en RD$', body, 'Monto pagado: RD$')
contiene('código de autorización', body, 'Código de autorización: OK1234')
contiene('aclara que no es fiscal', body, 'no constituye un comprobante fiscal')
contiene('enlace a reembolsos', body, '/politicas/reembolsos')
contiene('contacto con mayúscula inicial', body, '? Escríbenos a Cegmas@outlook.com o llámanos al 809-246-3587')
check('nunca imprime "null"', body.includes('null'), false)

const sinDatos = buildPaymentReceiptText({ ...base, studentName: null, azulReference: null, schoolPhone: null, schoolEmail: null, refundPolicyUrl: null }).body
check('sin estudiante no hay línea vacía de estudiante', sinDatos.includes('Estudiante:'), false)
check('sin referencia AZUL no aparece', sinDatos.includes('Referencia AZUL'), false)
check('sin contacto no hay frase de contacto', sinDatos.includes('¿Tienes preguntas'), false)
check('sin datos tampoco imprime "null"', sinDatos.includes('null'), false)

console.log('\n== Recibo de un pago de PRUEBA (credenciales de prueba de Azul) ==')
const prueba = buildPaymentReceiptText({ ...base, isTest: true })
check('asunto marcado [PRUEBA]', prueba.subject.startsWith('[PRUEBA] '), true)
contiene('avisa que no hubo cobro', prueba.body, 'PAGO DE PRUEBA — no se realizó ningún cobro')
check('no dice que la factura se pagó', prueba.body.includes('ya aparece como pagada'), false)
check('un pago real no lleva la marca', body.includes('PAGO DE PRUEBA'), false)

console.log(fallos === 0 ? '\nTodas las comprobaciones OK' : `\n${fallos} comprobaciones FALLARON`)
process.exit(fallos === 0 ? 0 : 1)
