# SchoolOS — Contexto del proyecto (léeme primero)

Este archivo existe porque el trabajo en este proyecto se hizo en una conversación
larga de Claude (claude.ai), y no hay forma automática de trasladar esa memoria a
otra herramienta (como Claude Code). Este documento es el resumen fiel de esa
conversación — decisiones, bugs reales encontrados, y lo que falta — para que
cualquier sesión nueva pueda seguir sin repetir descubrimientos ni preguntas.

**Mantenlo actualizado.** Cuando cierres un pendiente de la lista de abajo, o
encuentres un bug nuevo digno de recordar, actualiza este archivo en el mismo
commit.

## Qué es esto

Una plataforma multi-colegio ("SaaS" para colegios afiliados) construida sobre
Next.js 16 (App Router) + Supabase (Postgres + Auth + RLS). El nombre del
proyecto ("SchoolOS", repo `n8n-school-expert-landingpage`) está pendiente de
cambiar — ver "Pendientes" abajo. El repo también contiene, en la raíz, un
`index.html` estático de una propuesta comercial anterior (con menciones a
WhatsApp/n8n) que **no es** el producto real — el producto real vive en `web/`.

Colegio piloto: "Gran Manantial de Sabiduría" (primer cliente/afiliado).

## Estructura

- `web/` — la app Next.js real (todo el desarrollo activo pasa aquí)
- `supabase/migrations/` — todas las migraciones SQL, en orden cronológico por
  nombre de archivo. **Cada migración nueva debe ser idempotente**
  (`drop policy if exists` antes de cada `create policy`) — aprendido a la mala
  tras varios reintentos fallidos de `supabase db push`.
- `index.html`, `sw.js`, etc. en la raíz — legado de la landing vieja, no tocar
  salvo para limpieza futura (ver nota del service worker abajo).

## Arquitectura de seguridad (RLS multi-tenant)

- Cada tabla tiene `school_id` y políticas RLS que filtran por el colegio del
  usuario autenticado (`auth.uid()` → `users_profiles.school_id`).
- `is_super_admin()` (función `security definer`) da bypass total a cualquier
  tabla para el rol `super_admin` — una policy adicional por tabla, no
  reemplaza las existentes (las políticas permisivas se combinan con OR).
- **`src/lib/permissions.ts`** es la única fuente de verdad de qué rol ve qué
  módulo en la interfaz. Desde la migración `20260714000000_rls_role_specific`,
  las políticas de RLS de la base de datos están alineadas con esta misma
  matriz (antes solo era una restricción de interfaz).
- **`src/lib/activeSchool.ts`** resuelve el "colegio activo" de la sesión: para
  todos los roles es su propio `school_id`, pero un `super_admin` puede
  "Entrar como director" de otro colegio (cookie httpOnly), y todas las páginas
  de staff deben usar `schoolId` de `getActiveSchool()`, no `profile.school_id`
  directo — si no, romperías la función de "entrar como director".

## Roles

`super_admin` (toda la plataforma) → `director`/`school_admin` (un colegio
completo) → `teacher`/`finance`/`reception` (acceso acotado, ver
`permissions.ts`) → `guardian`/`student` (portal propio, sin acceso a
`/dashboard/*` de staff).

## Módulos construidos (todos reales, no mockups)

Estudiantes, Familias, Personal (con ficha profesional + invitación de acceso
real vía `admin.inviteUserByEmail`), Tesorería (facturación con NCF automático
+ cobros), Comunicados, Asistencia, Academia (video-lecciones + cuestionarios +
gamificación: puntos/racha/insignias vía trigger), Reportes, Plataforma
(multi-colegio, resumen agregado de red, leads con CRM básico), Configuración
del colegio (landing pública por colegio en `/colegio/[subdomain]`,
exportación de datos).

## Bugs reales encontrados esta sesión (para no repetirlos)

1. **Recursión infinita de RLS** — una policy de `users_profiles` que consulta
   la misma tabla `users_profiles` rompe TODO select sobre ella (Postgres lo
   detecta como recursión). Rompía el login para todos los roles. Fix:
   funciones `security definer` (`auth_profile_school_id()`,
   `auth_profile_role()`) que evitan la auto-referencia.
2. **`schools.subdomain` nunca existió** en ninguna migración, pero el código
   (Plataforma, alta de colegio) asumía que sí — el error quedaba tragado en
   silencio hasta que se agregó manejo de errores explícito.
3. **Service worker atascado** de la landing vieja (`sw.js` en la raíz,
   estrategia "caché primero") deja el navegador de cualquier visitante previo
   sirviendo la versión vieja para siempre, ignorando `Ctrl+Shift+R`. Se
   desplegó un `sw.js` "de reemplazo" en `web/public/` que se autodestruye.
4. **Políticas de RLS duplicadas** de una migración anterior a este trabajo
   (`20260702210000_security_api_grants.sql`) con nombres distintos pero el
   mismo efecto amplio — como las políticas permisivas se suman (OR), hubieran
   seguido dando acceso amplio aunque se crearan reglas más estrictas encima.
   Hubo que localizarlas y eliminarlas explícitamente.
5. **Docker no está disponible** en el entorno de desarrollo de Windows del
   usuario — cualquier solución que dependa de Edge Functions requiere
   Docker para `supabase functions deploy`/desarrollo local. Por eso el correo
   automático de leads usa `pg_net` desde un trigger de Postgres directamente
   (llamando a la API de Resend), no una Edge Function.
6. **Mensajes de commit con backticks** (`` `algo` ``) se corrompen si el
   wrapper de shell los interpreta como sustitución de comandos — evitar
   backticks en mensajes de `git commit -m`.
7. **`net.http_post()` espera `body` como `jsonb`, no `text`** — la
   migración 013 (correo de leads) convertía el body a texto (`::text`)
   antes de pasarlo a `pg_net`, lo que hacía fallar la llamada con
   `function net.http_post(...) does not exist` (el insert en `leads`
   sí funcionaba; el error saltaba en el trigger de correo). Fix en la
   migración 017: quitar el `::text`, dejar el body como jsonb.
   **Sospecha sin confirmar:** el trigger de asistencia
   (`20260702100000_attendance_webhook_trigger.sql`) usa el mismo
   patrón con `::text` y probablemente tenga el mismo bug latente —
   nunca se ha probado un webhook de asistencia disparándose de
   verdad en esta sesión. Revisar si algún día se activa esa
   integración.
