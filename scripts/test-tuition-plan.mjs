#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba del cálculo del pago de mensualidad del Portal Familiar
 * (web/src/lib/payments/tuitionPlan.ts): cuotas futuras, saldo a favor,
 * descuento por pago adelantado y total.
 *
 *   node --experimental-strip-types scripts/test-tuition-plan.mjs
 *
 * Es el número que se le cobra al padre en Azul -- tsc/lint no se enteran
 * si alguien cambia una regla y el monto sale mal.
 */
import {
  buildTuitionQuote,
  formatPeriodMonth,
  futureUnpaidInstallments,
  normalizePrepayTiers,
  prepayDiscountPercent,
  todayInDominicanRepublic,
} from '../web/src/lib/payments/tuitionPlan.ts'

let fallos = 0
const check = (etiqueta, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado)
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${etiqueta} -> ${JSON.stringify(real)}${ok ? '' : `  (esperado: ${JSON.stringify(esperado)})`}`)
}

// Año escolar de 10.5 cuotas de RD$4,100 (Primaria): agosto es media cuota.
const meses = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06']
const schedule = meses.map((m, i) => ({ periodMonth: `${m}-01`, amount: i === 0 ? 2050 : 4100 }))

console.log('== Cuotas futuras (entran el día 25) ==')
// Pagado agosto, septiembre y octubre; noviembre pendiente.
check('al 24-nov, noviembre todavía es futura',
  futureUnpaidInstallments(schedule, 2050 + 4100 * 2, '2026-11-24').map((c) => c.periodMonth.slice(0, 7))[0], '2026-11')
check('al 25-nov, noviembre ya no es futura',
  futureUnpaidInstallments(schedule, 2050 + 4100 * 2, '2026-11-25').map((c) => c.periodMonth.slice(0, 7))[0], '2026-12')
check('al 25-nov quedan 7 meses futuros (dic..jun)',
  futureUnpaidInstallments(schedule, 0, '2026-11-25').length, 7)
check('saldo a favor de 1.5 cuotas cubre diciembre y la mitad de enero',
  // Pagado agosto..noviembre (2050 + 4100*3) más 6150 de saldo a favor.
  futureUnpaidInstallments(schedule, 2050 + 4100 * 3 + 6150, '2026-11-25').slice(0, 2),
  [{ periodMonth: '2027-01-01', amount: 2050 }, { periodMonth: '2027-02-01', amount: 4100 }])
check('año pagado completo: no quedan futuras',
  futureUnpaidInstallments(schedule, 2050 + 4100 * 10, '2026-11-25').length, 0)

console.log('\n== Niveles de descuento ==')
const tiers = normalizePrepayTiers([{ months: 10, percent: 10 }, { months: 3, percent: 5 }, { months: 0, percent: 50 }, { months: 2, percent: 0 }, 'basura'])
check('se descartan niveles inválidos y se ordenan', tiers, [{ months: 3, percent: 5 }, { months: 10, percent: 10 }])
check('2 meses: sin descuento', prepayDiscountPercent(2, tiers), 0)
check('3 meses: 5%', prepayDiscountPercent(3, tiers), 5)
check('7 meses: 5%', prepayDiscountPercent(7, tiers), 5)
check('10 meses: 10%', prepayDiscountPercent(10, tiers), 10)
check('jsonb que no es lista: sin niveles', normalizePrepayTiers({ months: 3 }), [])

console.log('\n== Total a cobrar ==')
const future = futureUnpaidInstallments(schedule, 2050 + 4100 * 2, '2026-11-26')
const soloDeuda = buildTuitionQuote({ principalDue: 8200, lateFee: 574, future, monthsAhead: 0, tiers })
check('solo lo debido + recargo', [soloDeuda.total, soloDeuda.prepayDiscount], [8774, 0])
const tres = buildTuitionQuote({ principalDue: 8200, lateFee: 574, future, monthsAhead: 3, tiers })
check('3 meses adelantados: 5% solo sobre los meses futuros',
  [tres.prepayGross, tres.discountPercent, tres.prepayDiscount, tres.total], [12300, 5, 615, 20459])
check('los meses son dic, ene, feb', tres.months.map((m) => m.periodMonth.slice(0, 7)), ['2026-12', '2027-01', '2027-02'])
const demasiados = buildTuitionQuote({ principalDue: 0, lateFee: 0, future, monthsAhead: 99, tiers })
check('no se pueden adelantar más meses de los que quedan', demasiados.monthsAhead, future.length)
const negativo = buildTuitionQuote({ principalDue: 0, lateFee: 0, future, monthsAhead: -2, tiers })
check('meses negativos cuentan como 0', [negativo.monthsAhead, negativo.total], [0, 0])
const centavos = buildTuitionQuote({ principalDue: 0, lateFee: 0, future: [{ periodMonth: '2027-01-01', amount: 3333.33 }, { periodMonth: '2027-02-01', amount: 3333.33 }, { periodMonth: '2027-03-01', amount: 3333.33 }], monthsAhead: 3, tiers })
check('redondeo a centavos', [centavos.prepayDiscount, centavos.total], [500, 9499.99])

console.log('\n== Formato ==')
check('nombre del mes', formatPeriodMonth('2026-12-01'), 'diciembre 2026')
check('hoy en RD (UTC 03:00 sigue siendo el día anterior)', todayInDominicanRepublic(new Date('2026-11-26T03:00:00Z')), '2026-11-25')

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.')
process.exit(fallos ? 1 : 0)
