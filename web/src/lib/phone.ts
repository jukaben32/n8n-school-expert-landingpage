/**
 * Utilidades sencillas para telefonos dominicanos/internacionales.
 *
 * El colegio suele escribirlos en formatos distintos: 809-000-0000,
 * (809) 000-0000, +1 809 000 0000. Para comparar usamos los ultimos 10
 * digitos; para enviar por WhatsApp agregamos el 1 si parece un numero RD.
 */

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizePhoneForMatch(value: string): string {
  return phoneDigits(value).slice(-10)
}

export function toWhatsAppNumber(value: string): string {
  const digits = phoneDigits(value)
  if (digits.length === 10) return `1${digits}`
  return digits
}

export function maskPhone(value: string): string {
  const normalized = normalizePhoneForMatch(value)
  if (normalized.length < 4) return 'tu numero'
  return `***-***-${normalized.slice(-4)}`
}

