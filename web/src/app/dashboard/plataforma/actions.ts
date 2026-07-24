'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_SCHOOL_COOKIE } from '@/lib/activeSchool'

/**
 * Un super_admin "entra" a un colegio como si fuera su director.
 * Solo válido para super_admin -- cualquier otro rol se ignora.
 */
export async function enterSchool(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, schoolId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  })

  redirect('/dashboard/secretaria')
}

/** Sale de la vista de colegio y vuelve a Plataforma. */
export async function exitSchoolView() {
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_SCHOOL_COOKIE)
  redirect('/dashboard/plataforma')
}