8. **Recursión infinita de RLS entre `students` y `student_guardians`**
   — diagnosticado por Claude Code con evidencia real (llamada REST
   directa con JWT de una usuaria de producción): `HTTP 500`, código
   Postgres `42P17 infinite recursion detected in policy for relation
   students`. Causa: `students_read` (migración 001) consulta
   `student_guardians` para el caso "soy guardian de este
   estudiante"; las políticas de `student_guardians` (migración 014)
   consultan de vuelta a `students`. Ciclo A→B→A, mismo patrón que el
   bug de `users_profiles` de la migración 009. El paso 3 del alta de
   estudiante (`students.insert().select()`) disparaba el ciclo y
   fallaba siempre, así que el paso 4 (vincular al tutor) nunca se
   alcanzaba. Fix en la migración 018: función `student_school_id()`
   `security definer` que resuelve el colegio del estudiante sin
   volver a pasar por las policies de `students`, rompiendo el ciclo.
9. **Modo "Familia existente" en el alta de estudiante nunca vinculaba
   al tutor** — a diferencia del bug anterior, este no era
   intermitente: al código simplemente le faltaba el paso de insertar
   en `student_guardians` en esa rama del formulario (sí lo hacía en
   el modo "Familia nueva"). Corregido en el mismo commit: vincula
   automáticamente con el tutor principal (`is_primary = true`) de la
   familia elegida.
10. **Los errores de Postgrest no son instancias de `Error`** — el
    manejo de errores en varios formularios (`NewStudentForm.tsx` era
    uno) hacía `err instanceof Error ? err.message : 'mensaje
    genérico'`, y como los errores que devuelve Supabase son objetos
    planos (`{ message, code, ... }`), esa comprobación siempre caía
    al mensaje genérico -- ocultando el error real exactamente en los
    casos donde más hacía falta verlo. Revisar este patrón si aparece
    en otros formularios que aún no se hayan auditado.

11. **Auditoría completa de errores silenciados en las 27 páginas del
    dashboard** — el patrón "la consulta ignora `error` y lo trata
    igual que lista vacía" (encontrado antes en Plataforma) resultó
    ser sistémico, no aislado: estaba presente en prácticamente todas
    las páginas de `web/src/app/dashboard/**/page.tsx`. Se creó
    `src/components/dashboard/QueryErrorBanner.tsx` (componente
    reutilizable) y se aplicó en todas -- cada consulta ahora captura
    su `error` y lo muestra en una caja roja visible si falla, en vez
    de fallar en silencio disfrazado de "no hay datos". La consulta al
    propio perfil (`profileError`, presente en las 27) se registra en
    consola en vez de mostrar banner, ya que un fallo ahí normalmente
    ya redirige a `/login` por los checks de `!profile` existentes.
    Nota de proceso: la corrección automatizada (script) introdujo 3
    bugs propios en el camino, todos detectados por `tsc` y corregidos
    antes de subir: JSX con dos elementos raíz en
    `academia/[id]/page.tsx` (el `return` de esa página es un solo
    componente, no un `<div>` contenedor), una variable declarada
    dentro de un bloque `if` y usada fuera de su alcance en
    `pagos/page.tsx`, y un banner insertado en un `return` temprano de
    `academia/page.tsx` que ocurre *antes* de que esas variables
    existan. Ninguno de los tres llegó a subirse sin corregir --
    quedan como recordatorio de que una corrección automatizada a
    escala todavía necesita revisión con el compilador antes de
    confiar en ella.

12. **Confirmado (ya no era sospecha): el trigger de asistencia tenía
    el mismo bug de tipo de `pg_net`** que el de leads (`::text` en
    vez de `jsonb` en el parámetro `body`) — y era más grave de lo
    que sugería la sospecha original. El trigger es `AFTER INSERT`
    sin manejo de excepción, así que el error de `pg_net`
    (`function net.http_post(...) does not exist`, 42883) revertía el
    **INSERT completo** de la tabla `attendance`. No era "el aviso
    falla en silencio" -- era imposible registrar una ausencia o
    tardanza en el sistema, punto. Confirmado con 3 inserts de prueba
    reales (revertidos con `ROLLBACK`) antes y después del fix.
    Corregido en la migración 019, mismo patrón que la 015 (leads).
13. **Invitar personal dejaba usuarios huérfanos** (`web/src/app/dashboard/personal/actions.ts`,
    `inviteStaffAccess`): `inviteUserByEmail` corría con el cliente
    `admin` (service_role), pero el `insert` en `users_profiles` que
    venía justo después usaba el cliente de sesión del invitador. Como
    `users_profiles` **nunca ha tenido una policy de INSERT** (ni en la
    migración 016 ni en ninguna otra -- solo tiene `own_read`,
    `own_update` y `staff_read`), Postgres lo denegaba por defecto para
    cualquier rol sujeto a RLS: el usuario de Auth quedaba creado, con
    credenciales, pero sin perfil -- sin rol, sin `school_id`, la app no
    sabía quién era. Fix: mover el insert al cliente `admin` también
    (misma llamada server-side ya usada para la invitación), y mover
    TODA la autorización que antes recaía en RLS al propio Server
    Action -- permiso sobre el módulo `personal`, jerarquía de rol (el
    invitador no puede otorgar un rol de más peso que el suyo, tabla
    `ROLE_RANK`), `school_id` resuelto en servidor (nunca de un
    parámetro), `staff_id` verificado contra ese mismo colegio. Si el
    insert del perfil falla tras crear la cuenta de Auth, se revierte
    con `deleteUser` (nunca si la cuenta ya existía de antes); si el
    propio rollback falla, queda registrado en `audit_logs` (tabla ya
    existente, sin uso hasta ahora) además de en consola, para no dejar
    un huérfano real sin rastro. **No se agregó ninguna policy de
    INSERT a `users_profiles` -- su ausencia es intencional**, la única
    vía de creación válida es este Server Action.
    Verificado end-to-end contra producción: se reinvitó a la cuenta
    huérfana real (`anthonia24.04@gmail.com`, borrada primero) con el
    flujo corregido, y una segunda invitación de prueba completa
    (`role: reception`) confirmó `users_profiles` creado con
    `school_id`/`staff_id`/`role` correctos, y control de acceso real
    -- el usuario invitado pudo entrar y ver Asistencia (permitido para
    `reception`) pero fue redirigido fuera de Tesorería y Personal (no
    permitidos), exactamente según `permissions.ts`. Ambas pruebas se
    hicieron con acceso directo a Supabase (Management API con un PAT
    de un solo uso) porque el conector MCP de esta sesión seguía
    apuntando al proyecto vacío equivocado (mismo problema documentado
    más abajo en la sección de OCR) -- verificado de nuevo con
    `list_projects` antes de confiar en cualquier herramienta MCP de
    Supabase.
