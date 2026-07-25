import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de Autenticación — SchoolOS
 *
 * Este middleware se ejecuta en CADA petición y se encarga de:
 * 1. Refrescar la sesión del usuario (tokens de Supabase Auth).
 * 2. Redirigir a /login si el usuario no está autenticado e intenta
 *    acceder a rutas protegidas.
 * 3. Redirigir al dashboard si el usuario ya está autenticado
 *    e intenta acceder a /login o /registro.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar la sesión (importante para tokens expirados)
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas públicas que NO requieren autenticación.
  // OJO: '/' se compara con igualdad exacta, nunca con startsWith, porque
  // TODA ruta empieza con '/' — usarlo en el .some(startsWith) de abajo
  // volvía "pública" cualquier ruta del sitio (incluido /dashboard/*),
  // desactivando por completo la protección del middleware.
  const publicPrefixRoutes = ['/login', '/registro', '/recuperar-contrasena', '/actualizar-contrasena', '/colegio', '/terminos']
  const isPublicRoute = pathname === '/' || publicPrefixRoutes.some(route => pathname.startsWith(route))

  // Si el usuario no está autenticado y quiere acceder a una ruta protegida
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si el usuario está autenticado y quiere ir a /login o /registro
  if (user && (pathname.startsWith('/login') || pathname.startsWith('/registro'))) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Aplica el middleware a todas las rutas excepto archivos estáticos y API de Next.js
    '/((?!_next/static|_next/image|favicon.ico|icon.*|manifest.*).*)',
  ],
}
