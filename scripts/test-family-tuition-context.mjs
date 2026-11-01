#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba del texto de "Mensualidades" que recibe el asistente de IA de la
 * familia (web/src/lib/ai/familyTuitionContext.ts).
 *
 *   node --experimental-strip-types scripts/test-family-tuition-context.mjs
 *
 * Lo importante: que el asistente reciba el monto correcto y que NUNCA le
 * prometa a una familia el pago con tarjeta mientras Azul sigue en prueba.
 */
import { buildTuitionContextText } from '../web/src/lib/ai/familyTuitionContext.ts'

let fallos = 0
const contiene = (etiqueta, texto, fragmento, debe = true) => {
  const ok = texto.includes(fragmento) === debe
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${etiqueta}${ok ? '' : `  (${debe ? 'falta' : 'sobra'}: "${fragmento}")`}`)
}

const deudor = {
  studentName: 'Ana Pérez',
  monthlyAmount: 4100,
  currentAmount: 4100,
  overduePrincipal: 4100,
  lateFee: 574,
  totalDue: 8774,
  oldestReference: 'oct2026',
  futureMonthNames: ['diciembre 2026', 'enero 2027', 'febrero 2027', 'marzo 2027'],
  prepayExample: { monthsAhead: 3, discountPercent: 5, prepayGross: 12300, prepayDiscount: 615, total: 11685 },
}
const alDia = { ...deudor, studentName: 'Luis Pérez', currentAmount: 0, overduePrincipal: 0, lateFee: 0, totalDue: 0, futureMonthNames: [], prepayExample: null }
const base = { students: [deudor, alDia], prepayEnabled: true, prepayTiers: [{ months: 3, percent: 5 }], asOf: '2026-11-26' }

console.log('== Producción ==')
const prod = buildTuitionContextText({ ...base, cardMode: 'production' })
contiene('total del hijo que debe', prod, 'TOTAL A PAGAR HOY RD$8,774.00')
contiene('cuotas vencidas con referencia', prod, 'cuotas vencidas RD$4,100.00 (desde oct2026)')
contiene('hijo al día', prod, 'Luis Pérez: cuota mensual RD$4,100.00; está al día')
contiene('regla del día 25', prod, 'a partir del día 25')
contiene('pasos para pagar con tarjeta', prod, 'Pagar RD$… con tarjeta')
contiene('meses que quedan', prod, 'le quedan 4 meses por pagar este año escolar (diciembre 2026 a marzo 2027)')
contiene('nivel de descuento', prod, 'desde 3 meses, 5%')
contiene('ejemplo de adelanto', prod, 'adelantar 3 meses son RD$12,300.00, con 5% de descuento (−RD$615.00) queda en RD$11,685.00')
contiene('descuento no aplica a lo atrasado', prod, 'nunca sobre cuotas vencidas')

console.log('\n== Azul en prueba ==')
const test = buildTuitionContextText({ ...base, cardMode: 'test' })
contiene('avisa que todavía no está disponible', test, 'TODAVÍA NO está disponible para las familias')
contiene('no da los pasos del botón', test, 'Pagar RD$… con tarjeta', false)
contiene('no ofrece el adelanto con tarjeta', test, 'Pago de meses por adelantado:', false)
contiene('sí da el monto', test, 'TOTAL A PAGAR HOY RD$8,774.00')

console.log('\n== Sin adelantos ni descuento ==')
const sinAdelanto = buildTuitionContextText({ ...base, prepayEnabled: false, cardMode: 'production' })
contiene('dice que el adelanto es en secretaría', sinAdelanto, 'no permite adelantar meses por el portal')
const sinDescuento = buildTuitionContextText({ ...base, prepayTiers: [], students: [{ ...deudor, prepayExample: null }], cardMode: 'production' })
contiene('sin descuento: precio normal', sinDescuento, 'al precio normal')

console.log('\n== Sin mensualidad configurada ==')
contiene('mensaje claro', buildTuitionContextText({ ...base, students: [], cardMode: 'production' }), 'no hay mensualidad configurada')

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.')
process.exit(fallos ? 1 : 0)
