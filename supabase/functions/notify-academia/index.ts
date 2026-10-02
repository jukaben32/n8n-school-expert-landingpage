import { createClient } from 'npm:@supabase/supabase-js@2.110.0'

// Private database webhook. Payload cannot choose recipients or message text.
Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('Unauthorized', { status: 401 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const base = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/,'')
  if (!base) return Response.json({sent:0,deferredConfiguration:true})
  const {data: connections,error: connectionError} = await db.from('whatsapp_connections')
    .select('school_id,instance_name,instance_token').eq('provider','evolution_api').eq('is_enabled',true).eq('status','connected')
  if(connectionError)return new Response('Connection unavailable',{status:503})
  const eligible=(connections ?? []).filter(c=>c.instance_name && c.instance_token)
  if(!eligible.length)return Response.json({sent:0,deferredConnection:true})
  const { data: notices, error } = await db.from('family_academia_notifications')
    .select('id,school_id,guardian_id,student_id,lesson_id,assignment_id,whatsapp_attempts')
    .eq('whatsapp_state','pending').gt('created_at',new Date(Date.now()-7*86400000).toISOString())
    .in('school_id',eligible.map(c=>c.school_id))
    .order('created_at').limit(50)
  if (error) return new Response('Queue unavailable', { status: 503 })
  let sent=0, deferred=0
  for (const n of notices ?? []) {
    const connection=eligible.find(c=>c.school_id===n.school_id)!
    const results = await Promise.all([
      db.from('students').select('first_name,grade_level').eq('id',n.student_id).eq('school_id',n.school_id).is('deleted_at',null).maybeSingle(),
      db.from('guardians').select('phone').eq('id',n.guardian_id).eq('school_id',n.school_id).is('deleted_at',null).maybeSingle(),
      db.from('lessons').select('title,grade_level,subject_id,is_published').eq('id',n.lesson_id).eq('school_id',n.school_id).is('deleted_at',null).maybeSingle(),
      db.from('student_guardians').select('student_id',{count:'exact',head:true}).eq('guardian_id',n.guardian_id).eq('student_id',n.student_id),
      db.from('academia_assignments').select('id,is_active,grade_level,subject_id').eq('id',n.assignment_id).eq('lesson_id',n.lesson_id).eq('school_id',n.school_id).maybeSingle(),
      db.from('academia_assignment_students').select('student_id',{count:'exact',head:true}).eq('assignment_id',n.assignment_id).eq('student_id',n.student_id),
    ])
    if(results.some(r=>r.error)){deferred++;continue}
    const [{ data: student },{ data: guardian },{ data: lesson },{ count: linked },{data:assignment},{count:assigned}]=results
    if (!student || !guardian || !lesson?.is_published || lesson.grade_level!==student.grade_level || !linked || !assignment?.is_active || assignment.grade_level!==student.grade_level || assignment.subject_id!==lesson.subject_id || !assigned) {
      await db.from('family_academia_notifications').update({whatsapp_state:'cancelled'}).eq('id',n.id).eq('whatsapp_state','pending'); continue
    }
    let phone=(guardian.phone ?? '').replace(/\D/g,'')
    if(phone.length===10)phone='1'+phone
    if(!/^1\d{10}$/.test(phone)) {
      await db.from('family_academia_notifications').update({whatsapp_state:'failed'}).eq('id',n.id).eq('whatsapp_state','pending'); deferred++; continue
    }
    const { data: claim, error: claimError } = await db.from('family_academia_notifications')
      .update({whatsapp_state:'sending',whatsapp_claimed_at:new Date().toISOString(),whatsapp_attempts:n.whatsapp_attempts+1})
      .eq('id',n.id).eq('whatsapp_state','pending').select('id').maybeSingle()
    if(claimError || !claim)continue
    try {
      const site=(Deno.env.get('SITE_URL')||'https://n8n-school-expert-landingpage.vercel.app').replace(/\/$/,'')
      const response=await fetch(`${base}/message/sendText/${encodeURIComponent(connection.instance_name)}`,{
        method:'POST',headers:{'Content-Type':'application/json',apikey:connection.instance_token},
        body:JSON.stringify({number:phone,text:`Nueva tarea para ${student.first_name}: ${lesson.title}\nConsulte la tarea en el Portal Familiar:\n${site}/dashboard/portal-familiar/hijos/${n.student_id}/lecciones/${n.assignment_id}`}),
        signal:AbortSignal.timeout(15000),
      })
      if(!response.ok)throw new Error('Provider rejected delivery')
      const { error: saveError } = await db.from('family_academia_notifications').update({whatsapp_state:'sent',whatsapp_sent_at:new Date().toISOString()}).eq('id',n.id).eq('whatsapp_state','sending')
      if(saveError)console.error('Academia: delivery state unavailable')
      sent++
    } catch {
      // Do not automatically resend an ambiguous provider response: avoid duplicates.
      await db.from('family_academia_notifications').update({whatsapp_state:'failed'}).eq('id',n.id).eq('whatsapp_state','sending')
      console.error('Academia: WhatsApp delivery failed')
    }
  }
  return Response.json({sent,deferred})
})
