import Link from 'next/link'
import { getAcademiaStaff } from '@/lib/academia/staffContext'
import NewLessonForm from './NewLessonForm'
export const metadata = { title: 'Añadir contenido a biblioteca — MentorIApp' }
export default async function Page() {
 const {profile,schoolId,scopes}=await getAcademiaStaff()
 const subjects=[...new Map(scopes.map(s=>[s.subject_id,{id:s.subject_id,name:s.subject_name}])).values()]
 const courses=[...new Set(scopes.map(s=>s.grade_level))]
 return <div className="max-w-2xl mx-auto space-y-6"><Link href="/dashboard/academia/biblioteca">← Biblioteca</Link><h1 className="text-2xl font-bold">Añadir contenido a la biblioteca</h1><p className="text-sm text-slate-500">El video y su cuestionario quedarán disponibles para que el profesor los asigne cuando corresponda. Guardarlos aquí no crea tareas ni envía avisos.</p>
 {!scopes.length?<p className="dash-card p-5">Dirección debe configurar tus cursos y materias.</p>:<NewLessonForm schoolId={schoolId} authorProfileId={profile.id} subjects={subjects} courses={courses} scopes={scopes} allowCatalogChanges={profile.role!=='teacher'}/>}</div>
}
