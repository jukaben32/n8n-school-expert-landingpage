'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'

interface ExportResult {
  ok: boolean
  message?: string
  data?: Record<string, unknown>
}

/**
 * Exporta TODOS los datos de un colegio a un único objeto JSON.
 * Es la garantía real detrás de "tus datos son tuyos": cualquier
 * director puede llevarse toda la información de su colegio en
 * cualquier momento, sin depender de que alguien del equipo de
 * SchoolOS se la genere manualmente.
 */
export async function exportSchoolData(): Promise<ExportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'configuracion_colegio')) {
    return { ok: false, message: 'No tienes permiso para exportar los datos de este colegio.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const byschool = (table: string, select = '*') =>
    supabase.from(table).select(select).eq('school_id', schoolId)

  const [
    school, schoolYears, gradeLevels, subjects,
    students, families, guardians, studentGuardians, enrollments,
    staff, messages, messageReads, attendance,
    billingConcepts, invoices, payments,
    lessons, quizAttempts, studentPoints, studentBadges,
  ] = await Promise.all([
    supabase.from('schools').select('*').eq('id', schoolId).single(),
    byschool('school_years'),
    byschool('grade_levels'),
    byschool('subjects'),
    byschool('students'),
    byschool('families'),
    byschool('guardians'),
    supabase.from('student_guardians').select('*, students!inner(school_id)').eq('students.school_id', schoolId),
    supabase.from('enrollments').select('*, students!inner(school_id)').eq('students.school_id', schoolId),
    byschool('staff'),
    byschool('messages'),
    supabase.from('message_reads').select('*, messages!inner(school_id)').eq('messages.school_id', schoolId),
    byschool('attendance'),
    byschool('billing_concepts'),
    byschool('invoices'),
    byschool('payments'),
    byschool('lessons'),
    byschool('quiz_attempts'),
    byschool('student_points'),
    supabase.from('student_badges').select('*, students!inner(school_id)').eq('students.school_id', schoolId),
  ])


  return {
    ok: true,
    data: {
      exportado_en: new Date().toISOString(),
      colegio: school.data,
      anos_escolares: schoolYears.data ?? [],
      grados: gradeLevels.data ?? [],
      materias: subjects.data ?? [],
      estudiantes: students.data ?? [],
      familias: families.data ?? [],
      tutores: guardians.data ?? [],
      vinculos_estudiante_tutor: studentGuardians.data ?? [],
      inscripciones: enrollments.data ?? [],
      personal: staff.data ?? [],
      comunicados: messages.data ?? [],
      lecturas_de_comunicados: messageReads.data ?? [],
      asistencia: attendance.data ?? [],
      conceptos_de_cobro: billingConcepts.data ?? [],
      facturas: invoices.data ?? [],
      pagos: payments.data ?? [],
      lecciones_academia: lessons.data ?? [],
      intentos_de_cuestionario: quizAttempts.data ?? [],
      puntos_estudiantes: studentPoints.data ?? [],
      insignias_otorgadas: studentBadges.data ?? [],
    },
  }
}
