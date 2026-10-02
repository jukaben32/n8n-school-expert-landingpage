import Link from 'next/link'
export default function StaffAcademiaNav() {
  return <nav aria-label="Academia" className="flex flex-wrap gap-3 text-sm">
    <Link className="dash-btn-secondary px-4 py-2" href="/dashboard/academia/asignaciones">Tareas asignadas</Link>
    <Link className="dash-btn-secondary px-4 py-2" href="/dashboard/academia/biblioteca">Biblioteca</Link>
    <Link className="dash-btn-secondary px-4 py-2" href="/dashboard/academia/progreso">Resultados</Link>
  </nav>
}
