import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Avisa por correo a un empleado reutilizando la Edge Function
 * notify-message (la misma de Mensajes/Comunicados; manda texto plano con
 * Resend y exige service_role). El campo se llama `guardianEmail` por
 * historia: la función no distingue a quién le escribe.
 *
 * A diferencia de notifyGuardianByEmail, esta DEVUELVE si el correo salió:
 * Nómina solo marca "avisado" lo que de verdad se envió.
 */
export async function notifyStaffByEmail(input: {
  schoolName: string | null
  email: string
  subject: string
  body: string
}): Promise<{ ok: boolean; reason?: string }> {
  const email = input.email.trim().toLowerCase()
  // Correos de relleno (ej. orlando.natera@pendiente.local) no son reales.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('.local')) {
    return { ok: false, reason: 'correo no válido' }
  }
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.functions.invoke('notify-message', {
      body: { schoolName: input.schoolName, guardianEmail: email, subject: input.subject, body: input.body },
    })
    if (error) return { ok: false, reason: error.message }
    if (data?.success === true && data?.channel === 'email') return { ok: true }
    return { ok: false, reason: typeof data?.error === 'string' ? data.error : 'no se pudo enviar' }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'falló la invocación' }
  }
}
