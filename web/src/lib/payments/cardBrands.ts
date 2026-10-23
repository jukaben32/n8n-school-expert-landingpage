import { schoolHasAzulConfigured } from '@/lib/payments/azul'

/**
 * Colegios que están en pleno proceso de afiliación con Azul. Azul exige
 * ver en el sitio los logos de las marcas, el sello 3D Secure y las
 * políticas ANTES de entregar las credenciales -- así que no se puede
 * esperar a que schoolHasAzulConfigured() sea true para mostrarlos.
 * Cuando el colegio cargue sus credenciales, sale de esta lista sin
 * cambiar nada más (la segunda condición lo cubre).
 */
const AZUL_AFILIACION_EN_CURSO = ['gran-manantial-de-sabiduria']

/** ¿El sitio de este colegio debe mostrar Visa/Mastercard y 3D Secure? */
export async function schoolShowsCardBrands(schoolId: string, subdomain: string): Promise<boolean> {
  if (AZUL_AFILIACION_EN_CURSO.includes(subdomain)) return true
  return schoolHasAzulConfigured(schoolId)
}
