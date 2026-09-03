import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import StudentAccessPanel from './StudentAccessPanel'

export const metadata: Metadata = {
  title: 'Accesos de estudiantes — MentorIApp',
  description: 'Crea el usuario y la contraseña con que cada estudiante entra a Academia y Encuestas.',
}

export default async function AccesosEstudiantesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'estudiantes_accesos')) redirect('/dashboard')

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  // Cliente admin: saber QUIÉN YA TIENE cuenta exige leer users_profiles de
  // otras personas, algo que la RLS no permite a nadie (ni a dirección).
  // El permiso ya se comprobó arriba con 'estudiantes_accesos'.
  const admin = createAdminClient()

  const [{ data: students }, { data: profiles }] = await Promise.all([
    admin
      .from('students')
      .select('id, first_name, last_name, grade_level, access_code')
      .eq('school_id', schoolId)
      .eq('enrollment_status', 'inscrito')
      .is('deleted_at', null)
      .order('last_name'),
    admin.from('users_profiles').select('student_id').eq('school_id', schoolId).eq('role', 'student'),
  ])

  const withAccess = new Set((profiles ?? []).map((p) => p.student_id as string).filter(Boolean))

  const roster = (students ?? []).map((s) => ({
    id: s.id as string,
    name: `${s.last_name}, ${s.first_name}`,
    gradeLevel: (s.grade_level as string | null) ?? '',
    accessCode: (s.access_code as string | null) ?? null,
    hasAccess: withAccess.has(s.id as string),
  }))

  const gradeLevelOptions = Array.from(
    new Set(roster.map((s) => s.gradeLevel).filter(Boolean))
  ).sort()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/estudiantes" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
          ← Estudiantes
        </Link>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight mt-2">
          Accesos de estudiantes
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cada estudiante entra con un <strong>código</strong> y una <strong>contraseña</strong> — no hace falta
          correo. Con ese acceso ve sus lecciones de Academia y vota en la junta directiva de su curso.
        </p>
      </div>

      <StudentAccessPanel roster={roster} gradeLevelOptions={gradeLevelOptions} />
    </div>
  )
}
