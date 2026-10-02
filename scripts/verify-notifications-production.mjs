import { readFileSync } from 'node:fs'
const token=process.env.SUPABASE_ACCESS_TOKEN
if(!token)throw new Error('Missing access token')
const project='fssjgpqisfnmnkavsyld'
async function query(sql){
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})})
  const text=await response.text(); if(!response.ok)throw new Error(`HTTP ${response.status}: ${text.slice(0,1000)}`)
  return JSON.parse(text)
}
const migration=readFileSync(new URL('../supabase/migrations/20261002014053_family_academia_notifications.sql',import.meta.url),'utf8')
const test=readFileSync(new URL('./test-academia-notifications.sql',import.meta.url),'utf8')
console.log(JSON.stringify(await query(`begin;\n${migration}\n${test}\nrollback;`)))
console.log(JSON.stringify(await query(`select exists(select 1 from pg_extension where extname='pg_cron') as cron_available, coalesce(private.get_app_setting('webhook_secret'),'')<>'' as webhook_configured, coalesce(private.get_app_setting('edge_function_url'),'')<>'' as edge_url_configured;`)))
console.log(JSON.stringify(await query(`select has_schema_privilege('authenticated','private','usage') as private_usage_already_granted; select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and has_function_privilege('authenticated',p.oid,'execute');`)))
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/secrets`,{headers:{Authorization:`Bearer ${token}`}})
if(response.ok){ const names=(await response.json()).map(s=>s.name); console.log(JSON.stringify({edgeSecrets:{WEBHOOK_SECRET:names.includes('WEBHOOK_SECRET'),EVOLUTION_API_URL:names.includes('EVOLUTION_API_URL')}})) }
