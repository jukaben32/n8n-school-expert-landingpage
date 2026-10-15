// Módulo plano (sin 'use server' ni 'use client'): constantes y utilidades
// compartidas entre servidor y cliente. Ver AGENTS.md: nunca exportar
// constantes ni tipos desde un archivo con directiva.

export type PayslipRun = 'M' | 'Q1' | 'Q2'

export const PAYSLIP_RUNS: PayslipRun[] = ['M', 'Q1', 'Q2']

export const RUN_LABELS: Record<PayslipRun, string> = {
  M: 'Mensual',
  Q1: '1ª quincena',
  Q2: '2ª quincena',
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function isPayslipRun(value: unknown): value is PayslipRun {
  return value === 'M' || value === 'Q1' || value === 'Q2'
}

/** 202610 -> "Octubre 2026" */
export function monthLabel(periodKey: number): string {
  const year = Math.floor(periodKey / 100)
  const month = periodKey % 100
  return `${MONTHS[month - 1] ?? '?'} ${year}`
}

/** (202610, 'Q1') -> "Octubre 2026 · 1ª quincena" ; (202610, 'M') -> "Octubre 2026" */
export function periodLabel(periodKey: number, run: PayslipRun): string {
  return run === 'M' ? monthLabel(periodKey) : `${monthLabel(periodKey)} · ${RUN_LABELS[run]}`
}

export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Orden de las 26 columnas de la hoja Cierres del libro de nómina (A..Z). */
export const CIERRES_COLUMNS = [
  'periodo', 'anio', 'mes', 'id', 'empleado', 'cuenta_gasto', 'forma_pago',
  'sueldo', 'otros_ingresos', 'total_ganado', 'base_isr', 'afp', 'ars', 'isr',
  'seguro', 'colegiatura', 'club', 'avances', 'prestamos', 'cafeteria', 'uniformes',
  'otros_descuentos', 'total_deducciones', 'retiro_ahorro', 'neto', 'corrida',
] as const
