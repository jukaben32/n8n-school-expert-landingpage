'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente de Supabase para uso en el NAVEGADOR (Client Components).
 * Usa las variables de entorno públicas (NEXT_PUBLIC_*).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
