'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Pantalla para una cuenta de Auth que NO tiene fila en `users_profiles`.
 *
 * Antes, `dashboard/layout.tsx` y `dashboard/page.tsx` resolvían el rol con
 * `profile?.role ?? 'guardian'`: cualquier cuenta sin perfil entraba como
 * TUTOR y aterrizaba en el Portal Familiar, con el menú de familia y sin
 * ningún dato -- aunque la persona fuera docente. No daba ningún error, así
 * que ni ella ni el colegio podían saber qué había pasado.
 *
 * Fue exactamente lo que le pasó a una docente el 2026-09-15 (reportado por
 * el colegio): tenía su cuenta de docente correcta, pero entró con OTRA
 * cuenta suya que había quedado huérfana de una invitación anterior, y la
 * app la mandó al portal de familia sin decir nada. Ese día había 10 cuentas
 * huérfanas en producción y 4 ya habían iniciado sesión.
 *
 * El correo se muestra a propósito: es el único dato que le permite al
 * colegio saber con CUÁL de sus cuentas entró la persona.
 */
export default function UnlinkedAccountNotice({ email }: { email: string }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-8 text-center">
        <p className="text-4xl mb-4" aria-hidden="true">🔑</p>
        <h1 className="text-xl font-bold font-barlow text-slate-900">
          Esta cuenta todavía no está vinculada
        </h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Entraste con <strong className="font-semibold text-slate-900">{email}</strong>, pero ese
          correo no está asociado a ninguna ficha del colegio, así que no podemos saber si eres
          personal, tutor o estudiante.
        </p>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Casi siempre es porque tienes más de un correo y este no es con el que el colegio te dio
          acceso. Prueba a cerrar sesión y entrar con el otro; si no funciona, muéstrale este correo
          a la dirección del colegio para que vincule tu cuenta.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary text-white text-sm font-semibold px-6 py-3 hover:opacity-90 transition"
        >
          Cerrar sesión y entrar con otro correo
        </button>
      </div>
    </div>
  )
}
