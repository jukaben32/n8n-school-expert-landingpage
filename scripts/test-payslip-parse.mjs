#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba de la carga de comprobantes (lectura de lo pegado desde la hoja
 * Cierres), la sugerencia de empleado y el texto del correo.
 *
 *   node --experimental-strip-types scripts/test-payslip-parse.mjs
 *
 * Son módulos PUROS: no tocan ninguna base ni ninguna API.
 */
import assert from 'node:assert/strict'
import { parsePayslipPaste, parseMoney } from '../web/src/lib/payroll/parsePayslipPaste.ts'
import { suggestStaffId } from '../web/src/lib/payroll/matchStaff.ts'
import { composePayslipEmail } from '../web/src/lib/payroll/payslipEmail.ts'

let passed = 0
const check = (name, fn) => { fn(); passed += 1; console.log(`  OK  ${name}`) }

// Fila real de la hoja Cierres (Oct-2026 Q1, la Directora): 26 columnas A..Z
const cols = (over = {}) => {
  const base = ['202610', '2026', '10', 'E007', 'Vargas, Gladys Esther Tejada', '610101', 'Banco',
    '20000', '0', '20000', '18818', '574', '608', '221.33', '0', '0', '0', '2000', '0', '0', '0', '0', '3403.33', '0', '16596.67', 'Q1']
  Object.entries(over).forEach(([i, v]) => { base[Number(i)] = v })
  return base.join('\t')
}

check('una fila válida se lee completa', () => {
  const r = parsePayslipPaste(cols())
  assert.deepEqual(r.errors, [])
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].periodKey, 202610)
  assert.equal(r.rows[0].run, 'Q1')
  assert.equal(r.rows[0].net, 16596.67)
  assert.equal(r.rows[0].advances, 2000)
})
check('ignora el encabezado copiado junto con los datos', () => {
  const r = parsePayslipPaste(['Período', ...Array(25).fill('x')].join('\t') + '\n' + cols())
  assert.equal(r.rows.length, 1); assert.deepEqual(r.errors, [])
})
check('rechaza un neto que no cuadra', () => {
  const r = parsePayslipPaste(cols({ 24: '16600' }))
  assert.equal(r.rows.length, 0); assert.match(r.errors[0], /no cuadra/)
})
check('rechaza deducciones que no suman', () => {
  const r = parsePayslipPaste(cols({ 22: '3000', 24: '17000' }))
  assert.equal(r.rows.length, 0); assert.match(r.errors[0], /no suman/)
})
check('rechaza corrida o período inválidos', () => {
  assert.match(parsePayslipPaste(cols({ 25: 'Q3' })).errors[0], /corrida/)
  assert.match(parsePayslipPaste(cols({ 0: '202613' })).errors[0], /período/)
  assert.match(parsePayslipPaste(cols({ 0: '2026' })).errors[0], /período|columnas|^$/)
})
check('rechaza pocas columnas y montos no numéricos', () => {
  assert.match(parsePayslipPaste('202610\t2026\t10\tE001').errors[0], /columnas/)
  assert.match(parsePayslipPaste(cols({ 7: 'abc' })).errors[0], /monto/)
})
check('rechaza montos negativos y repetidos', () => {
  assert.match(parsePayslipPaste(cols({ 17: '-5' })).errors[0], /monto/)
  const dup = parsePayslipPaste(cols() + '\n' + cols())
  assert.equal(dup.rows.length, 1); assert.match(dup.errors[0], /repetido/)
})
check('nada pegado y demasiadas filas', () => {
  assert.match(parsePayslipPaste('   \n ').errors[0], /nada/)
  assert.match(parsePayslipPaste(Array(401).fill(cols()).join('\n')).errors[0], /Demasiadas/)
})
check('formatos de monto: miles, decimales, RD$, vacío', () => {
  assert.equal(parseMoney('1,234.56'), 1234.56)
  assert.equal(parseMoney('RD$ 1.234,56'), 1234.56)
  assert.equal(parseMoney('12,5'), 12.5)
  assert.equal(parseMoney('1,234'), 1234)
  assert.equal(parseMoney(''), 0)
  assert.equal(parseMoney('-'), 0)
  assert.ok(Number.isNaN(parseMoney('12a')))
})
check('con retiro de ahorro el neto sube y sigue cuadrando', () => {
  const r = parsePayslipPaste(cols({ 23: '1500', 24: '18096.67' }))
  assert.deepEqual(r.errors, []); assert.equal(r.rows[0].savingsWithdrawal, 1500)
})

const staff = [
  { id: 'a', name: 'Ana Danelia Calderon' }, { id: 'b', name: 'Gladys Esther Vargas Tejeda' },
  { id: 'c', name: 'Juana Iris Severino' }, { id: 'd', name: 'Maria Perez' }, { id: 'e', name: 'Maria Perez' },
]
check('sugiere al empleado aunque el nombre venga en otro orden', () => {
  assert.equal(suggestStaffId('Calderon A., Ana Danelia', staff), 'a')
  assert.equal(suggestStaffId('Vargas, Gladys Esther Tejada', staff), 'b')
  assert.equal(suggestStaffId('Severino, Juana Iris', staff), 'c')
})
check('no adivina: sin coincidencia o con empate devuelve null', () => {
  assert.equal(suggestStaffId('Pedro Gomez', staff), null)
  assert.equal(suggestStaffId('Perez, Maria', staff), null)
  assert.equal(suggestStaffId('', staff), null)
})
check('el correo NO lleva montos ni cifras salariales', () => {
  const m = composePayslipEmail({ firstName: 'Gladys', label: 'Octubre 2026 · 1ª quincena', schoolName: 'Colegio X', siteUrl: 'https://x.test/' })
  assert.match(m.subject, /Octubre 2026/)
  assert.match(m.body, /https:\/\/x\.test\/dashboard\/mi-nomina/)
  assert.ok(!/RD\$|\d{1,3}[.,]\d{3}|neto|sueldo|salario \d/i.test(m.body.replace('Octubre 2026', '').replace('2026', '')))
})

console.log(`\n${passed} comprobaciones OK`)
