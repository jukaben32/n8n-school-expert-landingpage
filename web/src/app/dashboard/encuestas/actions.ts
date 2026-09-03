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
 *
 * Y desde que los estudiantes tienen cuenta propia (migración
 * 20260905000000), NINGUNA de estas funciones escribe el voto: padrón y
 * papeleta se insertan juntos, en una sola transacción, dentro de las
 * funciones cast_student_vote / cast_urna_vote / submit_poll_response.
 * Con dos escrituras sueltas desde aquí, un estudiante con credenciales
 * podía marcarse una vez en el padrón y meter todas las papeletas que
 * quisiera por la API.
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
  // El estudiante también tiene el módulo 'encuestas' (para votar), pero
  // nada de lo que pasa por aquí -- cargar candidatos, abrir, cerrar,
  // operar la urna -- es suyo. Vota por castOwnVote().
  if (profile.role === 'student') {
    return { ok: false as const, error: 'Los estudiantes solo pueden votar y responder encuestas.' }
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
  audience: 'staff' | 'familias' | 'ambos' | 'estudiantes' | 'todos'
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
 * URNA DEL AULA: el profesor supervisa y el estudiante marca en su
 * dispositivo. Sigue siendo la única vía para los cursos donde los
 * estudiantes no tienen cuenta (Párvulo, Kinder...).
 *
 * El padrón (que este estudiante ya votó) y las papeletas se escriben
 * juntos dentro de `cast_urna_vote`. Antes eran dos escrituras separadas
 * desde aquí y, si la segunda fallaba, el estudiante quedaba marcado sin
 * voto: perdía su derecho a votar y el acta no cuadraba.
 */
export async function castVote(
  pollId: string,
  studentId: string,
  choices: { positionId: string; candidateId: string }[]
): Promise<ActionResult> {
  const staff = await resolveStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const { error } = await staff.supabase.rpc('cast_urna_vote', {
    p_poll_id: pollId,
    p_student_id: studentId,
    p_choices: choices,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/dashboard/encuestas/${pollId}`)
  return { ok: true }
}

/**
 * EL ESTUDIANTE VOTA DESDE SU PROPIA CUENTA.
 *
 * No recibe ningún `studentId`: quién vota lo decide la base de datos a
 * partir de la sesión (`current_student_id()`), así que nadie puede votar
 * en nombre de otro ni siquiera armando la petición a mano.
 */
export async function castOwnVote(
  pollId: string,
  choices: { positionId: string; candidateId: string }[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { error } = await supabase.rpc('cast_student_vote', {
    p_poll_id: pollId,
    p_choices: choices,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/dashboard/encuestas/${pollId}`)
  return { ok: true }
}

/**
 * Responde una encuesta: personal, familia o estudiante, según a quién
 * vaya dirigida, y una sola vez por persona. Quién puede responder lo
 * decide `can_answer_encuesta()` en la base de datos.
 */
export async function submitEncuesta(
  pollId: string,
  answers: { questionId: string; option?: string; scale?: number; text?: string }[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { error } = await supabase.rpc('submit_poll_response', {
    p_poll_id: pollId,
    p_answers: answers.map((a) => ({
      questionId: a.questionId,
      option: a.option ?? null,
      scale: a.scale ?? null,
      text: a.text ?? null,
    })),
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/dashboard/encuestas/${pollId}`)
  return { ok: true }
}