14. **Los correos de invitación de personal (`admin.inviteUserByEmail`)
    no llegaron durante la verificación de esta sesión**, a diferencia
    de los correos de enlace mágico y de recuperación de contraseña
    (`resetPasswordForEmail`), que sí llegaron con normalidad segundos
    después de dispararse, en la misma sesión y con el mismo remitente
    (`demo@mail.resendcegmas.com` vía Resend). No se pudo confirmar la
    causa exacta -- no había una API key de Resend disponible para
    revisar sus logs de entrega, y `audit_log_disable_postgres: true`
    en la configuración de Auth del proyecto deja vacía
    `auth.audit_log_entries`, así que tampoco sirvió como rastro. Dato
    encontrado que vale la pena revisar aunque no se pudo confirmar
    como causa: `rate_limit_email_sent` está en `2` (correos por hora)
    en la configuración de Auth del proyecto -- un límite muy bajo para
    dar de alta a todo un equipo de colegio en una sola sesión, y un
    límite que Supabase aplica del lado de su propio auth server
    **incluso con SMTP personalizado (Resend) configurado** -- no lo
    desactiva. Para completar la verificación de este bug sin esperar
    el correo real, se confirmó el email de la cuenta de prueba
    directamente vía `admin.updateUserById({ email_confirm: true })`
    (equivalente a lo que haría el clic en el enlace del correo).
    **Pendiente**: conseguir acceso a los logs de Resend (o subir
    `rate_limit_email_sent` a un valor razonable) para confirmar si
    esto también afecta invitaciones reales del colegio piloto.

## Descuento por hermanos (Tesorería)

**Regla de negocio** (confirmada con el usuario, no asumida): una familia con
3 o más hijos con `enrollment_status = 'inscrito'` recibe un descuento **a
partir del 3er hijo** — el 1ro y 2do (los mayores) pagan precio completo; el
3ro en adelante recibe el descuento. El "orden" del hijo se calcula por fecha
de nacimiento (`birth_date` ascendente), contando solo hermanos inscritos.
Descuento por defecto: **10%**.

**Configurabilidad**: por colegio (no fijo en código ni global de
plataforma), en dos columnas nuevas de `schools`:
`sibling_discount_min_children` (a partir de qué hijo, default `3`) y
`sibling_discount_percent` (default `10.00`). Se editan desde
`/dashboard/colegio` (`SchoolConfigForm.tsx`).

**Implementación**:
- `supabase/migrations/20260718000000_sibling_discount.sql`: las dos
  columnas en `schools`; `discount_percent`/`discount_amount` en `invoices`;
  función `calculate_sibling_discount(p_student_id uuid)` (`SECURITY
  INVOKER`, respeta RLS) que calcula el rank del estudiante entre sus
  hermanos inscritos y si califica.
