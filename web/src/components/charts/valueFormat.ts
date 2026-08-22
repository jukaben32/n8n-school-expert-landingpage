/**
 * Los gráficos reciben `valueFormat` como string (no una función) a
 * propósito: se usan desde Server Components (ej. reportes/page.tsx), y
 * Next.js no puede serializar una función de un Server Component a un
 * Client Component. El formateo real se resuelve del lado cliente, aquí.
 */
export type ValueFormat = 'percent' | 'currency-dop'

export const VALUE_FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  percent: (v) => `${v}%`,
  'currency-dop': (v) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(v),
}

export function resolveValueFormatter(valueFormat?: ValueFormat): ((v: number) => string) | undefined {
  return valueFormat ? VALUE_FORMATTERS[valueFormat] : undefined
}
