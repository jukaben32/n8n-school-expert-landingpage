import type { MetadataRoute } from 'next'
import { getPublicSiteUrl } from '@/lib/siteUrl'

/**
 * robots.txt — le dice a buscadores y rastreadores de IA qué pueden leer.
 *
 * Ojo: para que esta ruta llegue a existir de verdad hubo que excluir
 * `robots.txt` del matcher de `proxy.ts`. Antes el middleware de sesión la
 * interceptaba y devolvía un redirect a /login, así que el archivo era
 * inalcanzable aunque estuviera bien escrito.
 *
 * Se bloquea todo lo que hay detrás de la sesión: no aporta nada a nadie
 * que Google intente rastrear el panel (siempre recibiría /login) y evita
 * exponer la forma interna de la aplicación.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl() ?? 'https://www.educacionmanantial.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',   // todo el panel: requiere sesión
          '/login',
          '/registro',
          '/recuperar-contrasena',
          '/actualizar-contrasena',
          '/api/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
