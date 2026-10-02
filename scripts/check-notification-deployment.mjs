const token=process.env.SUPABASE_ACCESS_TOKEN
if(!token)throw new Error('Missing access token')
const project='fssjgpqisfnmnkavsyld'
async function sql(query){
  const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query})})
  if(!r.ok)throw new Error('Database check failed')
  return r.json()
}
const endpoint=`https://${project}.supabase.co/functions/v1/notify-academia`
const unauthorized=await fetch(endpoint,{method:'POST',body:'{}'})
if(unauthorized.status!==401)throw new Error('Webhook did not reject unauthenticated request')
// Read the existing secret only in memory to verify the private webhook.
const [{secret}]=await sql(`select private.get_app_setting('webhook_secret') as secret;`)
const authorized=await fetch(endpoint,{method:'POST',headers:{'x-webhook-secret':secret,'Content-Type':'application/json'},body:'{}'})
if(!authorized.ok)throw new Error(`Webhook verification failed: HTTP ${authorized.status}`)
console.log(JSON.stringify({unauthorizedStatus:unauthorized.status,authorizedStatus:authorized.status,result:await authorized.json()}))
console.log(JSON.stringify(await sql(`select (select count(*) from public.lessons where title like 'ROLLBACK%') as test_lessons,
(select count(*) from public.family_academia_notifications n join public.lessons l on l.id=n.lesson_id where l.title like 'ROLLBACK%') as test_notices,
(select count(*) from cron.job where jobname='family-academia-whatsapp' and active) as active_retry_jobs,
(select count(*) from supabase_migrations.schema_migrations where version='20261002014053') as recorded_migration;`)))
const advisors=await fetch(`https://api.supabase.com/v1/projects/${project}/advisors/security`,{headers:{Authorization:`Bearer ${token}`}})
if(!advisors.ok)throw new Error(`Security advisor unavailable: HTTP ${advisors.status}`)
const findings=(await advisors.json()).lints ?? []
console.log(JSON.stringify({notificationSecurityFindings:findings.filter(f=>JSON.stringify(f.metadata??{}).includes('academia_notice') || (f.detail??'').includes('academia_notice')).map(f=>({name:f.name,level:f.level,entity:f.metadata?.name}))}))
