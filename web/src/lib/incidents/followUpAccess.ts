import type { SupabaseClient } from '@supabase/supabase-js'
import { canAccess } from '@/lib/permissions'

/**
 * ¿Puede esta persona registrar el seguimiento de una incidencia?
 *
 * Dirección (módulo `incidencias_gestionar`) o la psicóloga del colegio.
 * La psicóloga entra con rol 'teacher'; se la reconoce por su puesto en
 * Personal, con la misma función que usa la RLS (`incident_is_counselor`),
 * así la pantalla y la base no pueden decir cosas distintas.
 *
 * Usa el cliente de SESIÓN (la función lee auth.uid()).
 */
export async function canRecordIncidentFollowUp(
  supabase: SupabaseClient,
  role: string,
  schoolId: string | null | undefined,
): Promise<boolean> {
  if (canAccess(role, 'incidencias_gestionar')) return true
  if (!schoolId) return false
  const { data, error } = await supabase.rpc('incident_is_counselor', { p_school_id: schoolId })
  if (error) {
    console.error('[incident_is_counselor]', error)
    return false
  }
  return data === true
}
