import {readFileSync} from 'node:fs'
const token=process.env.SUPABASE_ACCESS_TOKEN
if(!token)throw Error('Missing access token')
const project=process.env.SUPABASE_PROJECT_REF||'fssjgpqisfnmnkavsyld'
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const text=await r.text();if(!r.ok)throw Error(`HTTP ${r.status}: ${text}`);return JSON.parse(text)}
const migration=readFileSync(new URL('../supabase/migrations/20261002030916_academia_library_assignments.sql',import.meta.url),'utf8')
const regression=readFileSync(new URL('./test-academia-assignments.sql',import.meta.url),'utf8')
const finish=readFileSync(new URL('../supabase/migrations/20261002035515_academia_finish_assignment_rollout.sql',import.meta.url),'utf8')
const bridge=readFileSync(new URL('./test-academia-rollout-bridge.sql',import.meta.url),'utf8')
console.log(await query(`begin;\n${migration}\n${bridge}\nselect 'legacy_player_bridge_passed' result;rollback;`))
console.log(await query(`begin;\n${migration}\n${finish}\n${regression}\nselect 'assignment_permissions_and_workflows_passed' result;rollback;`))
console.log(await query(`select count(*) fixtures from public.lessons where title like 'TEST-ASSIGNMENTS-%';`))
