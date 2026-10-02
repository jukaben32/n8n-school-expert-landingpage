# Acceso familiar manual — 2026-10-01

El colegio reportó que dos padres entraron y luego el acceso dejó de funcionar.
No se dispone del error exacto ni de acceso a los registros de producción de
este proyecto; la causa concreta del incidente sigue sin confirmar.

## Hallazgos comprobados en el código

- El cupo anterior era de cinco **códigos generados** por colegio en una ventana
  móvil de 24 horas, no de cinco padres que hayan iniciado sesión. Los reintentos
  y los códigos del flujo automático también cuentan en la tabla compartida.
  Es posible agotar ese cupo habiendo atendido solamente dos familias.
- La verificación consumía el código antes de preparar el enlace de sesión y
  no restauraba el código si Supabase Auth fallaba.
- La actualización de consumo no comprobaba errores ni reclamaba el código
  de forma condicional; peticiones simultáneas podían preparar dos enlaces.
- Los formularios no recuperaban el estado de carga ante excepciones de red.
- La creación del código escribía primero `pending` y después el hash. Una falla
  en el segundo paso dejaba un código inutilizable que ocupaba un cupo.
- El mensaje manual llevaba a un formulario que inicialmente solicitaba envío
  automático de WhatsApp; el padre debía encontrar "Ya tengo un codigo".

## Corrección

- Cupo de **20 códigos por colegio en las últimas 24 horas**. La interfaz explica
  cómo se cuenta y muestra los cupos restantes al generar cada código.
- El hash definitivo y el UUID se escriben en una sola inserción, compatible
  con la tabla existente.
- Reserva condicional del código antes de solicitar el enlace. Si Auth devuelve
  un error o lanza una excepción, se libera esa reserva para permitir reintentar
  el mismo código. Si la escritura de reserva falla, no se entrega un token.
- Recuperación de carga y errores visibles en los dos formularios; copiar el
  mensaje también informa cuando el navegador no permite usar el portapapeles.
- Los nuevos mensajes usan `/acceso-familiar?modo=manual`, que muestra desde el
  inicio los campos de celular y código. La URL sin parámetro conserva su flujo.
- Registros de fallas por etapa, sin teléfonos, códigos, correos ni tokens.
- Se conservan el código de seis dígitos, la vigencia de 24 horas, los cinco
  intentos, los roles autorizados y las validaciones del tutor/colegio/hijos.

No hay migración SQL ni cambios de políticas RLS, tablas, permisos, pagos o
Academia. No se envían mensajes automáticos desde el modo manual.

## Validación y límites

`node scripts/regression-family-access.mjs` ejecuta 22 pruebas sobre las acciones
TypeScript y los manejadores reales, con un adaptador Supabase en memoria.
Comprueba los códigos 20 y 21, autorización, colegio ajeno, duplicados, hijos,
errores de cuota y red, hash, vencimiento, bloqueo de intentos, reutilización,
concurrencia, recuperación ante falla de Auth y navegación del padre.
Estas pruebas no sustituyen una prueba con cuentas reales en producción.

TypeScript y ESLint de los ocho archivos de aplicación modificados pasan.
El build completo de Next.js 16.2.10 pasa. Por las restricciones locales para
crear subprocesos, se habilitaron temporalmente `workerThreads`/dos CPUs y
`typeRoots` local durante el build; ambas configuraciones se restauraron.
El build usó valores públicos de prueba y no credenciales de producción;
el sitemap informó la falta de service-role y el build terminó con código 0.

La comprobación de cuota conserva el mecanismo existente de contar y después
insertar: dos operadores concurrentes cerca del límite pueden exceder el cupo.
Hacer ese cupo transaccional requeriría una función SQL y una migración; no se
introduce una migración sin acceso al proyecto para aplicarla y verificarla.

Una falla del navegador después de obtener el token, o la terminación abrupta
del servidor después de reservar el código, puede requerir un código nuevo.
La reserva recupera las fallas de Auth que el servidor puede capturar.

El protocolo de `AGENTS.md` exige build completo y `scripts/smoke-roles.mjs`
contra producción antes del despliegue. El smoke estaba pendiente al preparar el PR por falta de acceso al proyecto.
La validación posterior que sigue registra las pruebas reales realizadas.


## Pruebas reales y captura del acceso familiar (2026-10-01, Caracas)

Después de publicar e317d43 se obtuvo acceso temporal autorizado a Supabase.
`scripts/smoke-roles.mjs` completó 59 comprobaciones reales, todas OK, incluida
Academia familiar. La prueba de escritura real como service_role insertó un
reto de prueba dentro de una transacción, verificó reserva condicional,
rechazo de segunda reserva, liberación y reintento, y terminó en ROLLBACK.
La consulta posterior confirmó cero registros de prueba restantes. No se
crearon cuentas Auth ni se enviaron mensajes durante estas pruebas.

La tabla family_phone_access_codes tenía cero registros al investigar; no hay
evidencia de que el cupo anterior explique el incidente. Los bundles públicos
de educacionmanantial.com y del dominio Vercel apuntan a fssjgpqisfnmnkavsyld.
La captura aportada por el usuario muestra el error "El WhatsApp del colegio
todavia no esta disponible para enviar codigos" junto al botón de envío
automático: corresponde a requestFamilyAccessCode, que rechaza antes de
crear el código cuando WhatsApp no está conectado/habilitado. Ese error es
del flujo automático, no del límite manual ni de verificar un código.

En modo manual Secretaría genera y envía el código; el padre usa
/acceso-familiar?modo=manual. En enlaces antiguos puede pulsar "Ya tengo un
codigo". Las pruebas de roles y de SQL ya están verificadas; no equivalen a
un login completo desde un dispositivo real del padre ni confirman por sí
solas los otros fallos que el colegio pudo haber experimentado. El token de
acceso no se conserva en archivos ni en el repositorio.