- `NewInvoiceForm.tsx`: al elegir un estudiante puntual (no "toda la
  familia"), llama al RPC y muestra el resultado de forma explícita antes de
  guardar — línea de "Descuento por hermanos (X%)" en el resumen de
  totales, restándose del monto base antes de calcular el ITBIS. El
  descuento NO aplica a facturas de "toda la familia".

**Verificación real**: familia de prueba con 3 hijos inscritos (fechas de
nacimiento distintas, borrada al terminar). El RPC devolvió el rank
correcto y `qualifies=false/false/true`. Se generaron 2 facturas reales
(hijo 1 y hijo 3, mismo monto base RD$5,000): hijo 1 → total sin cambios;
hijo 3 → 10% de descuento, total RD$4,500.

## Asistente de IA (Portal Familiar) — "un solo cerebro, dos salidas"

**Fase 1 — Widget interno (construido y verificado):**
- `web/src/lib/ai/answerFamilyQuestion.ts`: núcleo reutilizable, sin
  dependencia de cookies/sesión de Next.js — recibe la identidad ya
  resuelta (`schoolId`/`familyId`/`guardianId`) y un mensaje. Usa
  siempre el cliente `service_role` (nunca RLS puro) y filtra
  explícitamente por `family_id`/`school_id` en cada consulta —
  defensa en profundidad, para que el mismo código sea igual de
  seguro con sesión (Fase 1) que sin ella (Fase 2, WhatsApp).
- Modelo: `claude-haiku-4-5-20251001` (eficiente en costo, suficiente
  para responder sobre datos ya estructurados).
- Límite de uso: 30 preguntas por familia cada 24 horas (ventana
  móvil, no día calendario).
- `ANTHROPIC_API_KEY` — variable server-only, mismo tratamiento que
  `SUPABASE_SERVICE_ROLE_KEY` (nunca en cliente, nunca commiteada).
- Migración `20260719000000_ai_conversations.sql`: tabla
  `ai_conversations` con columna `channel` (`'widget'|'whatsapp'`)
  desde ya, para que la Fase 2 reutilice la misma tabla sin
  migraciones nuevas. RLS: cada guardian lee solo las conversaciones
  de su propia familia; **el personal del colegio no tiene ninguna
  política de lectura sobre esta tabla, ni siquiera director** —
  decisión de producto explícita (son conversaciones privadas de la
  familia con el asistente).
- `web/src/app/dashboard/portal-familiar/actions.ts`: único lugar de
  la Fase 1 que resuelve la sesión (Server Actions
  `sendFamilyChatMessage`/`getFamilyChatHistory`), delega en el
  núcleo ya con la identidad resuelta.
- `FamilyChatWidget.tsx`: chat embebido en Portal Familiar.

**Fase 2 — WhatsApp/Twilio (documentado, NO construido):** un futuro
endpoint (route handler) recibiría los mensajes entrantes de Twilio,
resolvería `teléfono → guardian_id → family_id` explícitamente (sin
sesión de Supabase, ya que WhatsApp no tiene JWT), y llamaría al
mismo `answerFamilyQuestion()` con `channel: 'whatsapp'` — sin
duplicar lógica de negocio. El usuario decidió empezar la
implementación de WhatsApp vía Twilio (más rápido de activar) mientras
se solicita el acceso real a la API de Meta en paralelo. Pendiente de
construir cuando se priorice.

## "Vercel no muestra la landing nueva" — causa real: `/sw.js` bloqueado por el middleware de auth

**No se asumió la causa** — se verificó con evidencia real antes de tocar nada:

1. `curl` directo a la URL de producción (sin cookies, sin service worker de por
   medio) devolvió `200` con el HTML de la landing **nueva** completo. Esto
   descarta de raíz que el `Root Directory` de Vercel esté mal apuntado o que el
   build esté roto — el servidor sirve el sitio correcto.
2. `curl -D - .../sw.js` → **`307` a `/login?redirect=%2Fsw.js`**, en vez de
   servir el JavaScript de `web/public/sw.js`. Causa: el `matcher` de
   `web/src/proxy.ts` excluía `_next/static`, `favicon.ico`, `icon.*` y
   `manifest.*`, pero **no `sw.js`** — cualquier petición a `/sw.js` sin sesión
   caía en la protección de rutas y se redirigía a `/login`.

**Por qué esto explica el síntoma**: cualquiera con el service worker viejo (de
la landing `n8n-school-expert` original) todavía instalado depende de que su
navegador pueda descargar `/sw.js` como JavaScript válido para detectar la
actualización y activar el "kill switch" (ver `web/public/sw.js`). Como el
middleware devolvía una redirección HTML a `/login` en vez de JS, esa persona
seguía viendo contenido viejo cacheado **para siempre**, sin importar qué tan
bien estuviera desplegado el sitio nuevo del lado del servidor.

**Fix**: se agregó `sw\.js` al negative lookahead del `matcher` en
`web/src/proxy.ts`. Verificado dos veces de forma independiente: primero por
Claude Code contra producción real, y luego reproducido en este entorno con
`next start` local + `curl localhost:.../sw.js` → `200`,
`Content-Type: application/javascript`, contenido real del kill-switch.

**Pendiente**: no hubo acceso al panel/API de Vercel en ninguna de las dos
sesiones que investigaron esto, así que no se confirmó visualmente el
`Root Directory` ni la lista completa de variables de entorno de
`Production` (`ANTHROPIC_API_KEY` en particular, agregada recientemente para
el asistente de IA -- sin ella el asistente falla en producción aunque la
landing funcione perfecto). Si el usuario sigue viendo contenido viejo
después de este fix, el siguiente paso es repetir la prueba de `/sw.js`
contra la URL real (para confirmar que el fix ya se desplegó) antes de
seguir investigando otras causas.

## Verificación real del asistente de IA — 3 de 4 puntos confirmados, 1 bloqueado por saldo de Anthropic

Se probó el núcleo (`answerFamilyQuestion()`) directamente contra datos reales
(familia "Del Rosario Casilla", `family_id e73dd850-b7ca-4691-bbcc-a0b2330e7601`,
que en realidad tiene **3** estudiantes -- Daury, Darlyn y Moises Feliz --, no 2
como se asumió antes de verificar).

**Bug real encontrado y corregido**: `gatherFamilyContext()` armaba el estado de
matrícula desde un join a `enrollments`, tabla vacía en datos reales -- el
asistente siempre iba a decir "sin matrícula registrada" sin importar el
estudiante. Corregido para leer `students.enrollment_status` directamente
(mismo campo que ya usa `calculate_sibling_discount()`).

**Resultado de la verificación**:
1. ✅ Datos del contexto correctos y coinciden con la base real (nombres,
   fechas, matrícula, facturas, asistencia, comunicados). ⚠️ No se pudo
   confirmar la respuesta final en prosa del modelo: la cuenta de Anthropic no
   tiene saldo (`credit balance is too low`, 400 en las 3 llamadas de prueba).
2. ✅ Aislamiento entre familias confirmado **estructuralmente**, no solo por
   instrucción del prompt: se probó con una familia/estudiante de prueba con
   nombre deliberadamente distintivo, preguntando explícitamente por "otras
   familias" -- ese nombre nunca aparece en el `contextText` armado para la
   familia 1, porque `gatherFamilyContext()` filtra por `family_id` en la
   consulta SQL misma, no depende de que el modelo "se porte bien".
3. ✅ Límite de 30 mensajes/24h confirmado: corta antes de llamar a la API de
   Anthropic (no gasta de más).
4. ⚠️ Registro en `ai_conversations` no confirmado en vivo -- el insert solo
   ocurre tras una respuesta exitosa, y las 3 pruebas fallaron antes de llegar
   ahí por el mismo problema de saldo.

**Pendiente**: recargar crédito en Plans & Billing de la consola de Anthropic
para cerrar los puntos 1 y 4. Datos de prueba (familia temporal, filas
sintéticas) ya fueron borrados -- no quedó nada sucio en producción.

## Nota de voz en el asistente de IA — transcripción con OpenAI

**Proveedor y modelo**: `gpt-4o-mini-transcribe` de OpenAI -- verificado en la
documentación oficial (no de memoria) el mismo día que se construyó. Es el
modelo de transcripción más barato de OpenAI (~$0.003/min), acepta
`webm`/`m4a` directo (los formatos que produce `MediaRecorder` en Chrome y
Safari respectivamente) sin conversión de por medio. Se descartó
reconocimiento de voz nativo del navegador (`SpeechRecognition`) a propósito,
por soporte pobre en iPhone/Safari -- decisión tomada explícitamente con el
usuario antes de construir, dado que buena parte de las familias entra desde
iPhone.

**"Un solo cerebro" aplicado también aquí**: `web/src/lib/ai/transcribeAudio.ts`
sigue el mismo principio que `answerFamilyQuestion.ts` -- recibe bytes de
audio crudos, sin sesión ni Next.js. Reutilizable por una futura Fase 2 de
WhatsApp sin cambios.

**Cómo queda conectado sin duplicar lógica**: `sendFamilyVoiceMessage(formData)`
extrae el audio, llama a `transcribeAudio()`, y con el texto resultante llama
literalmente a `sendFamilyChatMessage()` -- la misma tubería que ya usa el
chat de texto (identidad, límite diario, núcleo). No hay una segunda copia de
esa lógica.

**Control de costo**: además del límite de 30 mensajes/24h ya existente
(las notas de voz cuentan igual), tope de **60 segundos** de grabación
(auto-stop en el cliente) y **10MB** en el servidor como defensa en
profundidad.

**Verificación real, parcial**: no se pudo confirmar la transcripción de un
audio real hablado -- ni `OPENAI_API_KEY` ni `ANTHROPIC_API_KEY` tenían saldo
al momento de construir esto. Sí se confirmó que `transcribeAudio()` arma
correctamente la petición y llega al endpoint real de OpenAI (la respuesta es
el error real de cuota agotada, no un error de conexión/formato), y que la
validación de audio muy corto corta antes de gastar una llamada. **Pendiente**:
repetir la prueba completa con audio real en cuanto cualquiera de las dos
cuentas tenga saldo.

## Quién paga cada servicio (decisión de negocio, no técnica)

**A cargo de la plataforma (una sola cuenta, sirve a todos los colegios)**:
Vercel, Supabase, el dominio de la app + su Resend (correos del sistema:
invitaciones, recuperar contraseña), el dominio/Resend de leads, **y
Anthropic + OpenAI (el asistente de IA)**.

**A cargo de cada colegio (su propio gasto, nunca pasa por la plataforma)**:
la comisión de Azul por transacción de tarjeta (el dinero va directo a la
cuenta bancaria del colegio, así que Azul le cobra a él, no a la
plataforma), y su propio remitente de Resend si algún día lo activan.

**Decisión explícita sobre el costo de IA** (confirmada con el usuario, no
asumida): aunque el costo de Anthropic/OpenAI SÍ crece según cuánto lo usen
las familias de cada colegio (a diferencia de Vercel/Supabase, que cuestan
casi lo mismo con 1 o 50 colegios), se decidió **no** medir ni facturar el
uso de IA por colegio por ahora -- se absorbe dentro de lo que se le cobra
al colegio por usar la plataforma. Esto es consistente con que hoy
`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` son variables de entorno únicas a
nivel de plataforma, no configuración por colegio (no cambiar esto sin
volver a decidirlo explícitamente con el usuario). Revisar esta decisión
cuando haya varios colegios afiliados y la diferencia de uso entre ellos
empiece a importar -- en ese momento, construir medición y facturación por
colegio sería el camino natural (columna de uso acumulado, o límite
configurable por colegio en vez de solo por familia).

## Tutores múltiples, edición de familia y catálogo de puestos ampliado

**Tutores múltiples al crear un estudiante**: `NewStudentForm.tsx` (modo
"Familia nueva") ya no asume un solo tutor -- permite agregar hasta 4
(madre/padre/tutor legal/otro), el primero de la lista queda como tutor
principal (`is_primary`). En modo "Familia existente", el estudiante nuevo
se vincula ahora a **todos** los tutores ya registrados de esa familia
(antes solo al principal) -- si la familia tiene madre y padre, un hermano
nuevo queda ligado a ambos automáticamente.

**Edición de familia**: `/dashboard/familias/[id]/editar` -- edita nombre y
datos de facturación de la familia, y permite editar/agregar/quitar
tutores. Quitar un tutor primero borra sus vínculos en `student_guardians`
(la FK no tiene `ON DELETE CASCADE`) antes de borrar el registro en
`guardians` -- si no se hace en ese orden, la eliminación falla por
restricción de llave foránea.

**Catálogo de puestos de personal ampliado** (migración 022): se agregaron
Seguridad, Conserje, Auxiliar de Cafetería, Auxiliar de Limpieza, Portero,
Secretaria, Secretaria Docente, Ayudante Docente, Administrador y
Psicóloga -- valores en inglés en la base (`security`, `janitor`, etc.,
consistentes con el resto del esquema), etiquetas en español en la
interfaz (`roleLabels` en `personal/page.tsx`).

### Pagos con Azul (por colegio) + Transferencia bancaria con comprobante (2026-07-28) — código completo, migración NO aplicada todavía

**Decisión de arquitectura** (ya venía confirmada por el usuario, no se
cuestionó): el dinero de cada colegio va directo a la cuenta bancaria de ESE
colegio -- nunca a una cuenta centralizada de la plataforma. Cada colegio
afiliado tiene sus propias credenciales de Azul en
`private.school_payment_settings`, resueltas siempre por `school_id`
explícito.

**Investigación del método de integración con Azul** (PDF oficial
"E-commerce AZUL", descargado el 2026-07-28 desde `dev.azul.com.do` --
no de memoria): Azul ofrece dos métodos. Se usó **"Página de Pago AZUL"**
(alojada por Azul), tal como pedía el mandato explícitamente, para evitar
que nuestro servidor toque datos de tarjeta (alcance PCI). El navegador del
cliente hace un `POST` HTML directo (campos `hidden`) a
`https://pagos.azul.com.do/PaymentPage/Default.aspx` (producción) o
`https://pruebas.azul.com.do/PaymentPage/` (pruebas); Azul redirige de
vuelta con el resultado en el querystring.

**Parte A -- Pago con tarjeta**:
- `web/src/lib/payments/azul.ts`: núcleo. `buildAzulPaymentForm()` arma los
  campos del formulario (incluye `AuthHash`, un HMAC-SHA512) y registra la
  transacción en `azul_transactions` (nueva tabla) antes de devolverle el
  formulario al navegador. `processAzulResult()` procesa el redirect de
  vuelta de Azul.
- **Regla de seguridad no negociable del mandato, implementada tal cual**:
  nunca se marca una factura como pagada porque el navegador dice
  "aprobada". `processAzulResult()` SIEMPRE recalcula el `AuthHash` de
  respuesta con el `AuthKey` del colegio (que nunca viaja en la URL, solo
  vive en `private.school_payment_settings`) y lo compara contra el que
  mandó Azul. Si no coincide, se guarda como `status='error'` y NO se toca
  `invoices` ni se inserta en `payments`, sin importar qué diga
  `ResponseCode`. Fórmulas de hash (orden exacto de campos, confirmado en
  el PDF oficial, sección "Manejo de la Autenticación"):
  - Request: `MerchantId+MerchantName+MerchantType+CurrencyCode+OrderNumber+Amount+ITBIS+ApprovedUrl+DeclinedUrl+CancelUrl+UseCustomField1+CustomField1Label+CustomField1Value+UseCustomField2+CustomField2Label+CustomField2Value+AuthKey`, HMAC-SHA512 con `AuthKey` como llave.
  - Response: `OrderNumber+Amount+AuthorizationCode+DateTime+ResponseCode+IsoCode+ResponseMessage+ErrorDescription+RRN+AuthKey`, mismo esquema.
  - Se siguió el encoding UTF-16LE de los ejemplos oficiales en C#/PHP del
    manual (no la nota genérica de "acepta UTF-8 o Unicode indistinto"),
    para no arriesgar un mismatch que no se puede probar en vivo sin
    credenciales reales.
- `web/src/app/api/pagos/azul/resultado/route.ts`: ruta pública (Route
  Handler, no Server Action -- Azul redirige el navegador del cliente, no
  hay sesión de Next.js de por medio) que recibe el callback y llama a
  `processAzulResult()`.
- **Bug encontrado y corregido en el camino** (mismo patrón que el bug de
  `/sw.js` documentado arriba): el matcher de `web/src/proxy.ts` no
  excluía `/api/pagos/azul`, así que si la sesión del navegador estaba
  vencida o las cookies bloqueadas justo al volver de Azul, el middleware
  habría redirigido el callback a `/login` en vez de dejarlo procesar el
  pago -- perdiendo silenciosamente la confirmación de un pago real
  aprobado. Se agregó `/api/pagos/azul` a `publicPrefixRoutes`.
- Botón "Pagar con tarjeta" en `PaymentActions.tsx` (dentro de
  `InvoiceCard.tsx`, Portal Familiar → Pagos): llama a la Server Action
  `startAzulPayment()`, arma un `<form>` oculto en el navegador con los
  campos devueltos, y lo envía por `submit()` -- el servidor nuestro nunca
  ve el número de tarjeta.
- Credenciales por colegio: `web/src/app/dashboard/colegio/AzulSettingsForm.tsx`
  (solo para `configuracion_colegio`, o sea director/school_admin/super_admin).
  El `AuthKey` nunca se devuelve al navegador una vez guardado -- el campo
  siempre aparece vacío, con un indicador "(ya configurada)"; dejarlo en
  blanco al guardar conserva el valor existente.

**Parte B -- Transferencia bancaria con comprobante**:
- Bucket de Supabase Storage `comprobantes-pago`, **privado** (`public: false`).
  A propósito no se agregó ninguna política de RLS sobre `storage.objects`
  para `anon`/`authenticated`: TODO el acceso (subida y lectura) pasa por
  Server Actions con el cliente `service_role`, después de validar el
  permiso explícitamente en TypeScript -- mismo principio de defensa en
  profundidad que `answerFamilyQuestion.ts`, en vez de políticas de RLS
  basadas en parseo de rutas de Storage (más frágiles). Las lecturas usan
  `createSignedUrl()` de corta duración (5 minutos), nunca una URL pública.
- Flujo familia (`web/src/app/dashboard/pagos/actions.ts`,
  `uploadPaymentReceipt()`): sube el archivo (JPG/PNG/WEBP/PDF, máx. 10MB)
  y crea una fila en `payment_receipts` con `status='pendiente'`. Esto
  **nunca** marca la factura como pagada -- solo es la palabra de la
  familia, tal como pedía el mandato.
- Flujo Tesorería (`web/src/app/dashboard/tesoreria/actions.ts` +
  `/dashboard/tesoreria/comprobantes`): el staff ve los comprobantes
  pendientes de su colegio, puede abrir el archivo (signed URL) y
  confirmar o rechazar. Solo al **confirmar** se inserta en `payments` y
  se marca la factura como pagada (si el monto cubre el total, mismo
  criterio que ya usaba `NewPaymentForm.tsx` de Tesorería para pagos
  manuales).
- Permisos (RLS en `payment_receipts`): la familia solo ve/crea los
  comprobantes de su propia familia; el staff de tesorería
  (`super_admin`/`school_admin`/`director`/`finance` -- el mismo set de
  roles que ya puede acceder al módulo `tesoreria` en
  `web/src/lib/permissions.ts`) solo ve/confirma/rechaza los de su propio
  colegio.

**Estado real de la verificación -- ninguna de las dos partes se pudo
probar en vivo todavía**, y hay que ser honesto sobre por qué: la
migración `20260728010000_azul_payments_and_bank_transfers.sql` **no se
pudo aplicar a producción en esta sesión**. Se intentó por dos vías:
1. El conector de Supabase aparece "conectado" a nivel de cuenta
   (`ListConnectors` → `connected: true`) pero no habilitado para este
   chat específico (`enabledInChat: false`) -- se le pidió al usuario dos
   veces habilitarlo (`AskUserQuestion`) sin respuesta.
2. La API de administración de Supabase (`api.supabase.com`) devuelve
   `401` sin un token de acceso, y no hay ninguno disponible en esta
   sesión.

Sin las tablas nuevas en producción, no se pudo probar de punta a punta ni
la Parte A (no hay credenciales reales de Azul cargadas tampoco, ver
mandato: "Gran Manantial de Sabiduría ya tiene cuenta comercial de Azul
con credenciales de API reales" -- pero no se compartieron en esta sesión)
ni la Parte B con un archivo real, como pedía explícitamente el mandato.

**Lo que sí se verificó**: `tsc --noEmit`, `eslint` y `next build` limpios
para los ~15 archivos nuevos/modificados; revisión manual del código de
`azul.ts` contra el orden de campos exacto documentado en el PDF oficial
para ambos hashes (request y response); el fix de `proxy.ts` sigue
compilando y no rompe ninguna ruta pública existente.

**Pendiente para cerrar esta tarea por completo**, en orden:
1. Aplicar `supabase/migrations/20260728010000_azul_payments_and_bank_transfers.sql`
   a producción (requiere acceso a Supabase que esta sesión no tiene).
2. Verificación real de la Parte B con un PDF/imagen de prueba: crear
   familia + factura de prueba, subir un comprobante real, confirmar que
   `payment_receipts` se crea correctamente, que el signed URL de
   Tesorería funciona, que `confirmReceipt()` marca la factura pagada e
   inserta en `payments`, y que `rejectReceipt()` no toca nada de eso --
   luego borrar todos los datos de prueba (mismo estándar de verificación
   que el resto de esta sesión).
3. Verificación de la Parte A: pedir al usuario las credenciales reales de
   Azul de Gran Manantial de Sabiduría (Merchant ID, Merchant Name,
   AuthKey, ambiente) para cargarlas en `/dashboard/colegio`, y hacer una
   transacción de prueba real contra el ambiente de pruebas de Azul
   (`https://pruebas.azul.com.do/PaymentPage/`) para confirmar que el
   `AuthHash` que armamos es aceptado por Azul y que el callback marca la
   factura como pagada de verdad.

## Documento de preguntas frecuentes por colegio (asistente de IA)

Columna `schools.faq_document` (migración 023) -- texto libre editable desde
`/dashboard/colegio` (`SchoolConfigForm.tsx`) con horarios, política de
uniforme, reglas generales, etc. -- todo lo que las familias preguntan
seguido que NO vive en ninguna tabla estructurada. `gatherFamilyContext()`
en `answerFamilyQuestion.ts` lo agrega al contexto de cada conversación,
claramente etiquetado como "política general del colegio, igual para todas
las familias" (distinto de los datos privados de esa familia en particular
que ya arma el resto de la función) -- el system prompt instruye al modelo
a usarlo solo para preguntas generales, no a confundirlo con datos privados.

Costo: al ser texto que se envía en cada mensaje, un documento muy largo
aumenta el costo por respuesta -- se avisa de esto en la propia interfaz de
Configuración del colegio.

## Extracción OCR estructurada con Claude (visión) — fichas de inscripción y facturas de proveedores

**Contexto del mandato**: el colegio piloto tiene fichas físicas de inscripción
ya llenas a mano y clases empiezan en ~2 semanas -- alguien tendría que
teclearlas a mano, estudiante por estudiante. En paralelo se pidió lo mismo
para facturas de proveedores (con sync a Alegra). Un solo núcleo de código
sirve a los dos casos, siguiendo el mismo principio que
`answerFamilyQuestion.ts` ("un solo cerebro"): una función server-only, sin
sesión, reutilizada por ambos.

### Núcleo compartido: `web/src/lib/ocr/extractStructuredDocument.ts`

Recibe un archivo (o varios) + un JSON schema de qué extraer, y devuelve un
array de resultados (uno por documento) usando Claude con visión.

- **Modelo: `claude-sonnet-5`**, no Haiku (a diferencia del asistente de IA).
  Decisión explícita: aquí la precisión importa más que el costo -- estos
  datos alimentan matrícula real y facturas reales, no una conversación.
- **`thinking` deshabilitado** -- es una extracción de un solo turno sobre un
  documento ya dado, no se beneficia de razonamiento extendido, y ahorra
  costo/latencia.
- **Structured outputs** (`output_config.format` con `json_schema`) --
  garantiza JSON válido en vez de parsear texto libre. Cada schema usa
  `anyOf: [{type:'string'},{type:'null'}]` en vez de `type: ['string','null']`
  para los campos opcionales (anyOf está explícitamente documentado como
  soportado; el array de tipos no se pudo confirmar en vivo -- ver
  "Verificación real" abajo).
- **Sigue fetch crudo a la API de Anthropic**, no el SDK oficial -- mismo
  patrón que `answerFamilyQuestion.ts` y `lib/payments/azul.ts`, para no
  introducir una segunda forma de hablar con Anthropic en este proyecto.
- **Dos formas de recibir documentos**:
  1. `{ kind: 'files', documents: [...] }` -- varios archivos sueltos, cada
     uno UN documento independiente (llamadas paralelas, máx. 3 a la vez).
  2. `{ kind: 'multiPagePdf', base64 }` -- un solo PDF multi-página se
     **divide con `pdf-lib`** (JS puro, sin dependencias nativas -- seguro en
     el entorno serverless de Vercel) en N PDFs de una sola página, cada uno
     procesado como documento independiente. Así una página con letra
     ilegible no contamina el resultado de las demás, y cada página tiene su
     propia confianza/error. Se descartó pedirle a Claude que devuelva un
     array cruzando todas las páginas en una sola llamada -- separar la
     llamada por página da mejor precisión y aislamiento de errores.
- **Regla de seguridad no negociable**: esta función NUNCA crea ni aprueba
  nada en la base de datos -- solo devuelve JSON. El registro final siempre
  pasa por una bandeja de revisión humana (ver los dos casos abajo).

### Caso 1: Fichas de inscripción de estudiantes (URGENTE)

- Migración `20260731000000_ocr_document_extraction.sql`: tabla
  `enrollment_form_scans` (RLS: `reception`/`director`/`school_admin`/
  `super_admin`, mismo set que el módulo `estudiantes_nuevo` en
  `permissions.ts` más `reception`), bucket privado `fichas-inscripcion`
  (sin políticas de `storage.objects` -- todo el acceso pasa por Server
  Actions con `service_role`, mismo principio que `comprobantes-pago`).
- La ficha física pide más campos de los que el alta manual capturaba. Se
  reutilizaron columnas jsonb ya existentes (`students.medical_notes`,
  `students.emergency_contact`) y `students.student_code` (matrícula) --
  y se agregaron las que faltaban: `students.birth_place`,
  `students.grade_level` (curso, texto libre, no depende de
  `academic_structure`), y en `guardians`: `national_id` (cédula),
  `address`, `origin_province`, `nationality`.
- **`web/src/lib/students/createStudentWithFamily.ts`**: la lógica de
  creación de estudiante+familia+tutor(es) vivía SOLO dentro de
  `NewStudentForm.tsx` (componente de cliente, llamaba a Supabase
  directamente desde el navegador). Se extrajo a esta función server-side
  compartida, y `NewStudentForm.tsx` se convirtió para llamar a una Server
  Action (`estudiantes/nuevo/actions.ts` → `submitNewStudent`) que a su vez
  llama a esta función -- así el alta manual y la confirmación de fichas
  escaneadas usan exactamente el mismo camino de creación, sin dos caminos
  que puedan divergir (tal como pedía el mandato).
- **`web/src/app/dashboard/estudiantes/escaneos/`**: página + Server Actions
  (`uploadEnrollmentScans`, `listPendingEnrollmentScans`,
  `getEnrollmentScanSignedUrl`, `confirmEnrollmentScan`,
  `rejectEnrollmentScan`) + `EnrollmentScansReview.tsx` (subida en dos modos
  -- archivos sueltos o un PDF multi-página -- y bandeja de revisión donde el
  staff corrige cada campo antes de confirmar). `confirmEnrollmentScan`
  **siempre** llama a `createStudentWithFamily()` con los valores que el
  staff corrigió en pantalla, nunca con `extracted_data` directamente. Modo
  de creación fijo en "familia nueva" (crear estudiante desde una ficha
  escaneada asume un ingreso nuevo, no vincular con familia existente --
  decisión de alcance para no complicar la bandeja con búsqueda de familias).
- Nav: botón "Escanear fichas" en `/dashboard/estudiantes` junto a "Nuevo
  estudiante", nuevo módulo `estudiantes_escaneos` en `permissions.ts`.

### Caso 2: Facturas de proveedores → Alegra

- Migración: tabla `vendor_invoices` (RLS: mismo set de roles que ya tiene
  el módulo `tesoreria` -- `finance`/`director`/`school_admin`/
  `super_admin`), bucket privado `facturas-proveedores`.
- **`web/src/app/dashboard/tesoreria/facturas-proveedores/`**: mismo patrón
  que las fichas (subida en dos modos, bandeja de revisión editable,
  aprobar/rechazar). Al aprobar, se corrigen los campos en pantalla y se
  intenta sincronizar con Alegra.
- **`web/src/lib/accounting/alegra.ts`**: **a propósito queda como stub que
  documenta la llamada pendiente**, no bloquea el resto del flujo (tal como
  pidió el mandato). Un "bill" de Alegra necesita un `contactId` numérico y
  un `categoryId`/`accountId` numérico -- no el RNC ni el texto libre de
  categoría que extrae Claude. El mapeo RNC→contacto y categoría→cuenta
  contable queda pendiente de definir con el usuario. Si `ALEGRA_EMAIL`/
  `ALEGRA_TOKEN` no están configurados, o el mapeo no está resuelto, la
  factura queda **igual aprobada** (`vendor_invoices.status = 'aprobado'`)
  pero con `alegra_sync_status = 'error'` y el mensaje explicando por qué --
  nunca falla en silencio ni bloquea la aprobación.

### Verificación real hecha en esta sesión

1. ✅ **División de PDF multi-página con `pdf-lib`** -- probado con un PDF
   sintético de 4 páginas generado en el momento (sin datos reales): el
   split produjo 4 PDFs independientes, cada uno cargado de vuelta con
   `pdf-lib` y confirmado como un documento de exactamente 1 página. Esta
   es la pieza más nueva/riesgosa del núcleo (nadie en el equipo había usado
   `pdf-lib` antes en este proyecto) y quedó verificada con código real, no
   solo revisada.
2. ⚠️ **Llamada real a Claude (extracción de visión) -- NO probada.** Esta
   sesión no tuvo una `ANTHROPIC_API_KEY` con saldo disponible (mismo
   bloqueo que sesiones anteriores con el asistente de IA). Se revisó
   manualmente que el payload (`document`/`image` content block,
   `output_config.format` con `json_schema`) coincide con la documentación
   oficial de PDF support y structured outputs. **Pendiente**: subir una
   ficha/factura de prueba real en cuanto haya una API key con saldo, y
   confirmar que el JSON devuelto valida contra el schema y que
   `additionalProperties:false` + `anyOf` para campos nulos no rompe la
   validación estricta de Anthropic (no se pudo confirmar en vivo).
3. ⚠️ **Migración SQL -- escrita pero NO aplicada a producción.** Mismo
   patrón que la migración de Azul (ver sección de pagos más abajo): no
   hubo forma de ejecutar DDL contra la base real en esta sesión. Se
   necesita una de estas tres cosas para cerrar esto: la contraseña de
   Postgres (para `psql` directo), un Personal Access Token de la API de
   administración de Supabase, o que el usuario pegue
   `supabase/migrations/20260731000000_ocr_document_extraction.sql` en el
   SQL Editor del panel de Supabase manualmente.
4. **Nota operativa importante, descubierta esta sesión**: el conector MCP
   de Supabase de esta sesión de Claude Code está enlazado a un proyecto
   **vacío y distinto** (`hwrtwylnhhobnharthsx`, "Bcasilla's Project", 0
   tablas) -- NO al proyecto real de SchoolOS. Se confirmó cuál es el
   proyecto real (`fssjgpqisfnmnkavsyld`) con una llamada REST directa
   usando las claves `anon`/`service_role` que el usuario compartió: existe
   el colegio "Gran Manantial de Sabiduría", 4 estudiantes reales, y
   `enrollment_form_scans` efectivamente no existe todavía (confirma que la
   migración de este documento no se aplicó). **Cualquier sesión futura que
   use las herramientas MCP de Supabase debe verificar primero con
   `list_tables` que el proyecto conectado tiene las tablas esperadas
   (`schools`, `students`, etc.) antes de confiar en `apply_migration` --
   si devuelve una lista vacía, es el proyecto equivocado, no una base
   nueva.**
5. ✅ Nunca se crea nada sin pasar por la bandeja de revisión -- confirmado
   por lectura de código: `uploadEnrollmentScans`/`uploadVendorInvoices`
   solo insertan en las tablas de bandeja (`status = 'pendiente'`); la única
   ruta que crea un estudiante es `confirmEnrollmentScan` → 
   `createStudentWithFamily()`, y la única ruta que aprueba una factura es
   `approveVendorInvoice`, ambas requieren una acción explícita del staff
   con el registro ya visible en pantalla.
6. `npx tsc --noEmit`, `npm run lint` y `npm run build` limpios para todos
   los archivos nuevos/modificados (ver Convenciones de trabajo).

**Actualización (misma tarea, sesión siguiente)**: el patch de esta sesión se
aplicó a la rama `claude/credentials-setup-41e2xe` (`git am`, sin conflictos),
con `tsc --noEmit`/`lint`/`build` limpios, y se subió a GitHub. La migración
`20260731000000_ocr_document_extraction.sql` **ya se aplicó a producción**
usando un Personal Access Token de Supabase (`sbp_...`, pegado por el usuario
para este único uso, no guardado en el repo) contra la API de administración
(`POST /v1/projects/{ref}/database/query`) -- el mismo bloqueo que
documentaba el punto 4 de arriba (el conector MCP de Supabase de esta sesión
también apuntaba al proyecto vacío `hwrtwylnhhobnharthsx`, no al real).
Verificado con REST directo tras aplicar: `enrollment_form_scans` y
`vendor_invoices` responden `200` (antes `404`), los buckets
`fichas-inscripcion`/`facturas-proveedores` existen (`public=false`), y las 6
columnas nuevas (`students.birth_place`/`grade_level`,
`guardians.national_id`/`address`/`origin_province`/`nationality`) están en
`information_schema.columns`. También se confirmó en Vercel (proyecto
`n8n-school-expert-landingpage`, Root Directory `web`, como debía ser) que
`ANTHROPIC_API_KEY` y `OPENAI_API_KEY` de producción ya están configuradas
-- no hizo falta tocarlas para esta tarea.

**Pendiente para cerrar esta tarea por completo**, en orden:
1. ~~Aplicar la migración a producción~~ -- hecho y verificado (ver arriba).
2. Verificación real de extracción con Claude: subir una ficha y una
   factura de prueba (ficticias) en cuanto haya `ANTHROPIC_API_KEY` con
   saldo, confirmar que el JSON extraído valida, crear un estudiante de
   prueba de punta a punta y borrarlo.
3. Definir con el usuario el mapeo RNC→contacto y categoría→cuenta contable
   de Alegra para completar `web/src/lib/accounting/alegra.ts`.

## Convenciones de trabajo

- Todo cambio de base de datos es una migración nueva en
  `supabase/migrations/`, nunca editar una migración ya aplicada.
- Verificar siempre antes de dar por terminado: `npx tsc --noEmit`,
  `npm run lint`, y un `npm run build` completo (el sandbox de desarrollo no
  tiene salida a Google Fonts, así que ahí se prueba con un stub temporal de
  fuentes que se revierte antes de commitear — en el entorno real del usuario
  esto no hace falta).
- El despliegue de producción es en Vercel, con el **Root Directory apuntando
  a `web/`** (el proyecto de Vercel original apuntaba a la raíz del repo, que
  sirve el `index.html` viejo — hay que confirmar que esto siga bien
  configurado si algo se ve "viejo" en producción).
- Variables de entorno necesarias (`web/.env.example` tiene la lista):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only, nunca en cliente),
  `NEXT_PUBLIC_SITE_URL`.

