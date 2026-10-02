import {readFileSync} from 'node:fs'
const token=process.env.SUPABASE_ACCESS_TOKEN
if(!token)throw Error('Missing access token')
const project=process.env.SUPABASE_PROJECT_REF||'fssjgpqisfnmnkavsyld'
const finish=process.argv[2]==='finish'
const version=finish?'20261002035515':'20261002030916'
const name=finish?'academia_finish_assignment_rollout':'academia_library_assignments'
const migration=readFileSync(new URL(`../supabase/migrations/${version}_${name}.sql`,import.meta.url),'utf8')
const query=`begin;\n${migration}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$migration$${migration}$migration$]) on conflict(version) do nothing;\nselect count(*) as preserved_assignments from public.academia_assignments where legacy;commit;`
const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query})})
const text=await r.text();if(!r.ok)throw Error(`HTTP ${r.status}: ${text}`);console.log(text)
