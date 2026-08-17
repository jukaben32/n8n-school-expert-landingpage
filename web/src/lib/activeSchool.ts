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
 *
 * `isViewingOtherSchool` se decide solo por "¿hay una cookie de
 * override válida?", NO por comparar contra `homeSchoolId` -- con un
 * solo colegio afiliado (el caso de hoy), el `school_id` propio del
 * super_admin puede coincidir con el del colegio al que "entra", y
 * `school.id !== homeSchoolId` daba falso aunque la cookie estuviera
 * bien puesta: el aviso amarillo y el menú de director nunca aparecían.
 * Elegir "Entrar como director" ya es una acción explícita -- no hace
 * falta que el colegio sea literalmente distinto del propio para que
 * cuente como vista de director.
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

  return { schoolId: school.id, isViewingOtherSchool: true, schoolName: school.name }
}
