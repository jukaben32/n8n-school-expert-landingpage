import {readFileSync} from 'node:fs'
const token=process.env.SUPABASE_ACCESS_TOKEN
if(!token)throw new Error('Missing access token')
const migration=readFileSync(new URL('../supabase/migrations/20261002014053_family_academia_notifications.sql',import.meta.url),'utf8')
if(migration.includes('$mentor_migration$'))throw new Error('Unsafe migration delimiter')
const sql=`begin;\n${migration}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
values('20261002014053','family_academia_notifications',array[$mentor_migration$${migration}$mentor_migration$])
on conflict(version) do nothing;\ncommit;`
const response=await fetch('https://api.supabase.com/v1/projects/fssjgpqisfnmnkavsyld/database/query',{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),
})
if(!response.ok)throw new Error(`Migration failed: HTTP ${response.status}: ${(await response.text()).slice(0,1000)}`)
console.log('Applied and recorded migration 20261002014053. No historical notifications sent.')
