const token=process.env.SUPABASE_ACCESS_TOKEN
if(!token)throw Error('Missing access token')
const project=process.env.SUPABASE_PROJECT_REF||'fssjgpqisfnmnkavsyld'
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
const keysResponse=await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys?reveal=true`,{headers})
if(!keysResponse.ok)throw Error(`Cannot validate REST schema: HTTP ${keysResponse.status}`)
// Keep credentials in memory; never serialize keys or API responses containing them.
const key=(await keysResponse.json()).find(k=>k.name==='service_role')?.api_key
if(!key)throw Error('Service key unavailable for schema validation')
for(const [table,select] of [
 ['academia_staff_lessons','id,subjects(name)'],
 ['academia_staff_assignments','id,lessons(title),subjects(name)'],
 ['academia_staff_attempts','id,lessons(title,subjects(name)),students(first_name)'],
 ['academia_assignments','id,lessons!inner(id,title),subjects(name),academia_assignment_students!inner(student_id)'],
]){
 const url=new URL(`https://${project}.supabase.co/rest/v1/${table}`);url.searchParams.set('select',select);url.searchParams.set('limit','1')
 const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`}})
 if(!r.ok)throw Error(`${table}: HTTP ${r.status}: ${(await r.text()).slice(0,800)}`)
 console.log(`PASS REST relationships: ${table}`)
}
const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers,body:JSON.stringify({query:`select
 (select count(*) from public.lessons where title like 'TEST-ASSIGNMENTS-%') test_lessons,
 (select count(*) from public.academia_assignments where legacy) preserved_assignments,
 (select count(*) from supabase_migrations.schema_migrations where version in ('20261002030916','20261002035515')) recorded_migrations,
 to_regprocedure('public.academia_legacy_attempt_scope(uuid,uuid,uuid)') is not null legacy_bridge_active;`})})
if(!r.ok)throw Error('Deployment state unavailable');console.log(await r.json())
const advisors=await fetch(`https://api.supabase.com/v1/projects/${project}/advisors/security`,{headers})
if(advisors.ok){const report=await advisors.json();const relevant=(report.lints??[]).filter(x=>/academia_(assign|staff|submi|family|student|lesson|avail|review|creat)|academia_submissions/.test(JSON.stringify(x.metadata)))
 console.log('Academia advisor findings:',relevant.map(x=>({name:x.name,level:x.level,entity:x.metadata?.name})))
 if(relevant.some(x=>x.level==='ERROR'))throw Error('New Academia security advisor error')
}
