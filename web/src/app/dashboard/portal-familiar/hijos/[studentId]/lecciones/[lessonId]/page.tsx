import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFamilyContext } from '@/lib/academia/familyContext'
import { latestCompletedAttempts, loadFamilyAcademia } from '@/lib/academia/familyData'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkifyText } from '@/lib/text/linkifyText'

export const metadata = { title: 'Consultar tarea — MentorIApp' }

type Question = {
  id: string; prompt: string; image_path: string | null
  quiz_options: { id: string; label: string; sort_order: number }[] | null
}

export default async function FamilyLessonPage({ params }: { params: Promise<{ studentId: string; lessonId: string }> }) {
  const { studentId, lessonId } = await params
  const { client, profile } = await getFamilyContext()
  const data = await loadFamilyAcademia(client, profile, studentId, createAdminClient)
  if (!data) notFound()
  // The lesson must be published, undeleted, in this child's school AND course.
  const lesson = data.lessons.find(row => row.id === lessonId) ?? data.lessons.find(row=>row.actual_lesson_id===lessonId)
  if (!lesson) notFound()
  const admin = createAdminClient()
  const { data: questionsRaw, error } = await admin.from('quiz_questions')
    .select('id, prompt, image_path, quiz_options(id, label, sort_order)')
    .eq('lesson_id', lesson.actual_lesson_id).order('sort_order', { ascending: true })
  if (error) throw new Error('No se pudo cargar el contenido de la tarea. Inténtalo de nuevo.')
  const questions = await Promise.all(((questionsRaw ?? []) as unknown as Question[]).map(async question => {
    let imageUrl: string | null = null
    if (question.image_path) {
      const { data: signed } = await admin.storage.from('academia-imagenes').createSignedUrl(question.image_path, 3600)
      imageUrl = signed?.signedUrl ?? null
    }
    return { ...question, imageUrl }
  }))
  const imageError = questions.some(question => question.image_path && !question.imageUrl)
  const attempt = latestCompletedAttempts(data.attempts).get(lesson.id)
  // Never render an arbitrary stored scheme as a clickable video link.
  let videoUrl: string | null = null
  try {
    const url = new URL(lesson.video_url ?? '')
    if (url.protocol === 'https:' || url.protocol === 'http:') videoUrl = url.href
  } catch { /* A task may have no video. */ }
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={`/dashboard/portal-familiar/hijos/${data.student.id}`} className="text-sm text-dash-accent hover:underline">← Tareas de {data.student.first_name}</Link>
      <header>
        <p className="text-sm text-slate-500">{data.student.first_name} {data.student.last_name} · {lesson.subjects?.name ?? 'Materia'}</p>
        <h1 className="text-2xl font-bold font-barlow mt-1 break-words">{lesson.title}</h1>
        <p className="text-sm text-slate-500 mt-2">{data.progressError ? 'Estado no disponible: no se pudo cargar el progreso.' : attempt ? lesson.delivery_mode==='quiz'?`Completada · ${attempt.score}/${attempt.max_score}`:'Revisada y completada' : lesson.submission?.status==='submitted'?'Entregada · esperando revisión':lesson.submission?.status==='returned'?'Devuelta para corregir':'Pendiente'}</p>
        {lesson.due_date && <p className="text-sm mt-2">Entrega: {lesson.due_date}</p>}
      </header>
      <p className="rounded-xl bg-blue-50 text-blue-800 p-4 text-sm">Vista de consulta para la familia. El estudiante debe responder desde su propia cuenta.</p>
      {lesson.description && <div className="dash-card p-5 whitespace-pre-wrap break-words">{linkifyText(lesson.description)}</div>}
      {lesson.instructions && lesson.instructions!==lesson.description && <div className="dash-card p-5 whitespace-pre-wrap">{linkifyText(lesson.instructions)}</div>}
      {lesson.submission?.response && <div className="dash-card p-5 whitespace-pre-wrap"><h2 className="font-semibold mb-2">Respuesta de tu hijo</h2>{lesson.submission.response}</div>}
      {lesson.submission?.feedback && <p className="dash-card p-5 whitespace-pre-wrap">Comentario del profesor: {lesson.submission.feedback}</p>}
      {videoUrl && <a href={videoUrl} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-primary text-white px-5 py-3 font-semibold">Ver video de la lección ↗</a>}
      {imageError && <p role="alert" className="text-sm text-amber-800">No se pudieron cargar algunas imágenes. Vuelve a intentarlo para ver la tarea completa.</p>}
      {questions.length > 0 && <section className="space-y-4">
        <h2 className="font-semibold">Cuestionario</h2>
        {questions.map((question, index) => <article key={question.id} className="dash-card p-5 space-y-3">
          <p className="font-semibold whitespace-pre-wrap break-words">{index + 1}. {question.prompt}</p>
          {question.imageUrl && (
            // Signed URLs are generated only after child and lesson authorization.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.imageUrl} alt={`Imagen de apoyo de la pregunta ${index + 1}`} className="max-w-full rounded-xl" />
          )}
          <ul className="space-y-2 text-sm text-slate-600">
            {[...(question.quiz_options ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(option => <li key={option.id} className="rounded-xl border p-3 break-words">{option.label}</li>)}
          </ul>
        </article>)}
      </section>}
    </div>
  )
}
