'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Option { id: string; label: string; is_correct: boolean; sort_order: number }
interface Question { id: string; prompt: string; points: number; sort_order: number; quiz_options: Option[] }

interface LessonPlayerProps {
  lessonId: string
  schoolId: string
  title: string
  description: string | null
  subjectName: string | null
  videoUrl: string
  videoProvider: 'youtube' | 'vimeo'
  questions: Question[]
  studentId: string
  existingAttempt: { id: string; score: number; max_score: number; completed_at: string | null } | null
}

/** Extrae el ID de un video de YouTube o Vimeo desde varias formas de URL. */
function getEmbedUrl(url: string, provider: 'youtube' | 'vimeo'): string | null {
  try {
    if (provider === 'youtube') {
      const u = new URL(url)
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    const match = url.match(/vimeo\.com\/(\d+)/)
    return match ? `https://player.vimeo.com/video/${match[1]}` : null
  } catch {
    return null
  }
}

type Stage = 'video' | 'quiz' | 'result'

export default function LessonPlayer(props: LessonPlayerProps) {
  const { lessonId, schoolId, title, description, subjectName, videoUrl, videoProvider, questions, studentId, existingAttempt } = props
  const router = useRouter()

  const [stage, setStage] = useState<Stage>(existingAttempt ? 'result' : 'video')
  const [current, setCurrent] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<{ questionId: string; selectedOptionId: string; isCorrect: boolean }[]>([])
  const [saving, setSaving] = useState(false)

  const embedUrl = getEmbedUrl(videoUrl, videoProvider)
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0)
  const question = questions[current]

  function selectOption(opt: Option) {
    if (revealed) return
    setSelectedId(opt.id)
    setRevealed(true)
    setAnswers((prev) => [...prev, { questionId: question.id, selectedOptionId: opt.id, isCorrect: opt.is_correct }])
  }

  function nextQuestion() {
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1)
      setSelectedId(null)
      setRevealed(false)
    } else {
      void submitAttempt()
    }
  }

  async function submitAttempt() {
    setSaving(true)
    const supabase = createClient()
    const score = answers.reduce((sum, a) => {
      const q = questions.find((qq) => qq.id === a.questionId)
      return sum + (a.isCorrect && q ? q.points : 0)
    }, 0)
    const correctCount = answers.filter((a) => a.isCorrect).length

    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert({
        school_id: schoolId,
        lesson_id: lessonId,
        student_id: studentId,
        score,
        max_score: maxScore,
        correct_count: correctCount,
        total_questions: questions.length,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!error && attempt) {
      await supabase.from('quiz_answers').insert(
        answers.map((a) => ({
          attempt_id: attempt.id,
          question_id: a.questionId,
          selected_option_id: a.selectedOptionId,
          is_correct: a.isCorrect,
        }))
      )
    }

    setSaving(false)
    setStage('result')
    router.refresh()
  }

  const finalScore = existingAttempt?.score ?? answers.reduce((sum, a) => {
    const q = questions.find((qq) => qq.id === a.questionId)
    return sum + (a.isCorrect && q ? q.points : 0)
  }, 0)
  const finalMax = existingAttempt?.max_score ?? maxScore
  const pct = finalMax > 0 ? Math.round((finalScore / finalMax) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        {subjectName && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-dark dark:text-accent-light mb-1">
            {subjectName}
          </p>
        )}
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>

      {/* Video */}
      {stage === 'video' && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video bg-black">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={title}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-sm">
                No se pudo cargar el video.
              </div>
            )}
          </div>
          {questions.length > 0 ? (
            <button
              onClick={() => setStage('quiz')}
              className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow"
            >
              Ya vi el video, ¡vamos al cuestionario! 🚀
            </button>
          ) : (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">Esta lección no tiene cuestionario todavía.</p>
          )}
        </div>
      )}

      {/* Cuestionario */}
      {stage === 'quiz' && question && (
        <div className="space-y-5">
          {/* Barra de progreso */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((current + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {current + 1} / {questions.length}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <p className="font-bold text-lg text-slate-900 dark:text-white">{question.prompt}</p>
            <div className="space-y-2">
              {question.quiz_options.map((opt) => {
                const isSelected = selectedId === opt.id
                let tone = 'border-slate-200 dark:border-slate-700 hover:border-primary/40'
                if (revealed && opt.is_correct) tone = 'border-green-400 bg-green-50 dark:bg-green-900/20'
                else if (revealed && isSelected && !opt.is_correct) tone = 'border-red-400 bg-red-50 dark:bg-red-900/20'

                return (
                  <button
                    key={opt.id}
                    onClick={() => selectOption(opt)}
                    disabled={revealed}
                    className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100 transition ${tone} disabled:cursor-default`}
                  >
                    {opt.label}
                    {revealed && opt.is_correct && ' ✅'}
                    {revealed && isSelected && !opt.is_correct && ' ❌'}
                  </button>
                )
              })}
            </div>

            {revealed && (
              <div className="pt-2">
                <p className={`text-sm font-semibold mb-3 ${answers[answers.length - 1]?.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {answers[answers.length - 1]?.isCorrect ? '¡Correcto! 🎉' : 'Casi — sigamos aprendiendo 💪'}
                </p>
                <button
                  onClick={nextQuestion}
                  disabled={saving}
                  className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : current + 1 < questions.length ? 'Siguiente pregunta' : 'Ver mi resultado'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resultado */}
      {stage === 'result' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
          <p className="text-5xl" aria-hidden="true">{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚'}</p>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {finalScore} / {finalMax} puntos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pct >= 80 ? '¡Excelente trabajo!' : pct >= 50 ? 'Buen intento, ¡sigue así!' : 'Vuelve a ver el video cuando quieras repasar.'}
          </p>
          <button
            onClick={() => router.push('/dashboard/academia')}
            className="inline-block rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 text-sm transition shadow-glow"
          >
            Volver a Academia
          </button>
        </div>
      )}
    </div>
  )
}
