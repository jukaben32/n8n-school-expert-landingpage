import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkGuardianOverdueBlock } from '@/lib/receivables/guardianBlock'

/**
 * Middleware de Autenticación — MentorIApp
 *
 * Este middleware se ejecuta en CADA petición y se encarga de:
 * 1. Refrescar la sesión del usuario (tokens de Supabase Auth).
 * 2. Redirigir a /login si el usuario no está autenticado e intenta
 *    acceder a rutas protegidas.
 * 3. Redirigir al dashboard si el usuario ya está autenticado
 *    e intenta acceder a /login o /registro.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // Rutas públicas que NO requieren autenticación.
  // OJO: '/' se compara con igualdad exacta, nunca con startsWith, porque
  // TODA ruta empieza con '/' — usarlo en el .some(startsWith) de abajo
  // volvía "pública" cualquier ruta del sitio (incluido /dashboard/*),
  // desactivando por completo la protección del middleware.
  // /api/pagos/azul es el callback público de Azul (ver web/src/lib/payments/azul.ts):
  // el navegador del cliente vuelve ahí después de pagar y puede no traer una
  // sesión válida (cookies bloqueadas, sesión expirada durante el pago, etc.).
  // La seguridad de esa ruta viene de verificar el AuthHash de la respuesta de
  // Azul, no de la sesión -- si el middleware la tratara como protegida, un pago
  // real aprobado podría perderse silenciosamente al redirigir a /login en vez
  // de confirmar la factura (mismo tipo de bug que el de sw.js, ver más abajo).
  const publicPrefixRoutes = ['/login', '/registro', '/recuperar-contrasena', '/actualizar-contrasena', '/colegio', '/terminos', '/api/pagos/azul']
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

  // Fase 2 de Cuentas por Cobrar: un tutor (guardian) con algún hijo con más
  // de 60 días de mora queda confinado a /dashboard/pagos. Se resuelve aquí
  // (middleware, un 307 HTTP normal, antes de que arranque el árbol de
  // Server Components) y NO dentro de dashboard/layout.tsx -- un redirect()
  // lanzado desde dentro de ese árbol durante la navegación de cliente que
  // dispara LoginForm.tsx (router.push + router.refresh()) entra en
  // conflicto con cómo el App Router resuelve esa redirección: se
  // reprodujo en producción un bucle infinito de refetch RSC que dejaba al
  // tutor con la pantalla en blanco, curable solo con un recargo manual.
  // Consulta el perfil solo cuando hace falta (rutas /dashboard/* que no
  // sean ya /dashboard/pagos) para no gastar una consulta extra en cada
  // petición de cada rol.
  if (user && pathname.startsWith('/dashboard/') && !pathname.startsWith('/dashboard/pagos')) {
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role, guardian_id')
      .eq('auth_id', user.id)
      .single()

    if (profile?.role === 'guardian' && profile.guardian_id) {
      const isBlocked = await checkGuardianOverdueBlock(profile.guardian_id)
      if (isBlocked) {
        const pagosUrl = request.nextUrl.clone()
        pagosUrl.pathname = '/dashboard/pagos'
        return NextResponse.redirect(pagosUrl)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Aplica el middleware a todas las rutas excepto archivos estáticos y API de Next.js.
    // sw.js es crítico: es el "kill switch" que reemplaza el service worker atascado
    // de la landing vieja (ver web/public/sw.js). Si el middleware lo intercepta y
    // redirige a /login (como pasaba antes de este fix), el navegador nunca recibe
    // JavaScript válido para ese registro -- el service worker viejo nunca se
    // actualiza/autodestruye, y esa persona sigue viendo el contenido viejo para
    // siempre, sin importar qué tan bien esté desplegado el sitio nuevo.
    //
    // robots.txt / sitemap.xml / llms.txt caían en la misma trampa: el
    // middleware los redirigía a /login, así que Google y los rastreadores
    // de IA recibían una página de inicio de sesión en vez del archivo. Con
    // eso el sitio era invisible -- no hay forma de indexar lo que no se
    // puede leer. Comprobado en producción antes del fix: los tres
    // devolvían 307 hacia /login.
    '/((?!_next/static|_next/image|favicon.ico|icon.*|manifest.*|sw\\.js|robots\\.txt|sitemap\\.xml|llms\\.txt).*)',
  ],
}
