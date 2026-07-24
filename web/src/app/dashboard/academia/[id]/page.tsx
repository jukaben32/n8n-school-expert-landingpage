import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LessonPlayer from './LessonPlayer'

type QuestionWithOptions = {
  id: string
  prompt: string
  points: number
  sort_order: number
  quiz_options: { id: string; label: string; is_correct: boolean; sort_order: number }[]
}

export default async function LeccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, student_id, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile?.student_id) redirect('/dashboard/academia')

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, description, video_url, video_provider, subjects(name)')
    .eq('id', id)
    .single()

  if (!lesson) notFound()

  const { data: questionsRaw } = await supabase
    .from('quiz_questions')
    .select('id, prompt, points, sort_order, quiz_options(id, label, is_correct, sort_order)')
    .eq('lesson_id', id)
    .order('sort_order', { ascending: true })

  const questions = (questionsRaw ?? []) as unknown as QuestionWithOptions[]
  // NOTA (trade-off consciente para el MVP): calificamos en el cliente, así
  // que `is_correct` viaja con las opciones. Un estudiante que inspeccione
  // el tráfico de red podría ver la respuesta antes de contestar. Para un
  // cuestionario formativo esto es aceptable; si más adelante se usa para
  // evaluaciones que califican, mover la corrección a una Edge Function
  // que reciba solo `selected_option_id` y devuelva el resultado.
  const sortedQuestions = questions
    .map((q) => ({ ...q, quiz_options: [...q.quiz_options].sort((a, b) => a.sort_order - b.sort_order) }))
    .sort((a, b) => a.sort_order - b.sort_order)

  const { data: existingAttempt } = await supabase
    .from('quiz_attempts')
    .select('id, score, max_score, completed_at')
    .eq('lesson_id', id)
    .eq('student_id', profile.student_id)
    .not('completed_at', 'is', null)
    .maybeSingle()

  return (
    <LessonPlayer
      lessonId={lesson.id}
      schoolId={profile.school_id}
      title={lesson.title}
      description={lesson.description}
      subjectName={(lesson.subjects as unknown as { name: string } | null)?.name ?? null}
      videoUrl={lesson.video_url}
      videoProvider={lesson.video_provider as 'youtube' | 'vimeo'}
      questions={sortedQuestions}
      studentId={profile.student_id}
      existingAttempt={existingAttempt}
    />
  )
}
