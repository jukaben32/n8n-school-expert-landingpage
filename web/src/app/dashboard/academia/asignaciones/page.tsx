import Link from 'next/link'
import StaffAcademiaNav from '@/components/academia/StaffAcademiaNav'
import { getAcademiaStaff } from '@/lib/academia/staffContext'
export const metadata={title:'Tareas asignadas — MentorIApp'}
export default async function Page({searchParams}:{searchParams:Promise<{p?:string;curso?:string}>}){
  const params=await searchParams
  const {db,schoolId,scopes}=await getAcademiaStaff()
  const page=Math.max(1,Number.parseInt(params.p ?? '1')||1)
  const grade=scopes.some(s=>s.grade_level===params.curso)?params.curso:''
  let query=db.from('academia_staff_assignments').select('id,grade_level,due_date,delivery_mode,is_active,created_at,lessons(title),subjects(name)',{count:'exact'}).eq('school_id',schoolId).order('created_at',{ascending:false}).order('id')
  if(grade)query=query.eq('grade_level',grade)
  const {data,error,count}=await query.range((page-1)*30,page*30-1)
  if(error)throw Error('No se pudieron cargar las tareas asignadas.')
  return <div className="max-w-4xl mx-auto space-y-6"><StaffAcademiaNav /><header className="flex justify-between gap-4"><h1 className="text-2xl font-bold">Tareas asignadas</h1><Link className="dash-btn-primary px-4 py-2" href="/dashboard/academia/asignaciones/nueva">+ Asignar tarea</Link></header>
    <form className="flex gap-3"><select name="curso" defaultValue={grade} className="border rounded-lg p-2"><option value="">Todos mis cursos</option>{[...new Set(scopes.map(s=>s.grade_level))].map(g=><option key={g}>{g}</option>)}</select><button className="dash-btn-secondary px-4 py-2">Filtrar</button></form>
    {!data?.length && <p className="dash-card p-5">No hay tareas en esta selección. Puedes asignar contenido de la biblioteca o crear una tarea manual.</p>}
    {(data ?? []).map(a=><Link key={a.id} href={`/dashboard/academia/asignaciones/${a.id}`} className="dash-card block p-5"><p className="font-semibold">{(a.lessons as unknown as {title:string}|null)?.title}</p><p className="text-sm text-slate-500 mt-2">{a.grade_level} · {(a.subjects as unknown as {name:string}|null)?.name} · {a.delivery_mode==='quiz'?'Video/cuestionario':a.delivery_mode==='text'?'Respuesta escrita':'En cuaderno'} · {a.is_active?'Activa':'Retirada'}{a.due_date?` · Entrega: ${a.due_date}`:''}</p></Link>)}
    <nav className="flex gap-5">{page>1 && <Link href={`?curso=${encodeURIComponent(grade ?? '')}&p=${page-1}`}>← Anterior</Link>}{page*30<(count ?? 0) && <Link href={`?curso=${encodeURIComponent(grade ?? '')}&p=${page+1}`}>Siguiente →</Link>}</nav>
  </div>
}
