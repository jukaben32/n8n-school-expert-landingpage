import Link from 'next/link'
import { getFamilyContext } from '@/lib/academia/familyContext'
import { listFamilyStudents } from '@/lib/academia/familyData'

export const metadata = { title: 'Academia de mis hijos — MentorIApp' }

export default async function FamilyAcademiaPage() {
  const { client, profile } = await getFamilyContext()
  const students = await listFamilyStudents(client, profile)
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/portal-familiar" className="text-sm text-dash-accent hover:underline">← Portal Familiar</Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow">Academia</h1>
        <p className="text-sm text-slate-500 mt-1">Selecciona a tu hijo para revisar sus tareas y su progreso.</p>
      </div>
      {students.length ? students.map(student => (
        <Link key={student.id} href={`/dashboard/portal-familiar/hijos/${student.id}`} className="dash-card block p-5 hover:border-primary/30 transition">
          <p className="font-semibold">{student.first_name} {student.last_name}</p>
          <p className="text-sm text-slate-500 mt-1">{student.grade_level ?? 'Sin curso asignado'} · Ver tareas →</p>
        </Link>
      )) : <p className="dash-card p-6 text-sm text-slate-500">No hay estudiantes vinculados a tu cuenta. Contacta a la secretaría del colegio.</p>}
    </div>
  )
}
