import { createClient } from '@/lib/supabase/server'
import { checkGuardianOverdueBlock } from '@/lib/receivables/guardianBlock'

async function context() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: profile, error } = await db.from('users_profiles').select('role,guardian_id,school_id').eq('auth_id', user.id).single()
  if (error || !profile?.guardian_id || !profile.school_id) return null
  if (profile.role === 'guardian' && await checkGuardianOverdueBlock(profile.guardian_id)) return null
  return { db, profile }
}

export async function GET() {
  const ctx = await context()
  if (!ctx) return Response.json({ notices: [] }, { status: 401 })
  // RLS also revalidates the current tutor/child/course relationship.
  const { data, error, count } = await ctx.db.from('family_academia_notifications')
    .select('id,student_id,lesson_id,assignment_id,created_at,students!inner(first_name),lessons!inner(title)', { count: 'exact' })
    .eq('guardian_id', ctx.profile.guardian_id).eq('school_id', ctx.profile.school_id)
    .is('read_at', null).order('created_at', { ascending: false }).limit(10)
  if (error) return Response.json({ error: 'No se pudieron cargar los avisos.' }, { status: 503 })
  return Response.json({ count: count ?? 0, notices: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) return Response.json({}, { status: 403 })
  const ctx = await context()
  if (!ctx) return Response.json({}, { status: 401 })
  let id: unknown
  try { id = (await req.json()).id } catch { return Response.json({}, { status: 400 }) }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({}, { status: 400 })
  const { data, error } = await ctx.db.from('family_academia_notifications').update({ read_at: new Date().toISOString() })
    .eq('id', id).eq('guardian_id', ctx.profile.guardian_id).eq('school_id', ctx.profile.school_id)
    .select('id').maybeSingle()
  if (error || !data) return Response.json({}, { status: 404 })
  return Response.json({ ok: true })
}
