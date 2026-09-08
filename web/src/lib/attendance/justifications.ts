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
]

/** Lo que acepta el <input type="file"> del formulario del tutor. */
export const JUSTIFICATION_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

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

export function extensionForType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf'
  return mimeType.split('/')[1] ?? 'bin'
}
