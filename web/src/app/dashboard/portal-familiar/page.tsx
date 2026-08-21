import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentCard from '@/components/portal/StudentCard'
import SummaryBadge from '@/components/portal/SummaryBadge'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import FamilyChatWidget from '@/components/portal/FamilyChatWidget'
import VoiceCallWidget from '@/components/portal/VoiceCallWidget'
import DirectMessagesWidget from '@/components/portal/DirectMessagesWidget'
import FloatingWhatsAppButton from '@/components/FloatingWhatsAppButton'
import { getFamilyClassUpdates } from './actions'

export const metadata: Metadata = {
  title: 'Portal Familiar — MentorIApp',
  description: 'Consulta asistencia, comunicados y pagos de tus hijos.',
}

/**
 * Portal Familiar — Vista principal para padres/tutores
 * Muestra: lista de hijos, últimos comunicados y estado de pagos.
 */
export default async function PortalFamiliarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener el perfil del guardian (incluyendo role para verificar permisos)
  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, guardian_id, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (profile?.role === 'school_admin' || profile?.role === 'director') {
    redirect('/dashboard/secretaria')
  }

  // Obtener los estudiantes vinculados a este guardian
  const { data: students, error: studentsError } = profile?.guardian_id
    ? await supabase
        .from('student_guardians')
        .select(`
          relationship,
          students (
            id, first_name, last_name, photo_url, enrollment_status
          )
        `)
        .eq('guardian_id', profile.guardian_id)
    : { data: [], error: null }

  // Mismo botón flotante de WhatsApp que el sitio público -- schools_public
  // ya expone solo lo necesario (número + si está realmente activo), nunca
  // whatsapp_connections directo.
  const { data: school } = profile?.school_id
    ? await supabase.from('schools_public').select('name, whatsapp_active, whatsapp_phone_number').eq('id', profile.school_id).maybeSingle()
    : { data: null }

  const classUpdatesResult = await getFamilyClassUpdates()
  const classUpdates = classUpdatesResult.ok ? classUpdatesResult.updates ?? [] : []

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <QueryErrorBanner errors={[{ label: 'tus hijos', error: studentsError }]} />

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Portal Familiar
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consulta el estado de tus hijos en el colegio
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryBadge label="Comunicados" value="Ver" icon="📬" href="/dashboard/comunicados" />
        <SummaryBadge label="Pagos" value="Ver" icon="💳" href="/dashboard/pagos" />
        <SummaryBadge label="Asistencia" value="Ver" icon="📅" href="/dashboard/asistencia" />
      </div>

      {/* Lista de estudiantes */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Mis hijos
        </h2>

        {students && students.length > 0 ? (
          <div className="space-y-3">
            {students.map((sg) => {
              // Cast seguro usando unknown como intermediario
              type StudentShape = {
                id: string; first_name: string; last_name: string;
                photo_url: string | null; enrollment_status: string | null
              }
              const student = (sg.students as unknown) as StudentShape | null
              if (!student) return null
              return (
                <div key={student.id} className="space-y-1.5">
                  <StudentCard
                    id={student.id}
                    firstName={student.first_name}
                    lastName={student.last_name}
                    photoUrl={student.photo_url}
                    enrollmentStatus={student.enrollment_status ?? 'N/A'}
                    relationship={sg.relationship}
                  />
                  <a
                    href={`/dashboard/notas/boletin/${student.id}`}
                    className="inline-block ml-1 text-xs font-semibold text-primary dark:text-accent-light hover:underline"
                  >
                    📋 Ver boletín de calificaciones
                  </a>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              No hay estudiantes vinculados a tu cuenta.<br />
              Contacta a la secretaría del colegio.
            </p>
          </div>
        )}
      </div>

      {/* Actualizaciones con foto del día a día -- estilo Seesaw */}
      {classUpdates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Así estuvieron hoy
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {classUpdates.map((u) => (
              <div key={u.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="aspect-square bg-slate-100 dark:bg-slate-800">
                  {u.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photoUrl} alt={u.caption ?? ''} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-bold text-primary dark:text-accent-light truncate">{u.targetLabel}</p>
                  {u.caption && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">{u.caption}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mensajería directa con el colegio -- un humano responde, no la IA */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Mensajes
        </h2>
        <DirectMessagesWidget />
      </div>

      {/* Asistente de IA -- "un solo cerebro, dos salidas" (ver AGENTS.md) */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Asistente
        </h2>
        <FamilyChatWidget />
        <VoiceCallWidget />
      </div>

      {school?.whatsapp_active && school.whatsapp_phone_number && (
        <FloatingWhatsAppButton
          phoneNumber={school.whatsapp_phone_number}
          message="Hola, tengo una pregunta"
        />
      )}
    </div>
  )
}
