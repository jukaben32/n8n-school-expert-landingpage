/**
 * Justificación de ausencias — constantes y tipos compartidos.
 *
 * Módulo PLANO a propósito (sin 'use server'): lo importan tanto las Server
 * Actions como los componentes de cliente. Un archivo con 'use server' solo
 * puede exportar funciones async -- exportar un array/constante desde ahí
 * revienta en el navegador sin que tsc/eslint/build avisen (bug real del
 * 2026-09-03, ver AGENTS.md: EXTERNAL_PAYMENT_SOURCES tumbó Cuentas por
 * Cobrar entera).
 */

export const JUSTIFICATION_BUCKET = 'justificantes-ausencia'

/** Mismo tope que los comprobantes de pago del Portal Familiar. */
export const MAX_JUSTIFICATION_BYTES = 10 * 1024 * 1024

export const ALLOWED_JUSTIFICATION_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  // Formato nativo de las fotos del iPhone. Buena parte de las familias del
  // colegio entra desde iPhone: Safari normalmente convierte a JPG al subir
  // desde la galería, pero si la persona elige la foto desde la app
  // "Archivos" sube el HEIC tal cual -- sin esto, esa mamá recibiría
  // "Solo se aceptan imágenes o PDF" con una foto perfectamente válida.
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]

/**
 * Lo que acepta el <input type="file"> del formulario del tutor.
 *
 * Van las extensiones .heic/.heif además de los tipos MIME: hay
 * navegadores/sistemas que no reconocen 'image/heic' en el `accept` y
 * dejarían el archivo en gris sin poder elegirlo.
 */
export const JUSTIFICATION_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif,.heic,.heif'

/** Estados de asistencia que un tutor puede justificar. */
export const JUSTIFIABLE_ATTENDANCE_STATUSES = ['ausente', 'tardanza']

export type JustificationStatus = 'pendiente' | 'aceptada' | 'rechazada'

export const JUSTIFICATION_STATUS_LABEL: Record<JustificationStatus, string> = {
  pendiente: 'En revisión',
  aceptada: 'Aceptada',
  rechazada: 'No aceptada',
}

/** Una falta del hijo, con el estado de su justificación (si la hay). */
export interface JustifiableAbsence {
  attendanceId: string
  date: string
  status: string
  studentName: string
  subjectName: string | null
  justification: {
    id: string
    status: JustificationStatus
    reason: string
    hasDocument: boolean
    reviewNote: string | null
    createdAt: string
  } | null
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/heic-sequence': 'heic',
  'image/heif-sequence': 'heif',
}

export function extensionForType(mimeType: string): string {
  return EXTENSION_BY_TYPE[mimeType] ?? 'bin'
}

/**
 * El tipo real del archivo que sube el tutor.
 *
 * Existe por un caso concreto del iPhone: al elegir una foto desde la app
 * "Archivos" (o desde ciertos navegadores en Android), el `type` del File
 * llega VACÍO o como 'application/octet-stream'. Validar solo por `type`
 * rechazaría una foto perfectamente válida, así que cuando no viene se
 * deduce por la extensión del nombre.
 */
export function resolveFileType(fileName: string, fileType: string): string {
  if (fileType && fileType !== 'application/octet-stream') return fileType

  const extension = fileName.toLowerCase().split('.').pop() ?? ''
  const byExtension: Record<string, string> = {
    heic: 'image/heic',
    heif: 'image/heif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }
  return byExtension[extension] ?? fileType
}

/** ¿Es una foto de iPhone sin convertir? El colegio la tendrá que descargar. */
export function isHeic(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith('image/hei')
}
