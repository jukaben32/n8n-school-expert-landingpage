import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const ACTIVE_SCHOOL_COOKIE = 'mentoriapp_active_school'

/**
 * Devuelve el colegio "activo" para la sesión actual.
 *
 * Para todo el mundo, es simplemente su propio `school_id`. Para un
 * super_admin, puede ser el de OTRO colegio que eligió ver desde
 * /dashboard/plataforma ("entrar como director de X") -- guardado en
 * una cookie. Si la cookie apunta a un colegio que ya no existe, o el
 * usuario no es super_admin, se cae de vuelta a su propio colegio.
 */
export async function getActiveSchool(role: string, homeSchoolId: string): Promise<{ schoolId: string; isViewingOtherSchool: boolean; schoolName: string | null }> {
  if (role !== 'super_admin') {
    return { schoolId: homeSchoolId, isViewingOtherSchool: false, schoolName: null }
  }

  const cookieStore = await cookies()
  const overrideId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value
  if (!overrideId) {
    return { schoolId: homeSchoolId, isViewingOtherSchool: false, schoolName: null }
  }

  const supabase = await createClient()
  const { data: school } = await supabase.from('schools').select('id, name').eq('id', overrideId).maybeSingle()
  if (!school) {
    return { schoolId: homeSchoolId, isViewingOtherSchool: false, schoolName: null }
  }

  return { schoolId: school.id, isViewingOtherSchool: school.id !== homeSchoolId, schoolName: school.name }
}
