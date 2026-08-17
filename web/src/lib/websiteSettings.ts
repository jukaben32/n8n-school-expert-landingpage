export type WebsiteTemplate = 'clasico' | 'moderno' | 'calido'
export type WebsiteFont = 'inter' | 'poppins' | 'merriweather'

export type SchoolWebsiteSettings = {
  isPublished: boolean
  template: WebsiteTemplate
  font: WebsiteFont
  heroTitle: string
  heroSubtitle: string
  heroImageUrl: string
  ctaLabel: string
  ctaSecondaryLabel: string
  primaryColor: string
  accentColor: string
  aboutTitle: string
  aboutStory: string
  aboutPhotoUrl: string
  yearsFounded: string
  studentsCount: string
  satisfactionPct: string
  trustBadges: string[]
  contactHours: string
  contactMapsUrl: string
  footerTagline: string
  socialFacebook: string
  socialInstagram: string
  socialYoutube: string
  socialTiktok: string
  socialLinkedin: string
}

const DEFAULT_WEBSITE_SETTINGS: SchoolWebsiteSettings = {
  isPublished: true,
  template: 'clasico',
  font: 'inter',
  heroTitle: '',
  heroSubtitle: '',
  heroImageUrl: '',
  ctaLabel: 'Iniciar sesión',
  ctaSecondaryLabel: '',
  primaryColor: '#1a5f7a',
  accentColor: '#d97706',
  aboutTitle: 'Sobre nosotros',
  aboutStory: '',
  aboutPhotoUrl: '',
  yearsFounded: '',
  studentsCount: '',
  satisfactionPct: '',
  trustBadges: [],
  contactHours: '',
  contactMapsUrl: '',
  footerTagline: '',
  socialFacebook: '',
  socialInstagram: '',
  socialYoutube: '',
  socialTiktok: '',
  socialLinkedin: '',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function pickText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function pickHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

const TEMPLATES: readonly WebsiteTemplate[] = ['clasico', 'moderno', 'calido']
const FONTS: readonly WebsiteFont[] = ['inter', 'poppins', 'merriweather']

/**
 * Acepta tanto el JSON completo de `schools.settings` como el objeto
 * directo que expone `schools_public.website_settings`.
 */
export function getWebsiteSettings(source: unknown): SchoolWebsiteSettings {
  const candidate = isRecord(source) && isRecord(source.website) ? source.website : source
  if (!isRecord(candidate)) return DEFAULT_WEBSITE_SETTINGS

  return {
    isPublished: pickBool(candidate.is_published, DEFAULT_WEBSITE_SETTINGS.isPublished),
    template: pickEnum(candidate.template, TEMPLATES, DEFAULT_WEBSITE_SETTINGS.template),
    font: pickEnum(candidate.font, FONTS, DEFAULT_WEBSITE_SETTINGS.font),
    heroTitle: pickText(candidate.hero_title, DEFAULT_WEBSITE_SETTINGS.heroTitle),
    heroSubtitle: pickText(candidate.hero_subtitle, DEFAULT_WEBSITE_SETTINGS.heroSubtitle),
    heroImageUrl: pickText(candidate.hero_image_url, DEFAULT_WEBSITE_SETTINGS.heroImageUrl),
    ctaLabel: pickText(candidate.cta_label, DEFAULT_WEBSITE_SETTINGS.ctaLabel),
    ctaSecondaryLabel: pickText(candidate.cta_secondary_label, DEFAULT_WEBSITE_SETTINGS.ctaSecondaryLabel),
    primaryColor: pickHexColor(candidate.primary_color, DEFAULT_WEBSITE_SETTINGS.primaryColor),
    accentColor: pickHexColor(candidate.accent_color, DEFAULT_WEBSITE_SETTINGS.accentColor),
    aboutTitle: pickText(candidate.about_title, DEFAULT_WEBSITE_SETTINGS.aboutTitle),
    aboutStory: pickText(candidate.about_story, DEFAULT_WEBSITE_SETTINGS.aboutStory),
    aboutPhotoUrl: pickText(candidate.about_photo_url, DEFAULT_WEBSITE_SETTINGS.aboutPhotoUrl),
    yearsFounded: pickText(candidate.years_founded, DEFAULT_WEBSITE_SETTINGS.yearsFounded),
    studentsCount: pickText(candidate.students_count, DEFAULT_WEBSITE_SETTINGS.studentsCount),
    satisfactionPct: pickText(candidate.satisfaction_pct, DEFAULT_WEBSITE_SETTINGS.satisfactionPct),
    trustBadges: pickStringArray(candidate.trust_badges),
    contactHours: pickText(candidate.contact_hours, DEFAULT_WEBSITE_SETTINGS.contactHours),
    contactMapsUrl: pickText(candidate.contact_maps_url, DEFAULT_WEBSITE_SETTINGS.contactMapsUrl),
    footerTagline: pickText(candidate.footer_tagline, DEFAULT_WEBSITE_SETTINGS.footerTagline),
    socialFacebook: pickText(candidate.social_facebook, DEFAULT_WEBSITE_SETTINGS.socialFacebook),
    socialInstagram: pickText(candidate.social_instagram, DEFAULT_WEBSITE_SETTINGS.socialInstagram),
    socialYoutube: pickText(candidate.social_youtube, DEFAULT_WEBSITE_SETTINGS.socialYoutube),
    socialTiktok: pickText(candidate.social_tiktok, DEFAULT_WEBSITE_SETTINGS.socialTiktok),
    socialLinkedin: pickText(candidate.social_linkedin, DEFAULT_WEBSITE_SETTINGS.socialLinkedin),
  }
}

export function buildWebsiteSettings(input: Partial<SchoolWebsiteSettings> | null | undefined): SchoolWebsiteSettings {
  const merged = { ...DEFAULT_WEBSITE_SETTINGS, ...input }
  return {
    isPublished: pickBool(merged.isPublished, DEFAULT_WEBSITE_SETTINGS.isPublished),
    template: pickEnum(merged.template, TEMPLATES, DEFAULT_WEBSITE_SETTINGS.template),
    font: pickEnum(merged.font, FONTS, DEFAULT_WEBSITE_SETTINGS.font),
    heroTitle: pickText(merged.heroTitle, DEFAULT_WEBSITE_SETTINGS.heroTitle),
    heroSubtitle: pickText(merged.heroSubtitle, DEFAULT_WEBSITE_SETTINGS.heroSubtitle),
    heroImageUrl: pickText(merged.heroImageUrl, DEFAULT_WEBSITE_SETTINGS.heroImageUrl),
    ctaLabel: pickText(merged.ctaLabel, DEFAULT_WEBSITE_SETTINGS.ctaLabel),
    ctaSecondaryLabel: pickText(merged.ctaSecondaryLabel, DEFAULT_WEBSITE_SETTINGS.ctaSecondaryLabel),
    primaryColor: pickHexColor(merged.primaryColor, DEFAULT_WEBSITE_SETTINGS.primaryColor),
    accentColor: pickHexColor(merged.accentColor, DEFAULT_WEBSITE_SETTINGS.accentColor),
    aboutTitle: pickText(merged.aboutTitle, DEFAULT_WEBSITE_SETTINGS.aboutTitle),
    aboutStory: pickText(merged.aboutStory, DEFAULT_WEBSITE_SETTINGS.aboutStory),
    aboutPhotoUrl: pickText(merged.aboutPhotoUrl, DEFAULT_WEBSITE_SETTINGS.aboutPhotoUrl),
    yearsFounded: pickText(merged.yearsFounded, DEFAULT_WEBSITE_SETTINGS.yearsFounded),
    studentsCount: pickText(merged.studentsCount, DEFAULT_WEBSITE_SETTINGS.studentsCount),
    satisfactionPct: pickText(merged.satisfactionPct, DEFAULT_WEBSITE_SETTINGS.satisfactionPct),
    trustBadges: pickStringArray(merged.trustBadges),
    contactHours: pickText(merged.contactHours, DEFAULT_WEBSITE_SETTINGS.contactHours),
    contactMapsUrl: pickText(merged.contactMapsUrl, DEFAULT_WEBSITE_SETTINGS.contactMapsUrl),
    footerTagline: pickText(merged.footerTagline, DEFAULT_WEBSITE_SETTINGS.footerTagline),
    socialFacebook: pickText(merged.socialFacebook, DEFAULT_WEBSITE_SETTINGS.socialFacebook),
    socialInstagram: pickText(merged.socialInstagram, DEFAULT_WEBSITE_SETTINGS.socialInstagram),
    socialYoutube: pickText(merged.socialYoutube, DEFAULT_WEBSITE_SETTINGS.socialYoutube),
    socialTiktok: pickText(merged.socialTiktok, DEFAULT_WEBSITE_SETTINGS.socialTiktok),
    socialLinkedin: pickText(merged.socialLinkedin, DEFAULT_WEBSITE_SETTINGS.socialLinkedin),
  }
}

// Convierte a las claves snake_case que se guardan en schools.settings.website.
export function websiteSettingsToJson(settings: SchoolWebsiteSettings): Record<string, unknown> {
  return {
    is_published: settings.isPublished,
    template: settings.template,
    font: settings.font,
    hero_title: settings.heroTitle,
    hero_subtitle: settings.heroSubtitle,
    hero_image_url: settings.heroImageUrl,
    cta_label: settings.ctaLabel,
    cta_secondary_label: settings.ctaSecondaryLabel,
    primary_color: settings.primaryColor,
    accent_color: settings.accentColor,
    about_title: settings.aboutTitle,
    about_story: settings.aboutStory,
    about_photo_url: settings.aboutPhotoUrl,
    years_founded: settings.yearsFounded,
    students_count: settings.studentsCount,
    satisfaction_pct: settings.satisfactionPct,
    trust_badges: settings.trustBadges,
    contact_hours: settings.contactHours,
    contact_maps_url: settings.contactMapsUrl,
    footer_tagline: settings.footerTagline,
    social_facebook: settings.socialFacebook,
    social_instagram: settings.socialInstagram,
    social_youtube: settings.socialYoutube,
    social_tiktok: settings.socialTiktok,
    social_linkedin: settings.socialLinkedin,
  }
}

export { DEFAULT_WEBSITE_SETTINGS }
