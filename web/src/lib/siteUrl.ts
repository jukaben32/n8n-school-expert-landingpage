const LOCAL_SITE_URL = 'http://localhost:3000'

/**
 * Returns the public site URL used in redirects and absolute links.
 *
 * In local development we fall back to localhost so the app remains easy
 * to run. In production we require NEXT_PUBLIC_SITE_URL to be set
 * explicitly, otherwise returning localhost would silently break emails
 * and payment redirects.
 */
export function getPublicSiteUrl(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) return siteUrl.replace(/\/$/, '')

  return process.env.NODE_ENV === 'production' ? null : LOCAL_SITE_URL
}
