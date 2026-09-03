'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

/**
 * Encuestas y Votaciones.
 *
 * IMPORTANTE: todo aquí usa el cliente de SESIÓN (no el admin), a
 * propósito. Las reglas antifraude viven en las policies de RLS
 * (migración 20260904000000): quién puede operar la urna de qué curso,
 * que no se pueda votar dos veces, que la urna solo acepte inserciones
 * mientras la votación está abierta, y que nadie pueda leer ni modificar
 * un voto. Si esto usara el cliente admin (service_role) se saltaría todo
 * eso y las garantías se perderían.
 */

interface ActionResult {
  ok: boolean
  error?: string
}

async function resolveStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'encuestas')) {
    return { ok: false as const, error: 'No tienes permiso para usar Encuestas.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, supabase, profileId: profile.id as string, role: profile.role as string, schoolId }
}

export interface NewVotacionInput {
  title: string
  description: string
  gradeLevel: string
  positions: string[]
}

/** Crea una votación de junta directiva para un curso (solo dirección). */
export async function createVotacion(input: NewVotacionInput): Promise<ActionResult & { pollId?: string }> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  if (!canAccess(staff.role, 'encuestas_gestionar')) {
    return { ok: false, error: 'Solo dirección puede crear votaciones.' }
  }
  if (!input.title.trim()) return { ok: false, error: 'Ponle un título a la votación.' }
  if (!input.gradeLevel) return { ok: false, error: 'Elige el curso.' }

  const positions = input.positions.map((p) => p.trim()).filter(Boolean)
  if (positions.length === 0) return { ok: false, error: 'Define al menos un cargo (ej. Presidente).' }

  const { data: poll, error } = await staff.supabase
    .from('polls')
    .insert({
      school_id: staff.schoolId,
      type: 'votacion',
      title: input.title.trim(),
      description: input.description.trim() || null,
      grade_level: input.gradeLevel,
      created_by: staff.profileId,
    })
    .select('id')
    .single()
  if (error || !poll) return { ok: false, error: `No se pudo crear la votación: ${error?.message ?? ''}` }

  const { error: posError } = await staff.supabase.from('poll_positions').insert(
    positions.map((name, i) => ({ poll_id: poll.id, name, sort_order: i }))
  )
  if (posError) return { ok: false, error: `Se creó la votación pero fallaron los cargos: ${posError.message}` }

  revalidatePath('/dashboard/encuestas')
  return { ok: true, pollId: poll.id as string }
}

export interface NewEncuestaInput {
  title: string
  description: string
  audience: 'staff' | 'familias' | 'ambos'
  questions: { text: string; kind: 'opcion' | 'escala' | 'texto'; options: string[] }[]
}

/** Crea una encuesta dirigida a personal y/o familias (solo dirección). */
export async function createEncuesta(input: NewEncuestaInput): Promise<ActionResult & { pollId?: string }> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  if (!canAccess(staff.role, 'encuestas_gestionar')) {
    return { ok: false, error: 'Solo dirección puede crear encuestas.' }
  }
  if (!input.title.trim()) return { ok: false, error: 'Ponle un título a la encuesta.' }

  const questions = input.questions.filter((q) => q.text.trim())
  if (questions.length === 0) return { ok: false, error: 'Agrega al menos una pregunta.' }

  const { data: poll, error } = await staff.supabase
    .from('polls')
    .insert({
      school_id: staff.schoolId,
      type: 'encuesta',
      title: input.title.trim(),
      description: input.description.trim() || null,
      audience: input.audience,
      created_by: staff.profileId,
    })
    .select('id')
    .single()
  if (error || !poll) return { ok: false, error: `No se pudo crear la encuesta: ${error?.message ?? ''}` }

  const { error: qError } = await staff.supabase.from('poll_questions').insert(
    questions.map((q, i) => ({
      poll_id: poll.id,
      text: q.text.trim(),
      kind: q.kind,
      options: q.kind === 'opcion' ? q.options.map((o) => o.trim()).filter(Boolean) : null,
      sort_order: i,
    }))
  )
  if (qError) return { ok: false, error: `Se creó la encuesta pero fallaron las preguntas: ${qError.message}` }

  revalidatePath('/dashboard/encuestas')
  return { ok: true, pollId: poll.id as string }
}

