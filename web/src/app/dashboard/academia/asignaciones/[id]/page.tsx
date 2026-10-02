import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getAcademiaStaff} from '@/lib/academia/staffContext'
import {TaskSettings,ReviewSubmission} from './TaskControls'
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {db,schoolId}=await getAcademiaStaff()
 const {data:a}=await db.from('academia_staff_assignments').select('*,lessons(title,description),subjects(name)').eq('id',id).eq('school_id',schoolId).maybeSingle()
 if(!a)notFound()
 const [{data:recipients,error:rError},{data:submissions,error:sError},{data:attempts,error:qError}]=await Promise.all([
 db.from('academia_assignment_students').select('student_id,students(first_name,last_name)').eq('assignment_id',id),
 db.from('academia_submissions').select('*').eq('assignment_id',id),
 db.from('academia_staff_attempts').select('student_id,score,max_score,completed_at').eq('assignment_id',id).not('completed_at','is',null).order('completed_at',{ascending:false}),])
 if(rError||sError||qError)throw Error('No se pudieron cargar las entregas.')
 return <div className="max-w-4xl mx-auto space-y-5"><Link href="/dashboard/academia/asignaciones">← Tareas asignadas</Link><h1 className="text-2xl font-bold">{a.lessons?.title}</h1><p>{a.grade_level} · {a.subjects?.name}</p><p className="dash-card p-5 whitespace-pre-wrap">{a.instructions || a.lessons?.description}</p><TaskSettings id={id} active={a.is_active} due={a.due_date}/>
 <h2 className="font-semibold">Estudiantes y entregas ({recipients?.length??0})</h2>{(recipients??[]).map(r=>{const s=submissions?.find(x=>x.student_id===r.student_id);const q=attempts?.find(x=>x.student_id===r.student_id);const student=r.students as unknown as {first_name:string;last_name:string}|null;return <article key={r.student_id} className="dash-card p-5"><h3 className="font-semibold">{student?`${student.first_name} ${student.last_name}`:'Estudiante'}</h3><p className="text-sm text-slate-500">{q?`Completada · ${q.score}/${q.max_score}`:s?.status==='reviewed'?'Revisada':s?.status==='returned'?'Devuelta para corregir':s?'Entregada, pendiente de revisión':'Pendiente'}</p>{s?.response && <p className="mt-3 whitespace-pre-wrap break-words">{s.response}</p>}{a.delivery_mode!=='quiz' && (s||a.delivery_mode==='classroom') && <ReviewSubmission assignment={id} student={r.student_id} feedback={s?.feedback} classroom={a.delivery_mode==='classroom'}/>}</article>})}</div>
}
