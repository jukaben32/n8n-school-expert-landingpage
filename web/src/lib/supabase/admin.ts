import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente administrativo de Supabase — usa la service_role key, que se
 * salta TODAS las políticas de RLS y puede crear usuarios de Auth
 * directamente (admin.inviteUserByEmail, admin.createUser, etc.).
 *
 * REGLA DE ORO: este archivo solo se importa desde Server Actions o
 * Route Handlers ('use server' / archivos server-only). Jamás desde un
 * componente cliente ('use client') -- si la key llegara al bundle del
 * navegador, cualquier visitante tendría control total de la base de
 * datos, saltándose toda la seguridad multi-colegio que construimos.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL) en las variables de entorno del servidor.'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
