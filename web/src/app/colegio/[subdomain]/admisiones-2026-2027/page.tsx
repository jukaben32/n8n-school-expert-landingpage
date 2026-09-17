import { redirect } from 'next/navigation'

// Esta página vivió aquí como una campaña aparte. El colegio pidió que todo
// el contenido de Admisiones 2026-2027 viva en /colegio/[subdomain] (la
// misma página que ya se configura desde Configuración → Sitio Web), no en
// una URL separada. Se deja este redirect -- no se borra la ruta -- porque
// el enlace ya se compartió en un comunicado real a las familias.
export default async function AdmisionesRedirect({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  redirect(`/colegio/${subdomain}`)
}
