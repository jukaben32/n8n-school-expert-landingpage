'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
export default function ManualResponse({assignment,response='',status,feedback}:{assignment:string;response?:string;status?:string;feedback?:string}){
 const router=useRouter();const [text,setText]=useState(response);const [saving,setSaving]=useState(false);const [error,setError]=useState('')
 const editable=!status||status==='returned'
 return <section className="dash-card p-5 space-y-3"><h2 className="font-semibold">Mi respuesta</h2>{feedback && <p className="rounded-lg bg-blue-50 text-blue-900 p-3 whitespace-pre-wrap">Comentario del profesor: {feedback}</p>}
 {editable?<form className="space-y-3" onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');try{const {error}=await createClient().rpc('academia_submit_text',{p_assignment:assignment,p_response:text});if(error)setError(error.message);else router.refresh()}catch{setError('No se pudo enviar. Tu respuesta sigue en esta pantalla.')}finally{setSaving(false)}}}><textarea aria-label="Respuesta a la tarea" required maxLength={20000} rows={8} className="w-full border rounded-xl p-3" value={text} onChange={e=>setText(e.target.value)}/><button disabled={saving} className="dash-btn-primary px-5 py-3">{saving?'Enviando…':'Entregar respuesta'}</button></form>:<><p className="whitespace-pre-wrap break-words">{response}</p><p className="text-sm text-slate-500">{status==='reviewed'?'Tarea revisada y completada.':'Respuesta entregada; esperando revisión del profesor.'}</p></>}
 {error && <p role="alert" className="text-red-700">{error}</p>}</section>
}
