import Link from 'next/link'
import {createClient} from '@/lib/supabase/server'
import {canAccess} from '@/lib/permissions'
import {redirect} from 'next/navigation'
export const metadata={title:'Mis tareas — Academia — MentorIApp'}
type Task={id:string;lesson_id:string;grade_level:string;due_date:string|null;delivery_mode:string;instructions:string;lessons:{title:string;description:string|null;video_url:string|null}|null;subjects:{name:string}|null}
export default async function Page({searchParams}:{searchParams:Promise<{p?:string}>}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login')
 const {data:profile}=await db.from('users_profiles').select('role,school_id,student_id').eq('auth_id',user.id).single()
 if(!profile)redirect('/login')
 if(canAccess(profile.role,'academia_gestionar'))redirect('/dashboard/academia/asignaciones')
 if(profile.role!=='student')redirect('/dashboard/portal-familiar/academia')
 if(!profile.student_id)return <p className="dash-card p-6">Tu cuenta todavía no está vinculada a un estudiante. Contacta con Secretaría.</p>
 const page=Math.max(1,Number.parseInt((await searchParams).p??'1')||1)
 const [{data:student},{data:tasks,error,count},{data:attempts,error:attemptError},{data:submissions,error:submissionError},{data:points},{data:badges}]=await Promise.all([
 db.from('students').select('first_name,grade_level').eq('id',profile.student_id).eq('school_id',profile.school_id).maybeSingle(),
 db.from('academia_assignments').select('id,lesson_id,grade_level,due_date,delivery_mode,instructions,lessons!inner(title,description,video_url),subjects(name),academia_assignment_students!inner(student_id)',{count:'exact'})
 .eq('school_id',profile.school_id).eq('academia_assignment_students.student_id',profile.student_id).eq('is_active',true).order('created_at',{ascending:false}).order('id').range((page-1)*30,page*30-1),
 db.from('quiz_attempts').select('assignment_id,score,max_score,completed_at').eq('student_id',profile.student_id).not('completed_at','is',null).order('completed_at',{ascending:false}),
 db.from('academia_submissions').select('assignment_id,status').eq('student_id',profile.student_id),
 db.from('student_points').select('total_points,current_streak_days').eq('student_id',profile.student_id).maybeSingle(),
 db.from('student_badges').select('badge_id,badges(name,icon)').eq('student_id',profile.student_id),])
 if(error||attemptError||submissionError)throw Error('No se pudieron cargar tus tareas y su progreso. Inténtalo de nuevo.')
 const rows=(tasks??[]) as unknown as Task[]
 const status=(a:Task)=>{const q=attempts?.find(x=>x.assignment_id===a.id);const s=submissions?.find(x=>x.assignment_id===a.id);return q?`Completada · ${q.score}/${q.max_score}`:s?.status==='reviewed'?'Completada':s?.status==='submitted'?'Entregada · esperando revisión':s?.status==='returned'?'Devuelta · corrige tu respuesta':'Pendiente'}
 const complete=(a:Task)=>!!attempts?.some(x=>x.assignment_id===a.id)||submissions?.some(x=>x.assignment_id===a.id && x.status==='reviewed')
 const next=rows.find(a=>!complete(a)&&!submissions?.some(s=>s.assignment_id===a.id&&s.status==='submitted'))
 return <div className="max-w-4xl mx-auto space-y-6"><header className="dash-card p-6"><h1 className="text-2xl font-bold">Hola, {student?.first_name??'estudiante'}</h1><p className="text-sm mt-2">{student?.grade_level??'Sin curso asignado'} · Mis tareas de Academia</p><p className="text-sm mt-3">{points?.total_points??0} puntos · Racha: {points?.current_streak_days??0} días</p>
 {!!badges?.length && <div className="flex gap-3 mt-3">{badges.map(b=>{const badge=b.badges as unknown as {name:string;icon:string}|null;return <span key={b.badge_id}>{badge?.icon} {badge?.name}</span>})}</div>}</header>
 <p className="text-sm text-slate-500">Aquí aparecen las actividades que tu profesor asignó a tu curso. Las completadas siguen disponibles para repasar.</p>
 {next && <Link className="dash-card block border-2 border-emerald-400 p-5" href={`/dashboard/academia/tareas/${next.id}`}><p className="text-sm text-emerald-700">Continuar tarea</p><p className="font-semibold mt-1">{next.lessons?.title}</p></Link>}
 {!rows.length?<p className="dash-card p-6">{student?.grade_level?'Todavía no hay tareas asignadas para tu curso.':'Secretaría debe completar el curso en tu ficha.'}</p>:
 [{title:'Mis tareas',rows:rows.filter(a=>!complete(a))},{title:'Completadas · repaso',rows:rows.filter(complete)}].map(group=><section key={group.title} className="space-y-3"><h2 className="font-semibold">{group.title}</h2>{group.rows.map(a=><Link key={a.id} className="dash-card block p-5" href={`/dashboard/academia/tareas/${a.id}`}><p className="text-xs text-slate-500">{a.subjects?.name} · {a.delivery_mode==='quiz'?'Video / cuestionario':a.delivery_mode==='text'?'Respuesta escrita':'En cuaderno'}</p><h3 className="font-semibold mt-1">{a.lessons?.title}</h3>{a.due_date && <p className="text-sm mt-2">Entrega: {a.due_date}</p>}<p className="text-sm text-dash-accent mt-2">{status(a)} · Abrir →</p></Link>)}</section>)}
 <nav className="flex gap-5">{page>1 && <Link href={`?p=${page-1}`}>← Anterior</Link>}{page*30<(count??0) && <Link href={`?p=${page+1}`}>Siguiente →</Link>}</nav></div>
}
