import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export type AcademiaScope = { grade_level: string; subject_id: string; subject_name: string }
export async function getAcademiaStaff() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await db.from('users_profiles').select('id,role,school_id').eq('auth_id', user.id).single()
  if (!profile || !canAccess(profile.role, 'academia_gestionar')) redirect('/dashboard/academia')
  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const { data, error } = await db.rpc('academia_available_scopes', { p_school: schoolId })
  if (error) throw new Error('No se pudieron comprobar tus cursos y materias. Inténtalo de nuevo.')
  return { db, profile, schoolId, scopes: (data ?? []) as AcademiaScope[] }
}
