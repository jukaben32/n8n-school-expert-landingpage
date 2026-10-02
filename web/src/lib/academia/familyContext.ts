import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export async function getFamilyContext() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile, error } = await client.from('users_profiles')
    .select('guardian_id, school_id').eq('auth_id', user.id).single()
  if (error) throw new Error('No se pudo verificar tu cuenta. Inténtalo de nuevo.')
  if (!profile?.guardian_id || !profile.school_id) notFound()
  return { client, profile }
}
