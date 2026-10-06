import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicSiteUrl } from '@/lib/siteUrl'
import { MESSAGE_CATEGORY_LABELS, type MessageCategory } from '@/lib/messaging/categoryAccess'

const PREVIEW_MAX = 500

/**
 * Avisa por correo al personal responsable cuando una familia escribe un
 * mensaje directo. Destinatarios: profesores asignados (teacher_assignments)
 * a la categoría y a algún grado de los hijos de la familia (o con
 * asignación general, grade_level null); si no hay ninguno, la dirección.
 * Best-effort: si falla, solo se registra en consola -- nunca debe tumbar
 * el envío del mensaje, que ya se guardó.
 */
export async function notifyStaffOfFamilyMessage(input: {
  schoolId: string
  familyId: string
  category: MessageCategory
  body: string
}): Promise<void> {
  try {
    const admin = createAdminClient()

    const [{ data: school }, { data: family }, { data: students }] = await Promise.all([
      admin.from('schools').select('name').eq('id', input.schoolId).single(),
      admin.from('families').select('name').eq('id', input.familyId).single(),
      admin
        .from('students')
        .select('grade_level')
        .eq('school_id', input.schoolId)
        .eq('family_id', input.familyId)
        .is('deleted_at', null),
    ])

    const grades = Array.from(
      new Set((students ?? []).map((s) => s.grade_level as string | null).filter((g): g is string => !!g))
    )

    const emails = new Set<string>()

    let assignmentsQuery = admin
      .from('teacher_assignments')
      .select('staff:staff_id(email)')
      .eq('school_id', input.schoolId)
      .eq('category', input.category)
    assignmentsQuery = grades.length
      ? assignmentsQuery.or(`grade_level.is.null,grade_level.in.(${grades.map((g) => `"${g}"`).join(',')})`)
      : assignmentsQuery.is('grade_level', null)
    const { data: assignments } = await assignmentsQuery
    for (const a of (assignments ?? []) as unknown as { staff: { email: string | null } | null }[]) {
      if (a.staff?.email) emails.add(a.staff.email)
    }

    if (emails.size === 0) {
      const { data: profiles } = await admin
        .from('users_profiles')
        .select('auth_id, staff:staff_id(email)')
        .eq('school_id', input.schoolId)
        .in('role', ['director', 'school_admin'])
      for (const p of (profiles ?? []) as unknown as { auth_id: string; staff: { email: string | null } | null }[]) {
        if (p.staff?.email) {
          emails.add(p.staff.email)
          continue
        }
        const { data: authUser } = await admin.auth.admin.getUserById(p.auth_id)
        if (authUser?.user?.email) emails.add(authUser.user.email)
      }
    }

    if (emails.size === 0) return

    const label = MESSAGE_CATEGORY_LABELS[input.category]
    const siteUrl = getPublicSiteUrl()
    const link = siteUrl
      ? `\n\nResponde en MentorIApp → Mensajes: ${siteUrl}/dashboard/mensajes/${input.familyId}/${input.category}`
      : ''
    const preview = input.body.length > PREVIEW_MAX ? `${input.body.slice(0, PREVIEW_MAX)}…` : input.body
    const subject = `Nuevo mensaje de la familia${family?.name ? ` ${family.name}` : ''} (${label})`

    const results = await Promise.allSettled(
      Array.from(emails).map((email) =>
        admin.functions.invoke('notify-message', {
          body: { schoolName: school?.name ?? null, guardianEmail: email, subject, body: `${preview}${link}` },
        })
      )
    )
    for (const r of results) {
      if (r.status === 'rejected') console.error('[notifyStaffOfFamilyMessage] invoke failed:', r.reason)
      else if (r.value.error) console.error('[notifyStaffOfFamilyMessage]', r.value.error.message)
    }
  } catch (err) {
    console.error('[notifyStaffOfFamilyMessage] failed:', err)
  }
}
