import Link from 'next/link'
import {redirect,notFound} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import LessonPlayer from '../../[id]/LessonPlayer'
import ManualResponse from './ManualResponse'
import {linkifyText} from '@/lib/text/linkifyText'
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login')
 const {data:p}=await db.from('users_profiles').select('role,student_id,school_id').eq('auth_id',user.id).single()
 if(p?.role!=='student'||!p.student_id)redirect('/dashboard/academia')
 const {data:allowed,error:scopeError}=await db.rpc('academia_student_scope',{p_assignment:id,p_student:p.student_id})
 if(scopeError||!allowed)notFound()
 const {data:a,error}=await db.from('academia_assignments').select('*,lessons!inner(id,title,description,video_url,video_provider),subjects(name)').eq('id',id).eq('school_id',p.school_id).single()
 if(error||!a)notFound()
 const [{data:questions,error:qError},{data:attempts,error:aError},{data:submission,error:sError}]=await Promise.all([
 db.from('quiz_questions').select('id,prompt,points,sort_order,image_path,quiz_options(id,label,is_correct,sort_order)').eq('lesson_id',a.lesson_id).order('sort_order'),
 db.from('quiz_attempts').select('id,score,max_score,completed_at').eq('assignment_id',id).eq('student_id',p.student_id).not('completed_at','is',null).order('completed_at',{ascending:false}).limit(1),
 db.from('academia_submissions').select('response,status,feedback').eq('assignment_id',id).eq('student_id',p.student_id).maybeSingle()])
 if(qError||aError||sError)throw Error('No se pudo cargar la tarea completa.')
 const admin=createAdminClient() // Authorization above precedes every signed image.
 const rows=await Promise.all((questions??[]).map(async q=>{const signed=q.image_path?await admin.storage.from('academia-imagenes').createSignedUrl(q.image_path,3600):null;return {...q,quiz_options:[...(q.quiz_options??[])].sort((a,b)=>a.sort_order-b.sort_order),imageUrl:signed?.data?.signedUrl??null}}))
 return <div className="max-w-3xl mx-auto space-y-5"><Link href="/dashboard/academia">← Mis tareas</Link>{a.due_date && <p className="text-sm">Fecha de entrega: {a.due_date}</p>}{a.instructions && <div className="dash-card p-5 whitespace-pre-wrap">{linkifyText(a.instructions)}</div>}
 {a.delivery_mode==='quiz'?<LessonPlayer assignmentId={id} lessonId={a.lesson_id} schoolId={p.school_id} title={a.lessons.title} description={a.lessons.description} subjectName={a.subjects?.name??null} videoUrl={a.lessons.video_url} videoProvider={a.lessons.video_provider} questions={rows} studentId={p.student_id} existingAttempt={attempts?.[0]??null}/>:<><h1 className="text-2xl font-bold">{a.lessons.title}</h1>{a.delivery_mode==='text'?<ManualResponse key={`${submission?.status??'new'}-${submission?.response??''}`} assignment={id} response={submission?.response} status={submission?.status} feedback={submission?.feedback}/>:<p className="dash-card p-5">Realiza esta tarea en tu cuaderno o según las instrucciones. El profesor registrará la revisión en clase.{submission?.status==='reviewed'?' Ya está revisada y completada.':''}{submission?.feedback?` Comentario: ${submission.feedback}`:''}</p>}</>}
 </div>
}
