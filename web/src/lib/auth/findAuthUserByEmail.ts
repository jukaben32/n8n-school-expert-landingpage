import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

const PAGE_SIZE = 200
const MAX_PAGES = 50 // 10.000 cuentas -- techo de seguridad, no un límite real

/**
 * Busca una cuenta de Auth por correo, recorriendo TODAS las páginas.
 *
 * Existe por un bug real (2026-09-08, al dar de alta al dueño del colegio):
 * los tres flujos de invitación llamaban a `admin.auth.admin.listUsers()`
 * sin paginar. Ese método devuelve **solo las primeras 50 cuentas**, así que
 * en cuanto el proyecto pasó de 50 usuarios de Auth (hoy son 96, y subiendo
 * con la campaña de acceso a las familias), cualquier persona cuya cuenta
 * quedara fuera de esa primera página se veía como "no existe" -- y quien
 * invitaba recibía "Ese correo ya está registrado, pero no se pudo vincular.
 * Contacta soporte", sin ninguna forma de arreglarlo desde la interfaz.
 *
 * El fallo era además silencioso y creciente: funcionaba en las pruebas
 * (pocos usuarios) y se iba rompiendo para más gente conforme crecía el
 * colegio.
 *
 * La comparación es en minúsculas: Auth guarda el correo normalizado, pero
 * el que se teclea en una ficha no tiene por qué venir así.
 */
export async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const target = email.trim().toLowerCase()
  if (!target) return null

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) {
      console.error('[findAuthUserByEmail] listUsers falló', { page, error: error.message })
      return null
    }

    const users = data?.users ?? []
    const found = users.find((u) => u.email?.toLowerCase() === target)
    if (found) return found

    // Última página: vino incompleta (o vacía).
    if (users.length < PAGE_SIZE) return null
  }

  console.error('[findAuthUserByEmail] se alcanzó el tope de páginas sin encontrar el correo')
  return null
}
