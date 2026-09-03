import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'
import VotacionPanel from './VotacionPanel'
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
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'encuestas')) redirect('/dashboard')

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const puedeGestionar = canAccess(profile.role, 'encuestas_gestionar')

  const { data: poll } = await supabase
    .from('polls')
    .select('id, type, title, description, grade_level, audience, status, created_at, closed_at')
    .eq('id', pollId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!poll) notFound()

  if (poll.type === 'votacion') {
    // Padrón del curso, cargos con sus candidatos, y quién ya votó.
    const [{ data: students }, { data: positions }, { data: voters }] = await Promise.all([
      supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId)
        .eq('grade_level', poll.grade_level)
        .eq('enrollment_status', 'inscrito')
        .is('deleted_at', null)
        .order('last_name'),
      supabase
        .from('poll_positions')
        .select('id, name, sort_order, poll_candidates(id, display_name, student_id, sort_order)')
        .eq('poll_id', pollId)
        .order('sort_order'),
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

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/dashboard/encuestas" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
          ← Encuestas y Votaciones
        </Link>
        <VotacionPanel
          poll={{ id: poll.id, title: poll.title, description: poll.description, gradeLevel: poll.grade_level, status: poll.status }}
          students={(students ?? []).map((s) => ({ id: s.id, name: `${s.last_name}, ${s.first_name}` }))}
          positions={(positions ?? []) as never}
          votedStudentIds={(voters ?? []).map((v) => v.student_id as string)}
          results={results}
          reconciliation={reconciliation}
          puedeGestionar={puedeGestionar}
        />
      </div>
    )
  }

  // ── Encuesta ────────────────────────────────────────────────────────────
  const [{ data: questions }, { data: alreadyAnswered }] = await Promise.all([
    supabase.from('poll_questions').select('id, text, kind, options, sort_order').eq('poll_id', pollId).order('sort_order'),
    supabase.from('poll_voters').select('id').eq('poll_id', pollId).eq('profile_id', profile.id).maybeSingle(),
  ])

  let results: { question_text: string; question_kind: string; answer: string | null; responses: number }[] = []
  if (poll.status === 'cerrada') {
    const { data: r } = await supabase.rpc('poll_results_encuesta', { p_poll_id: pollId })
    results = (r ?? []) as typeof results
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/encuestas" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
        ← Encuestas y Votaciones
      </Link>
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
