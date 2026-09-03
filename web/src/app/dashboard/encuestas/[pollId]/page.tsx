import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'
import VotacionPanel from './VotacionPanel'
import EstudianteVotacionPanel from './EstudianteVotacionPanel'
import EncuestaPanel from './EncuestaPanel'

export const metadata: Metadata = {
  title: 'Encuesta — MentorIApp',
}

export default async function PollDetailPage({ params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, student_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'encuestas')) redirect('/dashboard')

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const puedeGestionar = canAccess(profile.role, 'encuestas_gestionar')
  const esEstudiante = profile.role === 'student'

  const { data: poll } = await supabase
    .from('polls')
    .select('id, type, title, description, grade_level, audience, status, created_at, closed_at')
    .eq('id', pollId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!poll) notFound()

  const volver = (
    <Link href="/dashboard/encuestas" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
      ← {esEstudiante ? 'Encuestas y votaciones' : 'Encuestas y Votaciones'}
    </Link>
  )

  if (poll.type === 'votacion') {
    const [{ data: positions }, { data: voters }] = await Promise.all([
      supabase
        .from('poll_positions')
        .select('id, name, sort_order, poll_candidates(id, display_name, student_id, sort_order)')
        .eq('poll_id', pollId)
        .order('sort_order'),
      // El estudiante solo ve su propia fila del padrón (policy
      // poll_voters_own_read); el personal ve el padrón del curso.
      supabase.from('poll_voters').select('student_id').eq('poll_id', pollId),
    ])

    // Resultados y cuadre: solo tienen sentido con la votación cerrada.
    let results: { position_name: string; candidate_name: string; votes: number }[] = []
    let reconciliation: { voters: number; position_name: string; ballots: number }[] = []
    if (poll.status === 'cerrada') {
      const [{ data: r }, { data: rec }] = await Promise.all([
        supabase.rpc('poll_results_votacion', { p_poll_id: pollId }),
        supabase.rpc('poll_reconciliation', { p_poll_id: pollId }),
      ])
      results = (r ?? []) as typeof results
      reconciliation = (rec ?? []) as typeof reconciliation
    }

    if (esEstudiante) {
      const yaVoto = (voters ?? []).some((v) => v.student_id === profile.student_id)
      return (
        <div className="max-w-2xl mx-auto space-y-6">
          {volver}
          <EstudianteVotacionPanel
            poll={{ id: poll.id, title: poll.title, description: poll.description, gradeLevel: poll.grade_level, status: poll.status }}
            positions={(positions ?? []) as never}
            yaVoto={yaVoto}
            results={results}
          />
        </div>
      )
    }

    // Padrón completo del curso: la urna del aula lo necesita para saber a
    // quién le falta pasar. Solo lo consulta el personal.
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .eq('grade_level', poll.grade_level)
      .eq('enrollment_status', 'inscrito')
      .is('deleted_at', null)
      .order('last_name')

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {volver}
        <VotacionPanel
          poll={{ id: poll.id, title: poll.title, description: poll.description, gradeLevel: poll.grade_level, status: poll.status }}
          students={(students ?? []).map((s) => ({ id: s.id, name: `${s.last_name}, ${s.first_name}` }))}
          positions={(positions ?? []) as never}
          votedStudentIds={(voters ?? []).map((v) => v.student_id as string).filter(Boolean)}
          results={results}
          reconciliation={reconciliation}
          puedeGestionar={puedeGestionar}
        />
      </div>
    )
  }

  // ── Encuesta ────────────────────────────────────────────────────────────
  // El estudiante queda registrado en el padrón por `student_id`; el
  // personal y las familias, por `profile_id`.
  const yaRespondio = supabase
    .from('poll_voters')
    .select('id')
    .eq('poll_id', pollId)
  const [{ data: questions }, { data: alreadyAnswered }] = await Promise.all([
    supabase.from('poll_questions').select('id, text, kind, options, sort_order').eq('poll_id', pollId).order('sort_order'),
    esEstudiante
      ? yaRespondio.eq('student_id', profile.student_id ?? '').maybeSingle()
      : yaRespondio.eq('profile_id', profile.id).maybeSingle(),
  ])

  let results: { question_text: string; question_kind: string; answer: string | null; responses: number }[] = []
  if (poll.status === 'cerrada') {
    const { data: r } = await supabase.rpc('poll_results_encuesta', { p_poll_id: pollId })
    results = (r ?? []) as typeof results
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {volver}
      <EncuestaPanel
        poll={{ id: poll.id, title: poll.title, description: poll.description, audience: poll.audience, status: poll.status }}
        questions={(questions ?? []) as never}
        alreadyAnswered={!!alreadyAnswered}
        results={results}
        puedeGestionar={puedeGestionar}
      />
    </div>
  )
}
