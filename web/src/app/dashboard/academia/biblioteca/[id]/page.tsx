/* eslint-disable @next/next/no-img-element -- private signed educational images */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAcademiaStaff } from '@/lib/academia/staffContext'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkifyText } from '@/lib/text/linkifyText'
export default async function Page({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params
  const { db, schoolId } = await getAcademiaStaff()
  const { data: lesson } = await db.from('academia_staff_lessons').select('id,title,description,video_url,grade_level,subject_id,is_published').eq('id',id).eq('school_id',schoolId).eq('is_library',true).is('deleted_at',null).maybeSingle()
  if (!lesson) notFound()
  const { data: questions, error } = await db.from('quiz_questions').select('id,prompt,image_path,quiz_options(id,label,is_correct)').eq('lesson_id',id).order('sort_order')
  if (error) throw Error('No se pudo cargar el cuestionario.')
  const admin = createAdminClient() // Only after user-scoped lesson authorization.
  const rows = await Promise.all((questions ?? []).map(async q=>{
    const signed = q.image_path ? await admin.storage.from('academia-imagenes').createSignedUrl(q.image_path,3600) : null
    return {...q,image:signed?.data?.signedUrl}
  }))
  let video:string|null=null
  try { const url=new URL(lesson.video_url ?? ''); if(['http:','https:'].includes(url.protocol))video=url.href } catch {}
  return <div className="max-w-3xl mx-auto space-y-5"><Link href="/dashboard/academia/biblioteca">← Biblioteca</Link><h1 className="text-2xl font-bold">{lesson.title}</h1><p>{lesson.grade_level} · {lesson.is_published?'Disponible en biblioteca':'Borrador'}</p>
    {lesson.description && <div className="dash-card p-5 whitespace-pre-wrap">{linkifyText(lesson.description)}</div>}
    {video && <a className="underline" href={video} target="_blank" rel="noreferrer">Ver video ↗</a>}
    {rows.map(q=><article className="dash-card p-5 space-y-3" key={q.id}><p>{q.prompt}</p>{q.image && <img src={q.image} alt="Imagen de apoyo" className="max-w-full rounded-lg" />}
      <ul>{(q.quiz_options ?? []).map(o=><li key={o.id}>{o.label}{o.is_correct?' ✓':''}</li>)}</ul></article>)}
    {lesson.is_published && <Link className="dash-btn-primary inline-block px-5 py-3" href={`/dashboard/academia/asignaciones/nueva?leccion=${id}`}>Asignar como tarea</Link>}
  </div>
}
