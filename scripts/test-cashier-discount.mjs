// Beca dada en caja (cashierTuitionDiscountPercent): descuento en la línea de
// mensualidad que no es pronto pago ni el medio mes de agosto. Casos reales
// de Alegra del año 2026-2027 (revisados el 2026-11-25), sin nombres: el repo es público.
// node --experimental-strip-types scripts/test-cashier-discount.mjs
import { cashierTuitionDiscountPercent } from '../web/src/lib/accounting/alegraMatching.ts'

const L = (price, quantity, discountAmount) => ({ name: 'Mensualidad', price, quantity, discountAmount, total: price * quantity - discountAmount })

const casos = [
  ['Secundaria: octubre con 50%', [L(4500, 1, 2250)], 4500, 'pago mensualidad de octubre.', 50],
  ['Secundaria: septiembre con 50%', [L(4500, 1, 2250)], 4500, 'pago mes de septiembre', 50],
  ['Primaria: sep y oct con 50% (2 cuotas)', [L(4100, 2, 4100)], 4100, 'Mes de sep y oct para [estudiante]', 50],
  ['Secundaria: noviembre con 10%', [L(4500, 1, 450)], 4500, 'Pago mensualidad de Noviembre con descuento, para [estudiante].', 10],
  ['Medio mes de agosto (50%) NO es beca', [L(4100, 1, 2050)], 4100, 'Medio mes de ago, mora y sep', null],
  ['MES DE AGOSTO (50%) NO es beca', [L(3900, 1, 1950)], 3900, 'MES DE AGOSTO', null],
  ['Año completo con 5% es pronto pago, NO beca', [L(48825, 1, 2441.25)], 4500, 'Pago año completo ( Agosto a Junio) con descuento', null],
  ['Mensualidad sin descuento', [L(4100, 1, 0)], 4100, 'pago mes de noviembre.', null],
  ['Recargo con 100% (mora perdonada) no es mensualidad', [{ name: 'Recargo por Mora', price: 980, quantity: 1, discountAmount: 980, total: 0 }], 3500, 'descuento por mora', null],
  ['Agosto con 75% (beca 50% sobre la media cuota) SÍ avisa', [L(4500, 1, 3375)], 4500, 'Medio mes de agosto', 75],
  ['Sin discountAmount: se deduce de price y total', [{ name: 'Mensualidad', price: 4100, quantity: 1, total: 3075 }], 4100, 'Mes de octubre', 25],
]

let fallos = 0
for (const [nombre, items, nivel, nota, esperado] of casos) {
  const r = cashierTuitionDiscountPercent(items, nivel, nota)
  const ok = r === esperado || (r !== null && esperado !== null && Math.abs(r - esperado) < 0.01)
  if (!ok) fallos++
  console.log(`${ok ? 'OK ' : 'MAL'} ${nombre} -> ${r}${ok ? '' : ` (esperado ${esperado})`}`)
}
console.log(`\n${casos.length - fallos} de ${casos.length} OK`)
process.exit(fallos ? 1 : 0)
