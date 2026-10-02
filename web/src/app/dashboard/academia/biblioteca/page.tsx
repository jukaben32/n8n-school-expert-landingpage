import Link from 'next/link'
import { getAcademiaStaff } from '@/lib/academia/staffContext'
import StaffAcademiaNav from '@/components/academia/StaffAcademiaNav'
export const metadata = { title: 'Biblioteca — Academia — MentorIApp' }
export default async function Page({ searchParams }: { searchParams: Promise<{ curso?: string; materia?: string; q?: string; p?: string }> }) {
  const params = await searchParams
  const { db, schoolId, scopes } = await getAcademiaStaff()
  const grade = scopes.some(s => s.grade_level === params.curso) ? params.curso! : scopes[0]?.grade_level ?? ''
  const subjects = scopes.filter(s => s.grade_level === grade)
  const subject = subjects.some(s => s.subject_id === params.materia) ? params.materia! : ''
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.p ?? '1') || 1))
  const search = (params.q ?? '').trim().slice(0,100)
  let query = db.from('academia_staff_lessons').select('id,title,description,grade_level,subject_id,is_published,video_url,subjects(name)', { count: 'exact' })
    .eq('school_id',schoolId).eq('is_library',true).eq('grade_level',grade).is('deleted_at',null).order('title').order('id')
  if (subject) query = query.eq('subject_id',subject)
  if (search) query = query.ilike('title',`%${search.replace(/[%_\\]/g,'\\$&')}%`)
  const { data, count, error } = await query.range((page-1)*30,page*30-1)
  if (error) throw Error('No se pudo cargar la biblioteca.')
  const link = (p: number) => `/dashboard/academia/biblioteca?${new URLSearchParams({curso:grade,materia:subject,q:search,p:String(p)})}`
  return <div className="max-w-4xl mx-auto space-y-6"><StaffAcademiaNav />
    <header className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-bold">Biblioteca del curso</h1><p className="text-sm text-slate-500 mt-2">Guardar o publicar una lección aquí no la asigna. Selecciona una actividad cuando quieras enviarla como tarea.</p></div><Link className="dash-btn-primary px-4 py-2" href="/dashboard/academia/nueva">+ Añadir contenido</Link></header>
    <form className="dash-card p-4 flex flex-wrap gap-3" method="get">
      <label>Curso<select name="curso" defaultValue={grade} className="block border rounded-lg p-2">{[...new Set(scopes.map(s=>s.grade_level))].map(g=><option key={g}>{g}</option>)}</select></label>
      <label>Materia<select name="materia" defaultValue={subject} className="block border rounded-lg p-2"><option value="">Todas mis materias</option>{[...new Map(scopes.map(s=>[s.subject_id,s])).values()].map(s=><option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}</select></label>
      <label>Buscar<input name="q" defaultValue={search} maxLength={100} className="block border rounded-lg p-2" /></label><button className="dash-btn-primary px-4 py-2 self-end">Buscar</button>
    </form>
    <p className="text-sm text-slate-500">{count ?? 0} contenidos · Página {page}</p>
    {!scopes.length && <p className="dash-card p-5">Dirección debe asignarte cursos y, para Secundaria, las materias en el horario.</p>}
    <div className="grid gap-4">{(data ?? []).map(l=><article key={l.id} className="dash-card p-5 space-y-3">
      <p className="text-xs text-slate-500">{(l.subjects as unknown as {name:string}|null)?.name} · {l.grade_level} · {l.is_published?'Disponible':'Borrador'}</p><h2 className="font-semibold">{l.title}</h2>
      {l.description && <p className="text-sm whitespace-pre-wrap">{l.description}</p>}
      <div className="flex gap-4 text-sm"><Link className="text-dash-accent underline" href={`/dashboard/academia/biblioteca/${l.id}`}>Ver contenido</Link>{l.is_published && <Link className="text-dash-accent underline" href={`/dashboard/academia/asignaciones/nueva?leccion=${l.id}`}>Asignar como tarea →</Link>}</div>
    </article>)}</div>
    <nav className="flex gap-5 text-sm">{page>1 && <Link href={link(page-1)}>← Anterior</Link>}{page*30<(count ?? 0) && <Link href={link(page+1)}>Siguiente →</Link>}</nav>
  </div>
}
