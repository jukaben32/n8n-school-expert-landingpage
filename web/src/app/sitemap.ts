import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicSiteUrl } from '@/lib/siteUrl'

/**
 * sitemap.xml — la lista de páginas públicas, para buscadores y IA.
 *
 * Solo entra lo que se puede ver sin sesión: la portada, los términos y la
 * página pública de cada colegio afiliado. El panel queda fuera a
 * propósito (además está bloqueado en robots.txt).
 *
 * Los colegios se leen de la base en vez de escribirlos a mano, para que
 * al dar de alta uno nuevo aparezca solo, sin tener que acordarse de
 * tocar este archivo.
 */
export const revalidate = 3600 // se regenera cada hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl() ?? 'https://www.educacionmanantial.com'
  const ahora = new Date()

  const fijas: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: ahora, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/terminos`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Si la consulta falla, se devuelve al menos lo fijo: un sitemap
  // incompleto es mucho mejor que un error que deja a Google sin nada.
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('schools')
      .select('subdomain, updated_at')
      .not('subdomain', 'is', null)

    if (error) {
      console.error('[sitemap] no se pudieron leer los colegios', error)
      return fijas
    }

    const colegios: MetadataRoute.Sitemap = (data ?? []).map((c) => ({
      url: `${siteUrl}/colegio/${c.subdomain}`,
      lastModified: c.updated_at ? new Date(c.updated_at as string) : ahora,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    return [...fijas, ...colegios]
  } catch (err) {
    console.error('[sitemap] fallo inesperado', err)
    return fijas
  }
}
