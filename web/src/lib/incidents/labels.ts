// Etiquetas del Registro de Incidencias. Módulo PLANO a propósito: lo usan
// páginas de servidor, componentes cliente y la Server Action -- ver la
// regla de AGENTS.md (nada compartido vive en un archivo 'use server' ni
// 'use client').

export const SEVERITIES = [
  { value: 'leve', label: 'Leve', hint: 'Interrupción, falta de higiene, uso de celular, retraso, lenguaje inadecuado.' },
  { value: 'grave', label: 'Grave', hint: 'Reincidencia, bullying, daños a la propiedad, salida sin permiso, fraude.' },
  { value: 'muy_grave', label: 'Muy grave', hint: 'Violencia física, sustancias prohibidas, armas, desafío grave a la autoridad.' },
] as const

export const LOCATIONS = [
  { value: 'aula', label: 'Aula' },
  { value: 'recreo', label: 'Recreo' },
  { value: 'pasillo', label: 'Pasillo' },
  { value: 'otro', label: 'Otro' },
] as const

export const MEASURES = [
  { value: 'dialogo', label: 'Diálogo reflexivo individual' },
  { value: 'amonestacion', label: 'Amonestación verbal / Compromiso escrito' },
  { value: 'orientacion', label: 'Remisión a Orientación y Psicología' },
  { value: 'citacion_padres', label: 'Citación a padres / tutores' },
  { value: 'reparacion', label: 'Reparación del daño (acción restaurativa)' },
] as const

export const STATUSES = [
  { value: 'abierto', label: 'Abierto' },
  { value: 'en_seguimiento', label: 'En seguimiento' },
  { value: 'cerrado', label: 'Cerrado' },
] as const

export const labelOf = (list: readonly { value: string; label: string }[], value: string | null | undefined) =>
  list.find((i) => i.value === value)?.label ?? value ?? ''

/** "La Regla del 3": 3 faltas leves en 30 días se tratan como falta grave por reincidencia. */
export const RECIDIVISM_LEVES = 3
export const RECIDIVISM_DAYS = 30
