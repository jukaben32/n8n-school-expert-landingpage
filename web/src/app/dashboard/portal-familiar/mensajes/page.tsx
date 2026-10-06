import Link from 'next/link'
import DirectMessagesWidget from '@/components/portal/DirectMessagesWidget'

export const metadata = { title: 'Mensajes — MentorIApp' }

export default function FamilyMessagesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/portal-familiar" className="text-sm text-dash-accent hover:underline">← Portal Familiar</Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow">Mensajes</h1>
        <p className="text-sm text-slate-500 mt-1">Escríbele al profesor o al colegio. Elige la pestaña: Regular, Inglés o Deporte.</p>
      </div>
      <DirectMessagesWidget />
    </div>
  )
}
