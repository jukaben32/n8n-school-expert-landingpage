/**
 * Acceso de los estudiantes.
 *
 * Los estudiantes no tienen correo electrónico, así que su cuenta de Auth
 * se identifica con un código de acceso convertido en un correo interno
 * (`{codigo}@estudiantes.mentoriapp.local`) que nunca se usa para enviar
 * nada. Es el mismo patrón que ya se usa con los tutores sin correo, que
 * entran con `{telefono}@mentoriapp.local`.
 *
 * El estudiante escribe SOLO el código en la pantalla de entrada; el
 * formulario le agrega el dominio (ver LoginForm.tsx).
 */

export const STUDENT_EMAIL_DOMAIN = 'estudiantes.mentoriapp.local'

/** Alfabeto sin 0/O/1/l/I: el código y la contraseña se copian a mano. */
const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomFrom(alphabet: string, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/** Código de acceso del estudiante, ej. "K7MPQ34". */
export function generateAccessCode(): string {
  return randomFrom(SAFE_CHARS, 7)
}

/** Contraseña temporal, ej. "R4TXKM92". */
export function generateStudentPassword(): string {
  return randomFrom(SAFE_CHARS, 8)
}

/** Convierte el código que escribe el estudiante en su correo interno. */
export function studentLoginEmail(accessCode: string): string {
  return `${accessCode.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`
}

/**
 * Normaliza lo que se escribió en la casilla de entrada.
 *
 * Si trae "@" se toma tal cual (personal y tutores entran con correo).
 * Si no, se asume que es el código de un estudiante y se le agrega el
 * dominio interno -- así el estudiante solo teclea "K7MPQ34".
 */
export function normalizeLoginIdentifier(value: string): string {
  const trimmed = value.trim()
  if (trimmed.includes('@')) return trimmed
  return studentLoginEmail(trimmed)
}