## Pendientes (roadmap, en el orden acordado)

1. ~~Control de datos por colegio~~ — hecho (exportación + `/terminos`).
2. ~~Landing dinámica por colegio afiliado~~ — hecho (`/colegio/[subdomain]`).
3. Nombre nuevo para el proyecto (dejado a propósito para el final —
   "SchoolOS" y "n8n-school-expert" ya no encajan con lo que esto es).
4. ~~RLS por rol específico~~ — hecho.
5. ~~Fichas de detalle de estudiante/familia~~ — hecho.
6. **Dominio propio** — el usuario compra dos dominios en Hostinger (uno para
   Resend, uno para la app) el lunes. Pasos pendientes tras la compra:
   conectar el dominio de la app en Vercel, actualizar
   `NEXT_PUBLIC_SITE_URL`, verificar el dominio en Resend y actualizar
   `resend_from_address` en `private.app_settings`, considerar mover también
   el SMTP de Supabase Auth al mismo dominio.
7. **Sistema de comunicación** — Fase 1 (widget interno) construida y
   verificada, Fase 2 (WhatsApp/Twilio) documentada abajo pero sin
   construir todavía.
8. ~~Descuento automático a partir del Nº hijo~~ — resuelto (ver
   sección "Descuento por hermanos" más abajo).
9. ~~Bug de alta de estudiante~~ — resuelto (ver bugs 8, 9 y 10 arriba).
10. **Extracción OCR de fichas de inscripción y facturas de proveedores** —
    código en producción (rama `claude/credentials-setup-41e2xe`) y migración
    ya aplicada y verificada (ver sección "Extracción OCR estructurada con
    Claude" más arriba). Pendiente: probar la llamada real a Claude con una
    ficha/factura de prueba, y definir el mapeo de Alegra.
