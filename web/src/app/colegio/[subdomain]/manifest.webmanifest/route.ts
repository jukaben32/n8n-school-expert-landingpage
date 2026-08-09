import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWebsiteSettings } from '@/lib/websiteSettings'

/**
 * Manifiesto de PWA dinámico, uno distinto por colegio -- "la puerta de
 * entrada a la landing del colegio" que pidió el usuario. Cada colegio
 * afiliado obtiene su propio ícono/nombre en la pantalla de inicio del
 * celular del padre, sin necesitar una app nativa de verdad.
 *
 * A PROPÓSITO no incluye ningún service worker (sw.js) -- ya se vivió un
 * problema real y doloroso con exactamente eso en este proyecto (ver
 * AGENTS.md, sección del bug de /sw.js bloqueado por el middleware). Un
 * manifest.webmanifest + los metadatos correctos ya permite "Agregar a
 * pantalla de inicio" en Android y iPhone sin ese riesgo. Si en el futuro
 * se quiere que funcione offline de verdad, eso se agrega aparte, con
 * mucho más cuidado.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const supabase = await createClient()
  const { data: school } = await supabase
    .from('schools_public')
    .select('name, tagline, logo_url, website_settings')
    .eq('subdomain', subdomain)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'Colegio no encontrado' }, { status: 404 })
  }

  const website = getWebsiteSettings(school.website_settings)

  // Si el colegio ya cargó su propio logo, se usa como ícono principal
  // (sizes "any" porque no controlamos las dimensiones reales de una URL
  // externa). Los íconos de MentorIApp quedan siempre como respaldo, para
  // que la instalación nunca se vea rota si el colegio no ha subido logo
  // todavía (como Gran Manantial de Sabiduría, al momento de escribir esto).
  const icons = [
    ...(school.logo_url ? [{ src: school.logo_url, sizes: 'any', type: 'image/png', purpose: 'any' as const }] : []),
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' as const },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' as const },
    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
  ]

  const manifest = {
    name: school.name,
    short_name: school.name.length > 20 ? school.name.slice(0, 17) + '...' : school.name,
    description: website.hero_subtitle || school.tagline || `Portal escolar de ${school.name}, en MentorIApp.`,
    start_url: `/colegio/${subdomain}`,
    scope: `/colegio/${subdomain}`,
    display: 'standalone',
    background_color: website.primary_color,
    theme_color: website.primary_color,
    icons,
  }

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}
