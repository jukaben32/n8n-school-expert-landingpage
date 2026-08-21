'use server'

import { createClient } from '@/lib/supabase/server'
import { polishStaffMessage, type DraftContext, type PolishResult } from './polishStaffMessage'

/**
 * Server Action del asistente de redacción -- requiere sesión activa
 * (cualquier miembro del personal, no hace falta un permiso específico
 * de módulo) para evitar que alguien sin autenticar consuma la API de
 * Claude a través de este endpoint.
 */
export async function polishDraftAction(rawText: string, context: DraftContext): Promise<PolishResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  return polishStaffMessage(rawText, context)
}
