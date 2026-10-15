import type { PayslipRun } from './labels'

// Local a propósito (sin import de valores): así este módulo se puede probar
// con `node --experimental-strip-types` sin resolver otros archivos.
const EXPECTED_COLUMNS = 26 // hoja Cierres, columnas A..Z (ver CIERRES_COLUMNS en labels.ts)
const isRun = (v: unknown): v is PayslipRun => v === 'M' || v === 'Q1' || v === 'Q2'

/**
 * Lee las filas que la persona copió de la hoja "Cierres" del libro de
 * nómina (26 columnas, separadas por tabulador al copiar desde Excel).
 *
 * Es una función PURA (sin Supabase, sin Next.js): por eso se puede probar
 * con scripts/test-payslip-parse.mjs. Todo lo que llega de aquí es entrada
 * del usuario: se valida fila por fila y se rechaza lo que no cuadra --
 * el neto tiene que ser exactamente ganado - deducciones + retiro de ahorro.
 */

export interface ParsedPayslip {
  periodKey: number
  run: PayslipRun
  excelId: string
  employeeName: string
  paymentMethod: string
  baseSalary: number
  otherIncome: number
  gross: number
  afp: number
  ars: number
  isr: number
  privateInsurance: number
  tuitionDiscount: number
  savingsDeposit: number
  advances: number
  loanInstallment: number
  cafeteria: number
  uniforms: number
  otherDeductions: number
  totalDeductions: number
  savingsWithdrawal: number
  net: number
}

export interface ParseResult {
  rows: ParsedPayslip[]
  errors: string[]
}

const TOLERANCE = 0.02
const round2 = (n: number) => Math.round(n * 100) / 100

/** "1,234.56" · "RD$ 1.234,56" · "" · "-" -> número (o NaN si no se entiende). */
export function parseMoney(raw: string | undefined): number {
  let s = (raw ?? '').trim().replace(/RD\$|\$|\s/g, '')
  if (s === '' || s === '-') return 0
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    // El que aparece último es el decimal.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma > -1) {
    // Solo comas: "1,234" (miles) o "12,5" (decimal).
    s = /,\d{1,2}$/.test(s) && s.indexOf(',') === lastComma ? s.replace(',', '.') : s.replace(/,/g, '')
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

export function parsePayslipPaste(text: string): ParseResult {
  const rows: ParsedPayslip[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return { rows, errors: ['No hay nada pegado.'] }
  if (lines.length > 400) return { rows, errors: ['Demasiadas filas (máximo 400 por carga).'] }

  lines.forEach((line, idx) => {
    const n = idx + 1
    const cells = line.split('\t').map((c) => c.trim())
    // Encabezado copiado junto con los datos: se ignora.
    // (solo si la primera celda NO es un número: un período mal escrito debe dar error, no pasar como encabezado)
    if (idx === 0 && !/^\d+$/.test(cells[0] ?? '')) return

    if (cells.length < EXPECTED_COLUMNS) {
      errors.push(`Fila ${n}: tiene ${cells.length} columnas y se esperan ${EXPECTED_COLUMNS} (copie las columnas A a Z de la hoja Cierres).`)
      return
    }
    const periodKey = Number(cells[0])
    const run = cells[25]
    const excelId = cells[3]
    const name = cells[4]
    if (!Number.isInteger(periodKey) || periodKey < 200001 || periodKey > 209912 || periodKey % 100 < 1 || periodKey % 100 > 12) {
      errors.push(`Fila ${n}: período inválido "${cells[0]}" (debe ser AAAAMM, por ejemplo 202610).`)
      return
    }
    if (!isRun(run)) {
      errors.push(`Fila ${n}: corrida inválida "${run}" (debe ser M, Q1 o Q2).`)
      return
    }
    if (!excelId || !name) {
      errors.push(`Fila ${n}: falta el ID o el nombre del empleado.`)
      return
    }
    const key = `${periodKey}|${run}|${excelId}`
    if (seen.has(key)) {
      errors.push(`Fila ${n}: ${excelId} aparece repetido en ${periodKey} ${run}.`)
      return
    }
    seen.add(key)

    const num = (i: number) => parseMoney(cells[i])
    const v = {
      sueldo: num(7), otros: num(8), ganado: num(9), afp: num(11), ars: num(12), isr: num(13), seguro: num(14),
      colegiatura: num(15), club: num(16), avances: num(17), prestamos: num(18), cafeteria: num(19), uniformes: num(20),
      otrosDesc: num(21), deducciones: num(22), retiro: num(23), neto: num(24),
    }
    const bad = Object.entries(v).find(([, x]) => Number.isNaN(x) || x < 0)
    if (bad) {
      errors.push(`Fila ${n} (${excelId}): el valor de "${bad[0]}" no es un monto válido.`)
      return
    }
    const sumDed = v.afp + v.ars + v.isr + v.seguro + v.colegiatura + v.club + v.avances + v.prestamos + v.cafeteria + v.uniformes + v.otrosDesc
    if (Math.abs(sumDed - v.deducciones) > TOLERANCE) {
      errors.push(`Fila ${n} (${excelId}): las deducciones no suman (${round2(sumDed)} contra ${v.deducciones}).`)
      return
    }
    if (Math.abs(v.ganado - v.deducciones + v.retiro - v.neto) > TOLERANCE) {
      errors.push(`Fila ${n} (${excelId}): el neto ${v.neto} no cuadra con ganado − deducciones + retiro.`)
      return
    }
    rows.push({
      periodKey, run, excelId, employeeName: name, paymentMethod: cells[6] || 'Banco',
      baseSalary: round2(v.sueldo), otherIncome: round2(v.otros), gross: round2(v.ganado), afp: round2(v.afp), ars: round2(v.ars),
      isr: round2(v.isr), privateInsurance: round2(v.seguro), tuitionDiscount: round2(v.colegiatura), savingsDeposit: round2(v.club),
      advances: round2(v.avances), loanInstallment: round2(v.prestamos), cafeteria: round2(v.cafeteria), uniforms: round2(v.uniformes),
      otherDeductions: round2(v.otrosDesc), totalDeductions: round2(v.deducciones), savingsWithdrawal: round2(v.retiro), net: round2(v.neto),
    })
  })
  return { rows, errors }
}
