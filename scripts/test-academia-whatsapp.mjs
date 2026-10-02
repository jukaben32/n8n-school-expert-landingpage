import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import ts from '../web/node_modules/typescript/lib/typescript.js'
let handler, calls, tables, config, failRead
function reset(){
  calls=[];config={WEBHOOK_SECRET:'test-secret',EVOLUTION_API_URL:'https://provider.invalid',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'};failRead=false
  tables={whatsapp_connections:[{school_id:'school',provider:'evolution_api',status:'connected',is_enabled:true,instance_name:'school-instance',instance_token:'fixture-token'}],
    family_academia_notifications:[{id:'notice',school_id:'school',guardian_id:'guardian',student_id:'child',lesson_id:'lesson',whatsapp_state:'pending',whatsapp_attempts:0,created_at:new Date().toISOString()}],
    students:[{id:'child',school_id:'school',first_name:'Alumno',grade_level:'6to',deleted_at:null}],
    guardians:[{id:'guardian',school_id:'school',phone:'8091234567',deleted_at:null}],
    lessons:[{id:'lesson',school_id:'school',title:'Tarea',grade_level:'6to',is_published:true,deleted_at:null}],
    student_guardians:[{guardian_id:'guardian',student_id:'child'}]}
}
function from(table){
  let single=false,payload=null,limit=Infinity;const filters=[]
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},limit(n){limit=n;return q},update(p){payload=p;return q},maybeSingle(){single=true;return q},then(done,rejected){return Promise.resolve().then(()=>{
    if(failRead && table==='students')return {data:null,error:{code:'temporary_failure'}}
    const rows=tables[table].filter(r=>filters.every(f=>f(r))).slice(0,limit)
    if(payload)rows.forEach(r=>Object.assign(r,payload))
    return {data:single?rows[0]??null:rows,count:rows.length,error:null}
  }).then(done,rejected)}};return q
}
const source=readFileSync(new URL('../supabase/functions/notify-academia/index.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
new Function('require','exports','Deno','fetch',compiled)(()=>({createClient:()=>({from})}),{}, {env:{get:key=>config[key]},serve:fn=>{handler=fn}},async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true}})
const request=(secret='test-secret',body={})=>new Request('https://fixture.invalid/notify-academia',{method:'POST',headers:{'x-webhook-secret':secret},body:JSON.stringify(body)})
await test('unauthorized and missing secret fail closed',async()=>{reset();assert.equal((await handler(request('wrong'))).status,401);delete config.WEBHOOK_SECRET;assert.equal((await handler(request())).status,401);assert.equal(calls.length,0)})
await test('disabled or missing provider configuration never sends',async()=>{reset();delete config.EVOLUTION_API_URL;await handler(request());assert.equal(calls.length,0);reset();tables.whatsapp_connections[0].is_enabled=false;await handler(request());assert.equal(calls.length,0);assert.equal(tables.family_academia_notifications[0].whatsapp_state,'pending')})
await test('recipient and message come from verified database rows, never payload',async()=>{reset();await handler(request('test-secret',{guardian_id:'foreign',text:'forged',to:'foreign'}));assert.equal(calls.length,1);assert.equal(calls[0].body.number,'18091234567');assert.match(calls[0].body.text,/Alumno: Tarea/);assert.ok(!calls[0].body.text.includes('forged'));assert.equal(tables.family_academia_notifications[0].whatsapp_state,'sent')})
await test('removed link, foreign course and unpublished lesson are not sent',async()=>{for(const change of [()=>{tables.student_guardians=[]},()=>{tables.lessons[0].grade_level='foreign'},()=>{tables.lessons[0].is_published=false},()=>{tables.guardians[0].school_id='foreign'}]){reset();change();await handler(request());assert.equal(calls.length,0);assert.equal(tables.family_academia_notifications[0].whatsapp_state,'cancelled')}})
await test('transient database read error leaves notice pending',async()=>{reset();failRead=true;await handler(request());assert.equal(calls.length,0);assert.equal(tables.family_academia_notifications[0].whatsapp_state,'pending')})
await test('concurrent webhook calls claim only one send',async()=>{reset();await Promise.all([handler(request()),handler(request())]);assert.equal(calls.length,1)})
await test('sent notice is not sent again',async()=>{reset();await handler(request());await handler(request());assert.equal(calls.length,1)})