/** Agrega un candidato a un cargo -- esto lo hace el profesor del curso. */
export async function addCandidate(positionId: string, studentId: string, displayName: string): Promise<ActionResult> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const { error } = await staff.supabase.from('poll_candidates').insert({
    position_id: positionId,
    student_id: studentId || null,
    display_name: displayName.trim(),
  })
  // La RLS (can_run_poll) es la que decide si este profesor puede tocar
  // este curso -- si rebota, es porque la votación no es de su curso.
  if (error) return { ok: false, error: 'No se pudo agregar el candidato (¿es una votación de tu curso?).' }

  revalidatePath('/dashboard/encuestas')
  return { ok: true }
}

export async function removeCandidate(candidateId: string): Promise<ActionResult> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const { error } = await staff.supabase.from('poll_candidates').delete().eq('id', candidateId)
  if (error) return { ok: false, error: 'No se pudo quitar el candidato.' }

  revalidatePath('/dashboard/encuestas')
  return { ok: true }
}

/** Abre o cierra la votación/encuesta (solo dirección). */
export async function setPollStatus(pollId: string, status: 'abierta' | 'cerrada'): Promise<ActionResult> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  if (!canAccess(staff.role, 'encuestas_gestionar')) {
    return { ok: false, error: 'Solo dirección puede abrir o cerrar.' }
  }

  const { error } = await staff.supabase
    .from('polls')
    .update({
      status,
      ...(status === 'abierta' ? { opened_at: new Date().toISOString() } : { closed_at: new Date().toISOString() }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pollId)
  if (error) return { ok: false, error: `No se pudo cambiar el estado: ${error.message}` }

  revalidatePath('/dashboard/encuestas')
  return { ok: true }
}

/**
 * Registra el voto de un estudiante en la urna del aula.
 *
 * Dos escrituras separadas y en este orden:
 *   1. El PADRÓN (`poll_voters`): marca que este estudiante ya votó. Si ya
 *      estaba marcado, el índice único lo rechaza -- nadie vota dos veces.
 *   2. La URNA (`poll_ballots`): los votos, sin ninguna referencia al
 *      estudiante ni hora, así no hay forma de saber quién votó qué.
 *
 * Si el paso 2 fallara, el estudiante queda marcado sin voto en la urna y
 * el cuadre del acta lo delata (votantes > votos) -- preferible a
 * permitirle votar de nuevo, que sí abriría la puerta al fraude.
 */
export async function castVote(
  pollId: string,
  studentId: string,
  choices: { positionId: string; candidateId: string }[]
): Promise<ActionResult> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  if (choices.length === 0) return { ok: false, error: 'No se seleccionó ningún candidato.' }

  const { error: voterError } = await staff.supabase.from('poll_voters').insert({
    poll_id: pollId,
    student_id: studentId,
    recorded_by: staff.profileId,
  })
  if (voterError) {
    if (voterError.code === '23505') return { ok: false, error: 'Este estudiante ya votó.' }
    return { ok: false, error: 'No se pudo registrar el votante (¿está abierta la votación?).' }
  }

  const { error: ballotError } = await staff.supabase.from('poll_ballots').insert(
    choices.map((c) => ({ poll_id: pollId, position_id: c.positionId, candidate_id: c.candidateId }))
  )
  if (ballotError) return { ok: false, error: 'El votante quedó marcado pero el voto no se guardó. Avisa a dirección.' }

  revalidatePath(`/dashboard/encuestas/${pollId}`)
  return { ok: true }
}

/** Responde una encuesta (staff o familia, una sola vez por persona). */
export async function submitEncuesta(
  pollId: string,
  answers: { questionId: string; option?: string; scale?: number; text?: string }[]
): Promise<ActionResult> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const { error: voterError } = await staff.supabase.from('poll_voters').insert({
    poll_id: pollId,
    profile_id: staff.profileId,
    recorded_by: staff.profileId,
  })
  if (voterError) {
    if (voterError.code === '23505') return { ok: false, error: 'Ya respondiste esta encuesta.' }
    return { ok: false, error: 'No se pudo registrar tu respuesta (¿está abierta la encuesta?).' }
  }

  const { error: ballotError } = await staff.supabase.from('poll_ballots').insert(
    answers.map((a) => ({
      poll_id: pollId,
      question_id: a.questionId,
      answer_option: a.option ?? null,
      answer_scale: a.scale ?? null,
      answer_text: a.text ?? null,
    }))
  )
  if (ballotError) return { ok: false, error: 'No se pudieron guardar tus respuestas.' }

  revalidatePath(`/dashboard/encuestas/${pollId}`)
  return { ok: true }
}
