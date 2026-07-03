import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente de Supabase para uso en el SERVIDOR (Server Components, Route Handlers, Server Actions).
 * Lee la sesión del usuario desde las cookies de Next.js.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // En Server Components solo se pueden leer cookies, no establecer.
            // El middleware se encarga de refrescar la sesión.
          }
        },
      },
    }
  )
}
