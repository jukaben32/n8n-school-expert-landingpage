import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase para PÁGINAS PÚBLICAS del servidor (ej.
 * /colegio/[subdomain]) -- a propósito NO lee ni depende de las cookies de
 * sesión del visitante, a diferencia de lib/supabase/server.ts.
 *
 * Bug real que esto corrige: esas páginas son de acceso libre (cualquiera
 * las puede abrir, con o sin cuenta), pero el cliente atado a cookies
 * (createServerClient de @supabase/ssr) intenta usar la sesión del
 * visitante si trae una -- si esa cookie está vencida o corrupta, Supabase
 * puede rechazar la consulta, y como el código que la llama solo
 * desestructura `data` (ignorando `error`), la página termina mostrando
 * "no encontrado" para un colegio que sí existe. Un cliente anónimo nuevo,
 * sin cookies, nunca depende del estado de sesión de quien visita.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
