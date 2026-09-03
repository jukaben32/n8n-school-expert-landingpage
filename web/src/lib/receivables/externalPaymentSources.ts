export const EXTERNAL_PAYMENT_SOURCES = [
  { value: 'alegra', label: 'Alegra (POS)' },
  { value: 'otro', label: 'Otra plataforma' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
] as const

export const EXTERNAL_PAYMENT_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  EXTERNAL_PAYMENT_SOURCES.map((s) => [s.value, s.label])
)
