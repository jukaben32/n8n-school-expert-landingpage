// Etiquetas de la Solicitud de Empleo. Módulo PLANO (lo usan el formulario
// público, la Server Action y la bandeja de revisión) -- ver AGENTS.md.

export const POSITIONS = [
  { value: 'docente', label: 'Docente' },
  { value: 'auxiliar', label: 'Auxiliar de aula' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'otro', label: 'Otro' },
] as const

export const LEVELS = [
  { value: 'inicial', label: 'Nivel Inicial' },
  { value: 'primaria', label: 'Primaria' },
  { value: 'secundaria', label: 'Secundaria' },
] as const

export const SCHEDULES = [
  { value: 'manana', label: 'Tanda mañana' },
  { value: 'tarde', label: 'Tanda tarde' },
  { value: 'completa', label: 'Jornada completa' },
] as const

export const MARITAL = [
  { value: 'soltero', label: 'Soltero(a)' },
  { value: 'casado', label: 'Casado(a) / Unión libre' },
  { value: 'otro', label: 'Otro' },
] as const

export const REFERRALS = [
  { value: 'empleado', label: 'Recomendación de un empleado' },
  { value: 'redes', label: 'Redes sociales / Página web institucional' },
  { value: 'anuncio', label: 'Anuncio de empleo (plataforma digital)' },
  { value: 'cercania', label: 'Ubicación geográfica / Cercanía' },
  { value: 'otro', label: 'Otro' },
] as const

export const LICENSE = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'en_tramite', label: 'En trámite' },
] as const

export const EDUCATION_LEVELS = ['Grado / Licenciatura', 'Postgrado / Maestría', 'Técnico / Diplomado'] as const

export const APPLICATION_STATUSES = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'revisada', label: 'Revisada' },
  { value: 'entrevista', label: 'Citada a entrevista' },
  { value: 'descartada', label: 'Descartada' },
  { value: 'contratada', label: 'Contratada' },
] as const

export const labelOf = (list: readonly { value: string; label: string }[], value: string | null | undefined) =>
  list.find((i) => i.value === value)?.label ?? value ?? ''

/** Archivos adjuntos: CV y certificaciones. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const
export const FILE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*'
