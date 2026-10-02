'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {updateTask,reviewTask} from '../actions'
export function TaskSettings({id,active,due}:{id:string;active:boolean;due:string|null}){
 const router=useRouter();const [error,setError]=useState('');const [saving,setSaving]=useState(false)
 return <form className="dash-card p-5 space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setSaving(true);setError('');try{const r=await updateTask(id,f.get('active')==='on',String(f.get('due')??''));if(r.error)setError(r.error);else router.refresh()}catch{setError('No se pudo guardar.')}finally{setSaving(false)}}}>
 <label className="block">Fecha de entrega <input name="due" type="date" defaultValue={due??''} className="border rounded-lg p-2" /></label><label className="block"><input name="active" type="checkbox" defaultChecked={active} /> Disponible para alumnos y familias, también para repaso</label><p className="text-xs text-slate-500">Retirar la tarea conserva las entregas. Reactivarla no vuelve a enviar avisos.</p>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={saving} className="dash-btn-primary px-4 py-2">{saving?'Guardando…':'Guardar cambios'}</button></form>
}
export function ReviewSubmission({assignment,student,feedback='',classroom=false}:{assignment:string;student:string;feedback?:string;classroom?:boolean}){
 const router=useRouter();const [error,setError]=useState('');const [saving,setSaving]=useState(false)
 return <form className="space-y-2 mt-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setSaving(true);setError('');try{const r=await reviewTask(assignment,student,String(f.get('status')),String(f.get('feedback')??''));if(r.error)setError(r.error);else router.refresh()}catch{setError('No se pudo guardar la revisión.')}finally{setSaving(false)}}}>
 <label className="block text-sm">Comentario del profesor<textarea name="feedback" defaultValue={feedback} maxLength={5000} className="block border rounded-lg p-2 w-full" /></label><select name="status" className="border rounded-lg p-2"><option value="reviewed">Revisada / completada</option>{!classroom && <option value="returned">Devolver para corregir</option>}</select><button disabled={saving} className="dash-btn-primary px-4 py-2 ml-2">{saving?'Guardando…':'Guardar revisión'}</button>{error && <p role="alert" className="text-red-700">{error}</p>}</form>
}
