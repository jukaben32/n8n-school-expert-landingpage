import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import LessonPlayer from './LessonPlayer'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

const IMAGE_BUCKET = 'academia-imagenes'
const SIGNED_URL_TTL = 3600

type QuestionWithOptions = {
  id: string
  prompt: string
  points: number
  sort_order: number
  image_path: string | null
  quiz_options: { id: string; label: string; is_correct: boolean; sort_order: number }[]
}

export default async function LeccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, student_id, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (!profile?.student_id) redirect('/dashboard/academia')

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, description, video_url, video_provider, subjects(name)')
    .eq('id', id)
    .single()

  if (!lesson) notFound()

  const { data: questionsRaw, error: questionsRawError } = await supabase
    .from('quiz_questions')
    .select('id, prompt, points, sort_order, image_path, quiz_options(id, label, is_correct, sort_order)')
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

  // Imagen de apoyo de cada pregunta -- bucket privado, así que cada una
  // necesita su propia signed URL (mismo patrón que Comunicados/Actualizaciones).
  const admin = createAdminClient()
  const imageUrlByQuestion = new Map<string, string>()
  await Promise.all(
    sortedQuestions
      .filter((q) => q.image_path)
      .map(async (q) => {
        const { data: signed } = await admin.storage.from(IMAGE_BUCKET).createSignedUrl(q.image_path as string, SIGNED_URL_TTL)
        if (signed?.signedUrl) imageUrlByQuestion.set(q.id, signed.signedUrl)
      })
  )
  const questionsWithImages = sortedQuestions.map((q) => ({ ...q, imageUrl: imageUrlByQuestion.get(q.id) ?? null }))

  const { data: existingAttempt, error: existingAttemptError } = await supabase
    .from('quiz_attempts')
    .select('id, score, max_score, completed_at')
    .eq('lesson_id', id)
    .eq('student_id', profile.student_id)
    .not('completed_at', 'is', null)
    .maybeSingle()

  return (
    <>
      <QueryErrorBanner errors={[
        { label: 'la lección', error: lessonError },
        { label: 'el cuestionario', error: questionsRawError },
        { label: 'tu intento anterior', error: existingAttemptError },
      ]} />
      <LessonPlayer
        lessonId={lesson.id}
        schoolId={profile.school_id}
        title={lesson.title}
        description={lesson.description}
        subjectName={(lesson.subjects as unknown as { name: string } | null)?.name ?? null}
        videoUrl={lesson.video_url}
        videoProvider={lesson.video_provider as 'youtube' | 'vimeo'}
        questions={questionsWithImages}
        studentId={profile.student_id}
        existingAttempt={existingAttempt}
      />
    </>
  )
}
