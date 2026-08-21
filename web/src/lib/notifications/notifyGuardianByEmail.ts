import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Avisa por correo a un tutor (nuevo mensaje directo, o comunicado
 * urgente) invocando la Edge Function notify-message. Best-effort: si
 * falla, solo se registra en consola -- nunca debe tumbar la acción que
 * ya tuvo éxito (el mensaje/comunicado ya se guardó).
 */
export async function notifyGuardianByEmail(input: {
  schoolName: string | null
  guardianEmail: string | null
  subject: string
  body: string
}): Promise<void> {
  if (!input.guardianEmail) return

  try {
    const admin = createAdminClient()
    const { error } = await admin.functions.invoke('notify-message', { body: input })
    if (error) console.error('[notifyGuardianByEmail]', error.message)
  } catch (err) {
    console.error('[notifyGuardianByEmail] invoke failed:', err)
  }
}
