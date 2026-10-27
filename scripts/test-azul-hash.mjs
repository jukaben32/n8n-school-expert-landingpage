#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba de las firmas (AuthHash) de la Página de Pago AZUL contra los
 * ejemplos OFICIALES de Azul -- con resultado conocido, no inventados:
 *   - Envío: "Ejemplo Calculo Hash SALE" (enviado por Azul, 2026-10-26).
 *   - Respuesta: cadena de ejemplo del "Documento técnico - Página de Pago
 *     AZUL 2026", pág. 35.
 *
 *   AZUL_TEST_AUTHKEY=<llave de prueba de Azul> node --experimental-strip-types scripts/test-azul-hash.mjs
 *
 * La llave de PRUEBA está en el correo de Azul con los accesos de prueba
 * (comercio 39038540035); no se guarda en el repo. Si alguien toca la
 * codificación de las firmas, esto dice si se rompió -- tsc/lint/build no
 * se enteran. Antes de este archivo la firma usaba la llave en UTF-16LE y
 * NO coincidía con ninguno de los dos ejemplos.
 */
import { computeRequestAuthHash, toAzulAmount, verifyResponseAuthHash } from '../web/src/lib/payments/azulHash.ts'

const KEY = process.env.AZUL_TEST_AUTHKEY
if (!KEY) {
  console.error('Falta AZUL_TEST_AUTHKEY (la llave de PRUEBA del correo de Azul).')
  process.exit(2)
}

let fallos = 0
const check = (etiqueta, real, esperado) => {
  const ok = real === esperado
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${etiqueta} -> ${real}${ok ? '' : `  (esperado: ${esperado})`}`)
}

console.log('== Montos (mínimo 3 dígitos, como exige Azul) ==')
check('ITBIS cero', toAzulAmount(0), '000')
check('RD$0.50', toAzulAmount(0.5), '050')
check('RD$1.00', toAzulAmount(1), '100')
check('RD$100.00', toAzulAmount(100), '10000')
check('RD$17,483.21', toAzulAmount(17483.21), '1748321')

console.log('\n== Firma de envío: ejemplo oficial "Calculo Hash SALE" ==')
check('AuthHash del ejemplo', computeRequestAuthHash({
  merchantId: '39038540035', merchantName: 'Prueba AZUL', merchantType: 'ECommerce', currencyCode: '$',
  orderNumber: '001', amount: '10000', itbis: '000',
  approvedUrl: 'https://google.com', declinedUrl: 'https://google.com', cancelUrl: 'https://google.com',
  authKey: KEY,
}), '6662f1e52260cf845a848845e6769ece7ef173c2809ea215f1fc8907442a21f395bdfbb8422eb4d6ce8673eb6961beb730d97842e8030668516beba717ffff5b')

console.log('\n== Firma de respuesta: ejemplo del documento técnico (pág. 35) ==')
const respuesta = {
  orderNumber: '20240313102037', amount: '1500', authorizationCode: 'OK0190', dateTime: '20240313102158',
  responseCode: 'ISO8583', isoCode: '00', responseMessage: 'APROBADA', errorDescription: '',
  rrn: '2024031310220044297821', authKey: KEY,
}
const firmaOficial = '0c74518efef3b144d4f845b2a346d11eb31acfe6276e1b42ceb131609d011589836f18fd3a36077d60c8f68cfc888f59b29129df65c3dfdf8b6295344bf468fe'
check('acepta la firma auténtica', verifyResponseAuthHash(respuesta, firmaOficial), true)
check('acepta la firma en mayúsculas', verifyResponseAuthHash(respuesta, firmaOficial.toUpperCase()), true)
check('rechaza si cambian el monto', verifyResponseAuthHash({ ...respuesta, amount: '150000' }, firmaOficial), false)
check('rechaza si cambian IsoCode', verifyResponseAuthHash({ ...respuesta, isoCode: '05' }, firmaOficial), false)
check('rechaza firma vacía', verifyResponseAuthHash(respuesta, ''), false)
check('rechaza firma inventada', verifyResponseAuthHash(respuesta, 'a'.repeat(128)), false)

console.log(fallos === 0 ? '\nTodas las comprobaciones OK' : `\n${fallos} comprobaciones FALLARON`)
process.exit(fallos === 0 ? 0 : 1)
