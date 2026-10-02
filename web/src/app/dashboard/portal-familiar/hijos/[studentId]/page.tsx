import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFamilyContext } from '@/lib/academia/familyContext'
import { latestCompletedAttempts, loadFamilyAcademia } from '@/lib/academia/familyData'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Tareas de mi hijo — MentorIApp' }

export default async function FamilyStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const { client, profile } = await getFamilyContext()
  const data = await loadFamilyAcademia(client, profile, studentId, createAdminClient)
  if (!data) notFound()
  const { student, students, lessons, attempts, progressError } = data
  const completed = latestCompletedAttempts(attempts)
  const groups = progressError
    ? [{ title: 'Tareas publicadas', lessons }]
    : [
        { title: 'Tareas pendientes', lessons: lessons.filter(lesson => !completed.has(lesson.id)) },
        { title: 'Tareas completadas', lessons: lessons.filter(lesson => completed.has(lesson.id)) },
      ]
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/portal-familiar" className="text-sm text-dash-accent hover:underline">← Portal Familiar</Link>
      <header>
        <h1 className="text-2xl font-bold font-barlow break-words">{student.first_name} {student.last_name}</h1>
        <p className="text-sm text-slate-500 mt-1">{student.grade_level ?? 'Sin curso asignado'} · Academia</p>
        <Link href={`/dashboard/notas/boletin/${student.id}`} className="inline-block text-sm text-dash-accent hover:underline mt-3">Ver boletín de calificaciones</Link>
      </header>
      {students.length > 1 && <nav aria-label="Seleccionar hijo" className="flex flex-wrap gap-2">
        {students.map(child => <Link key={child.id} href={`/dashboard/portal-familiar/hijos/${child.id}`} aria-current={child.id === student.id ? 'page' : undefined} className={`rounded-xl border px-3 py-2 text-sm ${child.id === student.id ? 'bg-primary text-white' : 'bg-white text-slate-700'}`}>{child.first_name} {child.last_name}</Link>)}
      </nav>}
      <p className="text-sm text-slate-500">Esta vista es de consulta. Tu hijo realiza las tareas y los cuestionarios desde su cuenta de estudiante.</p>
      {progressError && <p role="alert" className="rounded-xl bg-amber-50 text-amber-800 p-4 text-sm">No se pudo cargar el progreso. Puedes consultar las tareas, pero su estado no está disponible. Vuelve a intentarlo.</p>}
      {!student.grade_level ? <p className="dash-card p-6 text-sm text-slate-500">El colegio todavía no ha asignado un curso a este estudiante.</p>
        : !lessons.length ? <p className="dash-card p-6 text-sm text-slate-500">Todavía no hay tareas publicadas para {student.grade_level}.</p>
        : groups.map(group => <section key={group.title} className="space-y-3">
          <h2 className="font-semibold">{group.title} ({group.lessons.length})</h2>
          {!group.lessons.length && <p className="text-sm text-slate-500">{group.title === 'Tareas pendientes' ? 'No tiene tareas pendientes.' : 'Todavía no ha completado tareas.'}</p>}
          {group.lessons.map(lesson => {
            const attempt = completed.get(lesson.id)
            return <Link key={lesson.id} href={`/dashboard/portal-familiar/hijos/${student.id}/lecciones/${lesson.id}`} className="dash-card block p-5">
              <p className="text-xs text-slate-500">{lesson.subjects?.name ?? 'Materia'}</p>
              <p className="font-semibold mt-1 break-words">{lesson.title}</p>
              {lesson.description && <p className="text-sm text-slate-500 mt-2 whitespace-pre-wrap break-words">{lesson.description}</p>}
              {lesson.due_date && <p className="text-sm mt-2">Entrega: {lesson.due_date}</p>}
              <p className="text-sm text-dash-accent mt-3">{progressError ? 'Estado no disponible' : attempt ? lesson.delivery_mode==='quiz'?`Completada · ${attempt.score}/${attempt.max_score}`:'Revisada y completada' : lesson.submission?.status==='submitted'?'Entregada · esperando revisión':lesson.submission?.status==='returned'?'Devuelta para corregir':'Pendiente'} · Consultar tarea →</p>
            </Link>
          })}
        </section>)}
    </div>
  )
}
