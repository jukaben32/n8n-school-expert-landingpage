import {createClient} from '@/lib/supabase/server'
import {redirect,notFound} from 'next/navigation'
// Preserve old bookmarks while enforcing the new assigned-task scope.
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login')
 const {data:profile}=await db.from('users_profiles').select('role,student_id').eq('auth_id',user.id).single()
 if(profile?.role!=='student'||!profile.student_id)redirect('/dashboard/academia')
 const {data:a,error}=await db.from('academia_assignments').select('id,academia_assignment_students!inner(student_id)').eq('lesson_id',id).eq('academia_assignment_students.student_id',profile.student_id).eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(error||!a)notFound();redirect(`/dashboard/academia/tareas/${a.id}`)
}
