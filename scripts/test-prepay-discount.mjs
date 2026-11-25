// Descuento por pronto pago anotado en líneas de Alegra (explicitPrepayDiscount).
// node --experimental-strip-types scripts/test-prepay-discount.mjs
import { explicitPrepayDiscount } from '../web/src/lib/accounting/alegraMatching.ts'

const casos = [
  // Reales (Alegra, 2026-08/11)
  ['Leydy George: año Secundaria con 5%', [{ name: 'Mensualidad', price: 47250, quantity: 1, discountAmount: 2362.5, total: 44887.5 }, { name: 'Recargo por Mora', price: 167.08, quantity: 1, discountAmount: 0, total: 167.08 }], 4500, 2362.5],
  ['Hirujo: nov-jun Inicial con 5%', [{ name: 'Mensualidad', price: 31200, quantity: 1, discountAmount: 1560, total: 29640 }], 3900, 1560],
  ['Quency: medio mes de agosto (50%) NO es descuento', [{ name: 'Mensualidad', price: 19372.5, quantity: 1, discountAmount: 0, total: 19372.5 }, { name: 'Mensualidad', price: 4100, quantity: 1, discountAmount: 2050, total: 2050 }], 4100, 0],
  ['Mack King: medio mes Secundaria (50%) NO es descuento', [{ name: 'Mensualidad', price: 4500, quantity: 1, discountAmount: 2250, total: 2250 }], 4500, 0],
  ['Maria Luisa: 12.5% sobre UNA cuota NO cuenta (no es adelanto)', [{ name: 'Mensualidad', price: 4000, quantity: 1, discountAmount: 500, total: 3500 }], 4000, 0],
  // Sintéticos
  ['dos meses con 5% (precio x cantidad)', [{ name: 'Mensualidad', price: 4100, quantity: 2, discountAmount: 410, total: 7790 }], 4100, 410],
  ['descuento > 25% se ignora (beca o error)', [{ name: 'Mensualidad', price: 41000, quantity: 1, discountAmount: 12300, total: 28700 }], 4100, 0],
  ['libros con descuento no cuentan', [{ name: 'Libros', price: 20000, quantity: 1, discountAmount: 2000, total: 18000 }], 4100, 0],
  ['sin datos de precio (listado resumido)', [{ name: 'Mensualidad', total: 38745 }], 4100, 0],
  ['sin cuota conocida', [{ name: 'Mensualidad', price: 47250, quantity: 1, discountAmount: 2362.5, total: 44887.5 }], 0, 0],
  // Con beca registrada en la plataforma (2026-11-25): la parte que es beca
  // NO es pronto pago; la cuota ya viene descontada.
  ['beca 50%: sep-oct con 50% = solo la beca, 0 de pronto pago', [{ name: 'Mensualidad', price: 4100, quantity: 2, discountAmount: 4100, total: 4100 }], 2050, 0, 50],
  ['beca 25%: dos meses con 25% = solo la beca', [{ name: 'Mensualidad', price: 4100, quantity: 2, discountAmount: 2050, total: 6150 }], 3075, 0, 25],
  ['beca 50% + 5% de pronto pago en un año', [{ name: 'Mensualidad', price: 45000, quantity: 1, discountAmount: 24750, total: 20250 }], 2250, 2250, 50],
  ['beca 50% y caja cobró el neto sin %: nada extra', [{ name: 'Mensualidad', price: 2250, quantity: 2, discountAmount: 0, total: 4500 }], 2250, 0, 50],
]

let fallos = 0
for (const [nombre, items, cuota, esperado, beca = 0] of casos) {
  const r = explicitPrepayDiscount(items, cuota, beca)
  const ok = Math.abs(r - esperado) < 0.005
  if (!ok) fallos++
  console.log(`${ok ? 'OK ' : 'MAL'} ${nombre} -> ${r}${ok ? '' : ` (esperado ${esperado})`}`)
}
console.log(`\n${casos.length - fallos} de ${casos.length} OK`)
process.exit(fallos ? 1 : 0)
