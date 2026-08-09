export type SchoolWebsiteSettings = {
  hero_title: string
  hero_subtitle: string
  cta_label: string
  primary_color: string
  accent_color: string
}

const DEFAULT_WEBSITE_SETTINGS: SchoolWebsiteSettings = {
  hero_title: '',
  hero_subtitle: '',
  cta_label: 'Iniciar sesión',
  primary_color: '#1a5f7a',
  accent_color: '#d97706',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function pickText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function pickHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback
}

/**
 * Acepta tanto el JSON completo de `schools.settings` como el objeto
 * directo que expone `schools_public.website_settings`.
 */
export function getWebsiteSettings(source: unknown): SchoolWebsiteSettings {
  const candidate = isRecord(source) && isRecord(source.website) ? source.website : source

  if (!isRecord(candidate)) {
    return DEFAULT_WEBSITE_SETTINGS
  }

  return {
    hero_title: pickText(candidate.hero_title, DEFAULT_WEBSITE_SETTINGS.hero_title),
    hero_subtitle: pickText(candidate.hero_subtitle, DEFAULT_WEBSITE_SETTINGS.hero_subtitle),
    cta_label: pickText(candidate.cta_label, DEFAULT_WEBSITE_SETTINGS.cta_label),
    primary_color: pickHexColor(candidate.primary_color, DEFAULT_WEBSITE_SETTINGS.primary_color),
    accent_color: pickHexColor(candidate.accent_color, DEFAULT_WEBSITE_SETTINGS.accent_color),
  }
}

export function buildWebsiteSettings(input: Partial<SchoolWebsiteSettings> | null | undefined): SchoolWebsiteSettings {
  return {
    hero_title: pickText(input?.hero_title, DEFAULT_WEBSITE_SETTINGS.hero_title),
    hero_subtitle: pickText(input?.hero_subtitle, DEFAULT_WEBSITE_SETTINGS.hero_subtitle),
    cta_label: pickText(input?.cta_label, DEFAULT_WEBSITE_SETTINGS.cta_label),
    primary_color: pickHexColor(input?.primary_color, DEFAULT_WEBSITE_SETTINGS.primary_color),
    accent_color: pickHexColor(input?.accent_color, DEFAULT_WEBSITE_SETTINGS.accent_color),
  }
}

export { DEFAULT_WEBSITE_SETTINGS }
