// Pruebas del detector de "pago del año completo" en notas de Alegra.
// node --experimental-strip-types scripts/test-annual-prepay-note.mjs
import { looksLikeAnnualPrepayment } from '../web/src/lib/accounting/annualPrepayNote.ts'

const casos = [
  // Notas reales de Alegra que SÍ son el año completo
  ['AGO-JUN', true],
  ['DE OCT-JUN Y MORA', true],
  ['10.5 meses y mora de agosto 167.08', true],
  ['10.5 Mese pago, con el descuento aplicado.', true],
  ['10.5 mes pagos, mas mora del mes de agosto', true],
  ['Pago del año completo para Julio Dairon Astacio Jimenez, con decuneto aplicado.', true],
  ['Pago año completo (Noviembre 2026 a Junio 2027) con descuento, para Noah Gael Hirujo Crispin.', true],
  ['pago de sep a junio', true],
  ['hasta junio', true],
  ['pago anual', true],
  // Notas reales que NO lo son
  ['AGO-ENE', false],
  ['MES DE JUNIO', false],
  ['Mes de jun', false],
  ['Pago ago mas mora de ago y abono a sep', false],
  ['Saldo el mes de sep', false],
  ['MENSUALIDAD', false],
  ['mes de octubre', false],
  ['', false],
  [null, false],
]

let fallos = 0
for (const [nota, esperado] of casos) {
  const r = looksLikeAnnualPrepayment(nota)
  const ok = r === esperado
  if (!ok) fallos++
  console.log(`${ok ? 'OK ' : 'MAL'} ${JSON.stringify(nota)} -> ${r}`)
}
console.log(`\n${casos.length - fallos} de ${casos.length} OK`)
process.exit(fallos ? 1 : 0)
