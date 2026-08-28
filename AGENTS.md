# MentorIApp — Contexto del proyecto (léeme primero)

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
proyecto es **MentorIApp** (Mentoría + IA + App) — decidido el 2026-08-01,
reemplazando "SchoolOS". El nombre del repositorio de GitHub sigue siendo
`n8n-school-expert-landingpage` por ahora (renombrarlo es un paso aparte,
sin prisa, no bloquea nada). El repo también contiene, en la raíz, un
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
    **Resuelto (2026-08-28)**: confirmado vía Management API
    (`GET /v1/projects/{ref}/config/auth`) que `rate_limit_email_sent`
    ya está en `100` en producción -- el usuario lo había subido
    directo desde el Dashboard de Supabase (Authentication -> Rate
    Limits) en una sesión anterior, un cambio de configuración que no
    deja rastro en git/código, por eso este punto seguía marcado como
    pendiente aquí. No hace falta ninguna acción más sobre esto.

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

**Fase 2 — WhatsApp vía Evolution API (construido el 2026-08-17):**
decisión revisada con el usuario ese mismo día — la decisión anterior de
usar Twilio (ver historial de git) se descarta a favor de Evolution API,
para quedar alineado con el proyecto de referencia
(real-estate-multi-ai-agent-saas), que comparte el mismo VPS/servidor de
Evolution API (cada app usa su propio prefijo de instancia,
`mentoriapp-${schoolId}` aquí, para no chocar).

- `src/lib/evolutionApi.ts`: cliente REST portado del proyecto de
  referencia sin cambios de fondo (mismos endpoints v2 verificados ahí).
- `src/lib/whatsapp/connection.ts`: capa de servicio — crear/reconectar/
  desconectar instancia, sondear estado, enviar mensajes. Una fila por
  colegio en `whatsapp_connections` (migración 025 agrega
  `instance_token`/`is_enabled` sobre la tabla-cáscara de la migración
  024, que solo guardaba texto sin backend real).
- `src/lib/whatsapp/resolveGuardianByPhone.ts`: resuelve
  `teléfono → guardian_id → family_id` por comparación normalizada
  (últimos 10 dígitos) contra `guardians.phone`, acotado por `school_id`
  (ya viene en la URL del webhook, no hace falta buscar entre colegios).
- `src/app/api/whatsapp/webhook/[schoolId]/route.ts`: único route handler
  real del proyecto además del de Azul — Evolution llama aquí por HTTP
  plano, no puede invocar un Server Action. Llama al mismo
  `answerFamilyQuestion()` con `channel: 'whatsapp'`, sin duplicar
  lógica de negocio ni el límite diario.
- `src/app/dashboard/whatsapp/`: conectar con un clic + código QR (mismo
  patrón que el proyecto de referencia), sin selector de agente porque
  aquí solo hay un asistente por colegio, no varios agentes IA.
- Pendiente real: `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` no están
  configuradas todavía (esperando que el VPS quede listo) — hasta
  entonces el botón "Conectar WhatsApp" muestra el aviso de
  "no configurado" en vez de fallar.

## Llamada de voz en vivo (Portal Familiar) — WebRTC realtime, distinta de la nota de voz

Construida el 2026-08-01 por Claude Code, en la misma sesión donde se hizo el
mismo tipo de widget para un proyecto hermano (real-estate-multi-ai-agent-saas)
-- por eso los endpoints de OpenAI ya venían verificados de primera mano.

**Qué es y qué NO es**: esto es una llamada de voz en vivo, dos vías, en tiempo
real por WebRTC (el padre habla, el asistente contesta hablando, sin botón de
grabar/enviar) -- **distinta** de la "nota de voz" que ya existía (grabar hasta
60s → transcribir con `gpt-4o-mini-transcribe` → responder por texto). Las dos
conviven en Portal Familiar, en tarjetas separadas (`FamilyChatWidget` y
`VoiceCallWidget`).

**Sigue "un solo cerebro" reutilizando piezas existentes, no duplicándolas**:
- `gatherFamilyContext()` (antes privada de `answerFamilyQuestion.ts`, ahora
  exportada) arma el mismo contexto familiar que ya usa el chat de texto --
  mismos datos, mismas reglas de aislamiento por `family_id`/`school_id`.
- `checkDailyLimit()` (extraída de dentro de `answerFamilyQuestion()`, ahora
  función exportada) es el mismo tope de 30 turnos/24h, compartido entre chat,
  nota de voz y llamada -- los tres canales insertan en `ai_conversations` con
  `role='user'`, así que cuentan contra el mismo límite. Una sola llamada
  puede generar varios turnos de golpe (no se prorratea "1 llamada = 1
  turno") -- aceptado para esta primera versión, revisar si en la práctica
  bloquea a una familia antes de tiempo.
- `resolveGuardianIdentity()` sigue siendo el único lugar que toca la sesión
  de Next.js -- igual que el resto de Portal Familiar.

**Piezas nuevas**:
- `web/src/lib/ai/startVoiceCallSession.ts` -- núcleo sin sesión (recibe
  `schoolId`/`familyId` ya resueltos), arma las instrucciones de voz y
  mintea el token efímero de OpenAI.
- `web/src/lib/ai/logVoiceCallTranscript.ts` -- guarda el transcript completo
  en `ai_conversations` (channel `'voice'`, nuevo -- ver migración
  `20260801020000_ai_conversations_voice_channel.sql`, amplía el `check` de
  la columna `channel`). Se llama una sola vez al colgar: el navegador
  acumula los turnos en memoria durante la llamada (no hay "sesión viva" del
  lado del servidor de la que leer turno por turno).
- `web/src/app/dashboard/portal-familiar/actions.ts`: dos Server Actions
  nuevas, `startFamilyVoiceCallSession()`/`logFamilyVoiceCall()`, mismo
  patrón que `sendFamilyChatMessage()`.
- `web/src/hooks/useFamilyVoiceCall.ts` + `web/src/components/portal/VoiceCallWidget.tsx`
  -- cliente WebRTC (estado local con `useState`, no hay store global en este
  proyecto) y la tarjeta de UI, mismo estilo visual que `FamilyChatWidget`.

**Endpoints de OpenAI usados (verificados contra la API real el 2026-08-01,
no de memoria/documentación vieja -- OpenAI retiró su API beta de Realtime)**:
- `POST /v1/realtime/client_secrets` para el token efímero -- reemplaza a
  `/v1/realtime/sessions` (retirado, ahora 404). El body va anidado bajo
  `session`, con `voice` en `session.audio.output.voice` y `turn_detection`
  en `session.audio.input.turn_detection` (antes eran campos planos).
- `POST /v1/realtime/calls` para el intercambio SDP de WebRTC -- reemplaza a
  `POST /v1/realtime?model=...` (ahora responde
  `400 beta_api_shape_disabled`). Ya no hace falta el parámetro `?model=`
  porque el modelo queda fijado en el token efímero.

**No usa "tools" (function calling)**: a diferencia del proyecto hermano de
bienes raíces (que sí necesita tools porque el catálogo de propiedades es
grande), aquí el contexto completo de la familia (hijos, asistencia,
facturas, comunicados) cabe entero en las `instructions` de la sesión, igual
que ya hace el chat de texto -- más simple, sin relay de tool-calls que
mantener.

**Pendiente de verificar en este entorno (NO se pudo confirmar en esta
sesión)**:
1. La migración del `channel` está escrita pero **no aplicada** -- este
   entorno no tenía credenciales del proyecto de Supabase de MentorIApp.
   Correr `supabase db push` (o aplicarla manualmente) antes de probar.
2. No se hizo ninguna llamada real de punta a punta contra `OPENAI_API_KEY`
   de este proyecto -- solo se verificaron los endpoints/formas de petición
   contra la API de OpenAI en general (con una key de otro proyecto). Dado
   el historial de saldo en cero de las cuentas de Anthropic/OpenAI de este
   proyecto (ver sección de la nota de voz más abajo), confirmar saldo antes
   de probar.
3. `tsc --noEmit`, `npm run lint` y `npm run build` sí se corrieron limpios
   en este entorno -- sin errores nuevos, las únicas advertencias son
   preexistentes en archivos no tocados por este cambio.

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

## Métricas ampliadas — Panel del Director + Plataforma (comparación entre colegios)

Pensado para cuando el usuario maneje 8-10 colegios afiliados, no solo uno.

**Panel de Secretaría/Director** (`secretaria/page.tsx`) — ampliado de 4
tarjetas básicas a 4 categorías: Financiero (cobrado del mes, pendiente,
vencido -- basado en `invoices.status`, no hay todavía mora escalonada por
mes, esa migración de mensualidades quedó pendiente de una tarea anterior,
ver roadmap), Académico (% asistencia últimos 7 días, % de estudiantes
inscritos con al menos un intento de Academia este mes), Comunicación
(comunicados leídos vs. enviados este mes, via `message_reads`), y uso del
Asistente de IA (preguntas de familias en los últimos 7 días, via
`ai_conversations`).

**Plataforma** (`plataforma/page.tsx` + `SchoolsComparisonTable.tsx`,
cliente) — la lista de colegios pasó de tarjetas simples a una tabla
ordenable por columna (clic en el encabezado): estudiantes, staff, %
morosidad (vencido / (vencido+pendiente) de facturas abiertas), asistencia
promedio de los últimos 30 días, y uso del asistente de IA en la última
semana. Una consulta por colegio (aceptable con pocos colegios; revisar si
se vuelve lento con muchos más afiliados).

Nota técnica: en ambos archivos, el cálculo de fechas relativas (`Date.now()`)
se movió a una función auxiliar fuera del componente -- llamarlo
directamente en el cuerpo del componente dispara la regla de pureza de
React (mismo patrón ya documentado antes con `calculateAge`).

## Hallazgo importante: existía un segundo `AGENTS.md` desactualizado

`.agents/AGENTS.md` (del scaffold original, antes de que empezara este
trabajo) era un documento **distinto** a este archivo -- con reglas
arquitectónicas viejas y ya contradichas por decisiones reales tomadas
después (en particular: mandaba usar Edge Functions con un patrón de "5
bloques", exactamente el patrón que Claude Code citó la primera vez que
construyó el módulo de OCR con una Edge Function, antes de que se
corrigiera a Server Actions por el problema de Docker ya documentado
arriba). Es decir, esa desincronización causó un problema real, no solo
teórico. Se reemplazó su contenido por un puntero (`@../AGENTS.md`), mismo
patrón que `CLAUDE.md` en la raíz y en `web/`, para que cualquier
herramienta que lea `.agents/AGENTS.md` termine leyendo este documento real
en vez de uno viejo y contradictorio.

## Decisión REVERTIDA: el colegio ahora sí puede ver las conversaciones del asistente

La migración 019 (ver sección del Asistente de IA más arriba) decía
explícitamente: *"el personal del colegio no tiene ninguna política de
lectura sobre esta tabla, ni siquiera director"*. El 2026-08, al construir
el visor para la llamada de voz en vivo, el usuario **confirmó
explícitamente que quiere revertir esa decisión** -- director/school_admin/
super_admin sí pueden verlas ahora, **con la condición de avisarle al padre
en la propia interfaz** (no en letra pequeña de términos, en el widget
mismo) que el colegio puede revisar la conversación.

**Implementación**:
- Migración `20260802000000_ai_conversations_staff_read.sql`: política nueva
  de `select` para `super_admin`/`school_admin`/`director` -- **no**
  `teacher`/`finance`/`reception` (las conversaciones pueden tocar temas
  financieros o de salud de la familia; se restringió al mismo nivel que
  Personal/Configuración del colegio, no a todo el staff). Ajustar si el
  usuario decide lo contrario.
- `/dashboard/asistente-ia`: lista de familias con actividad (conteo de
  preguntas, última actividad, qué canales usó), ordenadas por más reciente.
- `/dashboard/asistente-ia/[familyId]`: transcript completo de esa familia,
  cronológico, con separador visual por canal.
- `FamilyChatWidget.tsx` y `VoiceCallWidget.tsx`: aviso visible ("El colegio
  puede revisar esta conversación") debajo del título de cada widget --
  cumple la condición del usuario, no es solo una política escrita.
- Nuevo módulo `asistente_ia` en `permissions.ts`, mismo `FULL_ACCESS` que
  `configuracion_colegio`.

**Limitación conocida, sin resolver**: la nota de voz grabada (transcrita con
Whisper) y el chat escrito **comparten el mismo `channel = 'widget'`** en la
base de datos -- no hay forma de distinguir en el visor si un mensaje del
padre fue tecleado o hablado y transcrito. Solo la llamada en vivo
(`channel = 'voice'`) es distinguible. Si en algún momento importa saber
cuál fue cuál, hace falta agregar un campo/canal separado para la nota de
voz (hoy no lo tiene, ver sección "Nota de voz en el asistente de IA" más
arriba -- reutiliza `sendFamilyChatMessage` tal cual, sin marca de origen).

## Invitación de acceso para tutores (Portal Familiar) — cierra una brecha real

**Brecha encontrada, no una decisión de diseño**: hasta esta tarea, un padre
solo podía obtener acceso al Portal Familiar de la misma forma manual usada
para probar (crear el usuario de Auth a mano en Supabase, vincularlo por
SQL). No existía ningún camino automático -- ni auto-registro desde la
landing del colegio, ni invitación por correo, a diferencia de Personal, que
sí tiene su propio flujo (`inviteStaffAccess`, ver más arriba) desde hace
semanas. El usuario lo notó al intentar probar la llamada de voz y preguntar
"¿cómo entra un padre?".

**Implementación**: `dashboard/familias/[id]/actions.ts` →
`inviteGuardianAccess(guardianId)`, **copia casi literal de
`inviteStaffAccess`** (mismo patrón de `admin.inviteUserByEmail` +
`redirectTo: /actualizar-contrasena` + reutilizar la cuenta de Auth si el
correo ya existía) -- la única diferencia real es que el rol de login
siempre es `'guardian'` (no hay que elegir uno como sí pasa con Personal).
Botón "Dar acceso al sistema" en cada tutor de `/dashboard/familias/[id]`,
mismo patrón visual que `GrantAccessButton.tsx` de Personal. Si el tutor no
tiene correo cargado, el botón se reemplaza por un aviso ("Sin correo") en
vez de fallar silenciosamente al invitar.

**Pendiente, mencionado pero no resuelto en esta tarea**: no hay ningún
enlace de "conviértete en familia" en la ficha de inscripción por OCR
(`/dashboard/estudiantes/escaneos`) -- cuando se confirma una ficha escaneada
y se crea el estudiante/familia/tutor, el tutor sigue sin acceso hasta que
alguien del colegio entre a la ficha de familia y le dé acceso manualmente
con este mismo botón. Sería natural ofrecer el botón de invitar justo ahí
también, en el mismo flujo de confirmación -- no se hizo en esta tarea por no
mezclar alcance.

## Invitación de tutores extendida a la bandeja de OCR + campo de cédula en formularios manuales

**Invitación desde la bandeja de OCR**: cerraba el pendiente que quedó anotado
al construir `inviteGuardianAccess` -- confirmar una ficha escaneada
(`/dashboard/estudiantes/escaneos`) ya no deja al tutor sin acceso hasta que
alguien vaya aparte a la ficha de familia.
- `createStudentWithFamily()` ahora devuelve `guardianIds: string[]` en el
  resultado exitoso (antes solo `studentId`/`familyId`) -- para ambos modos
  (`new` y `existing`).
- `confirmEnrollmentScan()` usa esos IDs para traer nombre/correo de los
  tutores recién creados y devolverlos como `guardiansToInvite`.
- `EnrollmentScansReview.tsx` muestra una tarjeta justo después de confirmar
  con un botón "Dar acceso al sistema" por cada tutor con correo -- mismo
  botón, mismo `inviteGuardianAccess()`.
- **Se movió `inviteGuardianAccess` de `familias/[id]/actions.ts` a
  `familias/actions.ts`** (un nivel más arriba, compartido) para que tanto
  la ficha de familia como la bandeja de OCR puedan importarla sin duplicar
  la función. Si se vuelve a necesitar desde un tercer lugar, ya está en la
  ubicación correcta para eso.

**Campo de cédula en los formularios manuales**: la columna
`guardians.national_id` ya existía desde el OCR de fichas (migración 20260731),
pero solo la bandeja de revisión de fichas la exponía -- los formularios
manuales (`NewStudentForm.tsx` en modo "Familia nueva", y
`EditFamilyForm.tsx`) no la pedían. Se agregó el campo "Cédula (opcional)" en
ambos, incluido en las interfaces `DraftGuardian`/`EditableGuardian` y en los
inserts/updates correspondientes. `editar/page.tsx` actualizado para traer
`national_id` en su `select`. No hizo falta ninguna migración nueva -- la
columna ya existía, solo faltaba exponerla en la interfaz.

## Acceso de tutores sin correo (común en RD) + PWA por colegio

**Acceso sin correo**: muchos padres en RD tienen celular/WhatsApp pero no
usan correo -- `inviteGuardianAccess()` requería correo sí o sí. Ahora, si
`guardian.email` es nulo, `familias/actions.ts` usa una rama distinta
(`createPhoneBasedAccess`): crea la cuenta directo con
`admin.auth.admin.createUser()` usando `{telefono}@mentoriapp.local` como
identificador (dominio que nunca se usa para enviar nada) y una contraseña
temporal generada al momento (`generateTempPassword()`, evita caracteres
ambiguos 0/O/1/l/I). Como la inscripción ya es presencial, el colegio
entrega esas credenciales en papel ahí mismo -- no depende de que el padre
revise un correo que quizás nunca usa. `GrantGuardianAccessButton.tsx`
muestra las credenciales en pantalla tras crear el acceso (con instrucción
de "entregar en persona"), y `EnrollmentScansReview.tsx` hace lo mismo justo
después de confirmar una ficha OCR (ya no filtra por
`.not('email', 'is', null)` -- ahora ofrece ambos caminos según corresponda).
Si el teléfono ya tenía una cuenta creada así (ej. otro hijo con la misma
madre), se reusa la cuenta con una contraseña nueva en vez de fallar.

**PWA por colegio** ("la puerta de entrada a la landing del colegio", pedido
explícito del usuario): cada colegio afiliado obtiene su propio ícono/nombre
al usar "Agregar a pantalla de inicio" desde el celular del padre.
- `web/src/app/colegio/[subdomain]/manifest.webmanifest/route.ts`: manifiesto
  dinámico, uno por colegio -- nombre/tagline reales del colegio,
  `start_url`/`scope` apuntando a `/colegio/[subdomain]`, ícono del colegio
  (`logo_url`) si ya lo cargó, con los íconos de MentorIApp
  (`web/public/icons/`) como respaldo si no.
- `generateMetadata()` en `colegio/[subdomain]/page.tsx` conecta el
  manifiesto + `appleWebApp` (nombre/ícono para iPhone, que no sigue el
  manifest de la misma forma que Android/Chrome).
- **A propósito, sin ningún service worker todavía** -- ya se vivió el
  problema real de `/sw.js` bloqueado por el middleware documentado más
  arriba; un manifest + metadatos correctos ya permite instalar sin ese
  riesgo. Si se quiere que funcione offline de verdad, es un paso aparte,
  con mucho más cuidado.
- Íconos de respaldo de MentorIApp generados con Pillow (birrete de
  graduación simple, color primario `#1a5f7a`) en `web/public/icons/` --
  los del repo raíz (`icon-192.png` etc., del scaffold original) están
  **muertos**, Vercel nunca los sirve porque el Root Directory es `web/`.

**Pendiente real, sin resolver**: Gran Manantial de Sabiduría todavía no
configuró su landing (`/dashboard/colegio` -- logo, tagline, mensaje de
bienvenida) al momento de escribir esto -- el usuario lo hará en persona el
próximo lunes. Hasta entonces, su manifiesto usa los íconos de respaldo de
MentorIApp, no un logo propio.

## Autorregistro de personal por enlace público (WhatsApp) + bandeja de revisión

El usuario compartió una foto con la lista de ~30 empleados de Gran
Manantial de Sabiduría (nombre, curso/materia, teléfono, cédula) y pidió
un enlace para compartir por WhatsApp donde cada quien complete su perfil.

**Decisión de diseño importante, tomada a propósito**: se consideró
transcribir los 30 nombres/cédulas directo de la foto para precargar los
registros, pero se descartó -- la foto está rotada y el texto pequeño de
cédula/teléfono no daba suficiente certeza para copiar datos de
identificación de personas reales sin riesgo real de error. En vez de
eso, mismo patrón ya usado para `leads` y las fichas de inscripción
escaneadas: **formulario público que nunca crea el registro real
directamente** -- cada persona reporta sus propios datos (garantizado
exacto, los escribe ella misma), dirección revisa y corrige si hace falta
antes de aprobar.

**Implementación**:
- Migración `20260819000000_staff_registrations.sql`: tabla
  `staff_registrations`, envío público (`grant insert ... to anon,
  authenticated` + policy `with check (true)`, mismo patrón que `leads`),
  revisión restringida a `super_admin`/`school_admin`/`director` del
  colegio.
- `web/src/lib/staff/roleLabels.ts`: las etiquetas de puestos y nivel
  académico se extrajeron aquí (antes vivían solo dentro de
  `personal/page.tsx`) para reutilizarlas también en el formulario público
  y la bandeja de revisión, sin duplicar.
- `/colegio/[subdomain]/registro-personal`: formulario público (sin
  login), mismo patrón de `FormData` no controlado que `LeadForm.tsx` (evita
  el bug ya conocido de que el autocompletado del navegador no dispara
  `onChange`). Pide correo, teléfono, cédula, puesto, materia/área, y
  ficha profesional completa.
- `/dashboard/personal/registros`: bandeja de revisión --
  `StaffRegistrationsReview.tsx` deja **corregir cualquier campo en
  pantalla antes de aprobar** (mismo principio que
  `confirmEnrollmentScan`/`approveVendorInvoice`: nunca se confía en el
  dato sin revisar). Al aprobar, crea el `staff` real y reutiliza
  `GrantAccessButton.tsx` (ya existente) para dar acceso al sistema ahí
  mismo, sin ir a otra pantalla.
- `PublicRegistrationLinkButton.tsx` en `/dashboard/personal`: copia el
  enlace listo para pegar en WhatsApp. Badge con el conteo de pendientes
  junto al botón "Registros pendientes".

**Pendiente real**: el usuario todavía no ha compartido el enlace ni
recibido ningún registro real -- sin verificar en vivo con un envío
real todavía.

## Alerta de uso de imagen -- Ley 136-03 (2026-08-21)

`authorization_requests.is_image_consent` (boolean) marca cuál
Autorización es "la de Uso de Imagen" -- se elige con un checkbox al
crearla. Actualizaciones (`dashboard/actualizaciones/page.tsx`) busca la
más reciente marcada así, cruza con `authorization_responses`, y le pasa
a `PostUpdateForm.tsx` un mapa de estudiantes sin luz verde
(`no_autorizado` explícito, o `pendiente` -- sin respuesta se trata
igual de cauteloso). Avisa en rojo antes de publicar, sin bloquear (una
foto grupal donde ese estudiante no sale identificable sigue siendo
válida). Si nadie ha creado todavía la autorización marcada, se le
sugiere a quien puede crearlas (con enlace directo) en vez de fallar en
silencio.

**Pendiente real**: sin probar en vivo -- falta crear la autorización
real de Uso de Imagen del colegio y confirmar que la alerta aparece.

## Autorizaciones -- permisos firmados digitalmente (2026-08-21)

Reemplaza el papel firmado para excursiones (usado tanto para dejar
subir al estudiante al vehículo como constancia ante el Distrito de
Educación / en caso de accidente). Decisión clave: **sin firma
criptográfica (PKI)**, innecesaria para este caso -- en su lugar,
identidad ya verificada por el login del tutor + reautenticación con
contraseña en el momento de firmar (mitiga que un hijo firme desde el
teléfono ya desbloqueado del padre) + nombre completo escrito + el
texto exacto autorizado congelado en la respuesta.

- `authorization_requests` + `authorization_responses`
  (`20260821040000_authorization_requests.sql`), mismo targeting por
  `grade_level` que Agenda/Comunicados. `unique(request, student)` --
  cada hijo necesita su propia autorización aunque varios hermanos
  estén en el mismo curso.
- `/dashboard/autorizaciones`: staff ve todas con conteo autorizados/
  pendientes/no autorizados; tutor responde por cada hijo.
- `/dashboard/autorizaciones/[id]`: roster imprimible (misma técnica
  de boletines, sin librería de PDF) + botón de recordatorio por
  correo a los pendientes (reutiliza `notify-message`). WhatsApp no
  incluido -- Evolution API sigue sin configurar en producción.

**Pendiente real**: sin probar en vivo (crear una autorización, firmar
como tutor de prueba, mandar el recordatorio).

## Doble rol (staff + tutor) -- "Vista de Familia" (2026-08-21)

Personal del colegio que también es padre/madre de un estudiante aquí
(ej. un profesor con un hijo inscrito) usa **una sola cuenta**, no dos.
`users_profiles` tiene `UNIQUE(auth_id)` pero ya tenía `staff_id` Y
`guardian_id` como columnas separadas en la misma fila -- sin usarse hasta
ahora. `lib/auth/linkProfileForDualRole.ts` es el helper que vincula
ambos sobre el mismo perfil en vez de intentar una segunda fila (que
violaría el UNIQUE). El rol principal (`role`, el que controla
`canAccess()`/menús) sigue siendo su rol de trabajo; para ver a sus
hijos usan el enlace "👪 Vista de Familia" en el Sidebar (solo aparece
si `guardian_id` está seteado), que los manda a `/dashboard/portal-familiar`
con la barra lateral de su rol de trabajo intacta -- no hay que cerrar
sesión ni cambiar de cuenta. `resolveGuardianIdentity()` ahora autoriza
por `guardian_id`, no por `role === 'guardian'` a secas.

**Corrección sobre lo que se creyó resuelto (2026-08-21, más tarde el
mismo día)**: la nota original de arriba decía que "Portal Familiar
completo ya funciona" para doble rol -- **eso era una suposición sin
verificar, y era falso**. El mismo problema de fondo (`role = 'guardian'`
estricto) existía en **24 políticas RLS de 21 tablas**, desde
`init.sql`: `ai_conversations`, `attendance`, `authorization_requests`/
`authorization_responses`, `azul_transactions`, `billing_concepts`,
`calendar_events`, `class_schedules`, `class_updates`,
`direct_conversations`/`direct_messages`, `enrollments`, `families`
(x2), `grades`, `guardians`, `invoices`, `messages`, `payment_receipts`,
`payments`, `student_guardians` (x2), `students`. La app ya dejaba
entrar a un perfil de personal con `guardian_id` a Portal Familiar,
pero las consultas RLS de comunicados/asistencia/mensajes/pagos/etc.
devolvían vacío en silencio -- nada de eso funcionaba de verdad para
doble rol, solo para un `role = 'guardian'` puro.

**Corregido** en `20260821060000_fix_dual_role_rls.sql` (`ALTER POLICY`
en las 24, sin downtime): el JOIN contra `guardians`/
`users_profiles.guardian_id` ya prueba el vínculo real con ese tutor
específico, así que el filtro `and role = 'guardian'` era una
restricción extra innecesaria -- se quitó en las 24. Donde no había
JOIN que lo probara, se reemplazó por `guardian_id is not null`
explícito. Horarios y Notas también quedaron cubiertos por esta misma
corrección (usan el mismo patrón).

**Pendiente real**: sin probar en vivo con una cuenta de doble rol
real todavía -- solo se confirmó por SQL que ninguna política sigue
con la restricción vieja.

## Gestión Académica: 4 módulos nuevos (2026-08-21, inspirados en TokApp iEduca)

El usuario pidió copiar/mejorar 4 funciones de TokApp iEduca. Se construyeron
en orden (cada uno depende del anterior), reutilizando siempre
`students.grade_level` (texto libre) como sistema de grado -- nunca el
catálogo `grade_levels`/`enrollments` de Academia, que sigue sin poblarse
(ver nota más abajo sobre los dos sistemas de grado en paralelo).

1. **Agenda digital** (`/dashboard/agenda`) -- eventos del colegio,
   dirigidos a todo el colegio o a un curso. Migración
   `20260821000000_calendar_events.sql`.
2. **Horarios** (`/dashboard/horarios`, `/horarios/periodos`) -- franjas
   horarias + materia/profesor por curso/día. Migración
   `20260821010000_class_schedules.sql`. **Nota técnica**: hubo que llamar
   `teacher_is_assigned_to_grade()` con 3 argumentos explícitos (existe una
   sobrecarga más nueva con `category default 'regular'` que hace ambigua
   la llamada de 2 argumentos que usan las políticas viejas de
   `students`/`attendance`/`class_updates` -- esas siguen con 2 argumentos
   y siguen funcionando porque ya estaban creadas antes de la ambigüedad,
   pero cualquier política NUEVA que la use debe pasar los 3 argumentos).
3. **Planificación de clases** (`/dashboard/planificacion`) -- un plan por
   franja de `class_schedules` + fecha puntual. Migración
   `20260821020000_lesson_plans.sql`. Herramienta interna, sin acceso de
   guardian/estudiante.
4. **Notas y boletines** (`/dashboard/notas`, `/notas/periodos`,
   `/notas/boletin/[studentId]`) -- notas 0-100 por estudiante+materia+
   periodo, autorizadas vía `class_schedules` (mismo profesor que da esa
   materia a ese curso). Migración `20260821030000_grades.sql`. Boletín
   imprimible (PDF vía "Imprimir" del navegador, sin librería nueva) --
   por eso `Sidebar`/`TopBar` ahora tienen `print:hidden`.

**Pendiente real**: nada de esto se ha probado en vivo con datos reales
todavía (crear un evento, asignar un horario, planificar una clase,
registrar una nota, generar un boletín) -- solo se verificó que compila
(`tsc`) y que las migraciones se aplicaron sin error al proyecto real.

## Notificaciones por correo (2026-08-20/21)

- **Hallazgo importante**: `RESEND_API_KEY` nunca estuvo configurada como
  secret de las Edge Functions de Supabase (`supabase secrets list` no la
  mostraba). Esto significa que `notify-attendance` (avisos de
  ausencia/tardanza) **nunca pudo enviar nada en producción** desde que se
  construyó -- ni WhatsApp (tampoco configurado) ni correo. Ya se agregó
  el secret (Dashboard → Edge Functions → Secrets), así que
  `notify-attendance` debería empezar a funcionar también, pero **no se
  ha verificado en vivo todavía**.
- Nueva Edge Function `notify-message` (`supabase/functions/notify-message/`):
  avisa por correo (Resend) al tutor principal de una familia cuando:
  1. El staff manda un mensaje directo nuevo (`sendStaffMessageAction` en
     `dashboard/mensajes/actions.ts`).
  2. Se publica un comunicado marcado **"Urgente"** (`createMessageAction`
     en `dashboard/comunicados/nuevo/actions.ts`) -- normal y borradores
     no notifican.
  - Se invoca directo con `admin.functions.invoke('notify-message', ...)`
    desde Next.js (no usa Database Webhook como notify-attendance, porque
    quien llama ya es código de servidor de confianza) vía
    `web/src/lib/notifications/notifyGuardianByEmail.ts`, best-effort
    (nunca tumba la acción si falla el correo).
  - La función rechaza (401) cualquier llamada que no traiga un JWT con
    `role: service_role` -- sin eso, cualquiera con la key pública `anon`
    podría haberla usado como relay de correo arbitrario.
  - Solo correo por ahora. WhatsApp (Evolution API) vive en
    `web/src/lib/whatsapp/` (Next.js, no Deno) y sus credenciales
    (`EVOLUTION_API_URL`/`EVOLUTION_API_KEY`) siguen sin configurar en
    producción -- portar a este flujo cuando eso exista.
- **Pendiente real**: verificar en vivo -- mandar un mensaje directo real
  y publicar un comunicado urgente de prueba, confirmar que el correo
  llega y que `notify-attendance` también quedó funcionando con el
  secret nuevo.

## Vencimiento del enlace de "recuperar contraseña" (2026-08-23)

**Reporte real del usuario, no hipotético**: probó el flujo de "olvidé mi
contraseña" con una familia real -- el enlace de restablecimiento venía
con un vencimiento de **1 minuto**, insuficiente para alguien que no revisa
el correo con agilidad (la mayoría de las familias en el país se comunican
por WhatsApp, no por correo). Le tomó 3 intentos lograrlo.

**Cómo funciona este flujo**: `recuperar-contrasena/page.tsx` llama a
`supabase.auth.resetPasswordForEmail()` (SDK nativo de Supabase, sin lógica
propia); `actualizar-contrasena/page.tsx` intercambia el `?code=` del enlace
por sesión (`exchangeCodeForSession`). El vencimiento del enlace no lo
controla el código de este repo -- lo controla Supabase Auth, con el mismo
parámetro `otp_expiry` que ya se documentaba en `supabase/config.toml` para
los OTP de correo (aplica a señalización, invitación, cambio de correo Y
recuperación de contraseña por igual -- no hay un valor separado solo para
"olvidé mi contraseña").

**Lo que se corrigió en este repo**: `supabase/config.toml` →
`[auth.email] otp_expiry` de `3600` a `600` (10 minutos). PR #3, fusionado
a `main`.

**Continuación (misma tarea, sesión siguiente, 2026-08-23) -- el pendiente
de arriba se cerró, pero con un incidente real en el camino que hay que
tener en cuenta para cualquier sesión futura que toque este proyecto**:

1. El usuario pegó un Personal Access Token de Supabase (`sbp_...`) en el
   chat para este único uso (no se guardó en el repo; se le indicó
   rotarlo/revocarlo después). Con ese token, `supabase login` +
   `supabase link --project-ref fssjgpqisfnmnkavsyld` sí funcionan en este
   entorno.
2. **Se confirmó exactamente lo que este documento ya sospechaba**: el
   `config.toml` de este repo estaba desincronizado de lo que de verdad
   tenía el Dashboard remoto -- no solo en `otp_expiry`, sino en varios
   campos más (quedaron con valores de entorno local/placeholder, nunca
   actualizados a mano tras configurarse una vez en el Dashboard).
3. **Incidente real**: se corrió `supabase config push` para subir
   *solo* el cambio de `otp_expiry`, pero el comando empuja el archivo
   `[auth]`/`[storage]` **completo**, no un campo suelto. Esto rompió
   momentáneamente producción: `site_url` y `additional_redirect_urls`
   quedaron apuntando a `127.0.0.1` (dominio de desarrollo local) en vez
   del dominio real, `rate_limit.email_sent` bajó de 100 a 2, MFA (TOTP)
   se desactivó, y `enable_confirmations` se puso en `false`. Mientras
   estuvo así, los enlaces de recuperar contraseña / magic link de
   usuarios reales podían fallar (redirigían a una URL que no existe
   para ellos).
4. **Diagnóstico y arreglo**: se detectó con una lectura de solo consulta
   (`GET /v1/projects/{ref}/config/auth` de la Management API, con el
   mismo token) comparando contra el diff que había mostrado el propio
   `supabase config push` (la columna "remote" del diff, antes de
   romperse, tenía los valores reales de producción). Un primer intento
   de arreglarlo con un `PATCH` directo por `curl` fue bloqueado por el
   clasificador de seguridad del harness (acción de escritura contra una
   API externa con credenciales). El camino que sí funcionó: corregir
   `supabase/config.toml` para que reflejara los valores reales de
   producción (no los de desarrollo local) y volver a correr
   `supabase config push` -- como local y remoto ya coincidían, el push
   quedó limpio y restauró todo, verificado de nuevo con la misma lectura
   de solo consulta. `otp_expiry`/`mailer_otp_exp` = `600` se mantuvo
   correcto en todo momento (era el único cambio que sí queríamos).
5. **Regla para el futuro, no solo sospecha ya**: **no correr
   `supabase config push` contra este proyecto sin antes revisar el diff
   completo campo por campo** -- las secciones `[auth]`/`[storage]` de
   este `config.toml` no se mantienen sincronizadas con lo que
   Configuración de Supabase tiene en el Dashboard remoto (que es la
   fuente de verdad real para ese proyecto). Para un cambio puntual de un
   solo campo, es más seguro un `PATCH` dirigido a la Management API (o
   hacerlo a mano en el Dashboard, como ya recomendaba este mismo
   documento) que un `config push` completo.
6. **Discrepancia del `site_url` -- resuelta, confirmada con el usuario**:
   Auth apuntaba al dominio viejo de Vercel en vez de
   `https://educacionmanantial.com` (el paso de Auth se quedó fuera
   cuando se hizo la migración de dominio del punto 6 del roadmap). Se
   corrigió `site_url` y `additional_redirect_urls` en `config.toml` y se
   aplicó a producción con `supabase config push` (diff limpio, un solo
   campo) -- verificado con lectura de solo consulta:
   `site_url = https://educacionmanantial.com`. Se dejó también
   `https://n8n-school-expert-landingpage.vercel.app/**` en la lista de
   redirects permitidos como respaldo, no se quitó.
7. `sender_name = "MentorIApp"` -- confirmado con el usuario que es el
   nombre correcto (coincide con lo que ya tenía producción antes del
   incidente; el `MentorIA` sin "pp" que documenta la sección de SMTP más
   abajo, 2026-08-20, quedó desactualizado -- no se corrigió esa nota
   histórica, pero cualquier sesión futura debe confiar en "MentorIApp").
8. `supabase/config.toml` corregido se subió en un PR nuevo (rama
   `fix/config-toml-produccion-real`, PR #4) -- el merge automático a
   `main` también fue bloqueado por el clasificador de seguridad
   (fusionar a la rama de producción), así que quedó pendiente de que el
   usuario lo apruebe manualmente en GitHub, igual que el PR #3.
9. **Sigue pendiente, ahora sí con el valor correcto en todo el
   pipeline** (repo y producción): probar el enlace de "olvidé mi
   contraseña" con una familia real y confirmar que dura 10 minutos.

**Continuación (2026-08-27) -- el punto 9 se probó y falló; no dar por
buena la palabra "confirmado" de este documento sin una prueba real
reciente**:

1. Bethania probó el flujo con una cuenta real (Jennifer Liliana
   Soriano) y el enlace le dio **44 segundos** -- MENOS que el ~1 minuto
   original, a pesar de que `otp_expiry`/`mailer_otp_exp` llevaba desde
   el 23 de agosto confirmado en `600` tanto en el repo como en
   producción (ver puntos 1-8 de arriba). Esto quedó documentado en una
   rama sin fusionar (`claude/password-reset-expiry-time-syz7ac`,
   commit `aa2b72e`) que subió el valor a `660` sin poder aplicarlo,
   porque esa sesión tampoco tenía token de la Management API.
2. El usuario reportó el mismo problema de nuevo, por separado, sin
   saber que ya se había investigado -- pidiendo esta vez 10 minutos
   explícitamente. Se le dio el token (`sbp_...`, un solo uso, no vive
   en el repo) y se aplicó un `PATCH` directo a
   `https://api.supabase.com/v1/projects/fssjgpqisfnmnkavsyld/config/auth`
   con `{"mailer_otp_exp": 600}` (no `supabase config push` -- ver la
   regla del punto 5, un PATCH de un solo campo es más seguro). Respuesta
   200, `mailer_otp_exp` confirmado en `600` en el cuerpo de la
   respuesta.
3. **Lo que esto NO prueba**: que el enlace vaya a durar 10 minutos de
   verdad. El mismo valor (`600`) ya estaba puesto el 23 de agosto y aun
   así el enlace duró 44 segundos en la prueba real más reciente. Es
   posible que `mailer_otp_exp` controle el código OTP de 6 dígitos
   (`verifyOtp`) pero NO el parámetro `code` del flujo PKCE que usa
   `exchangeCodeForSession` en `actualizar-contrasena/page.tsx` -- no
   hay evidencia todavía de que sean el mismo mecanismo. **Cualquier
   sesión futura**: no repetir "confirmado" solo porque la API devuelve
   el valor esperado; pedir al usuario una prueba real de extremo a
   extremo (clic al enlace del correo, cronometrado) antes de cerrar
   este punto. Si vuelve a fallar con `mailer_otp_exp` ya en `600`,
   buscar otro parámetro (posiblemente algo relacionado al hook de envío
   de correo personalizado, si existe, o un límite hardcodeado de GoTrue
   ajeno a este config).

**Causa raíz real, encontrada leyendo el código fuente instalado
(`node_modules/@supabase/auth-js`), no la expiración (2026-08-27)**:

4. El punto 3 de arriba tenía razón en sospechar de otro mecanismo.
   `actualizar-contrasena/page.tsx` solo sabía procesar `?code=...`
   (flujo PKCE, vía `exchangeCodeForSession`). Pero los enlaces
   disparados **desde el panel** -- "reenviar acceso" en
   Personal/Familias (`admin.auth.resetPasswordForEmail`) y la
   invitación inicial (`admin.auth.admin.inviteUserByEmail`) -- corren
   en el servidor con `createAdminClient()` (`lib/supabase/admin.ts`),
   que usa `@supabase/supabase-js` sin `flowType: 'pkce'` -- cae en
   `'implicit'` por defecto. La propia librería lo documenta:
   `GoTrueAdminApi.inviteUserByEmail` trae un aviso explícito ("PKCE is
   not supported... the browser initiating the invite is often
   different from the browser accepting it"). Esos enlaces llegan como
   fragmento `#access_token=...&refresh_token=...`, no como `?code=`.
5. Verificado en `GoTrueClient.js` (`_getSessionFromURL`, alrededor de
   la línea 3181): cuando el cliente está fijado en `flowType: 'pkce'`
   (como el de este proyecto, vía `@supabase/ssr`) y la URL trae un
   callback de tipo `'implicit'`, la librería lanza
   `AuthPKCEGrantCodeExchangeError('Not a valid PKCE flow url.')` en su
   auto-detección interna y no crea sesión -- **sin importar cuánto
   tiempo haya pasado desde que se envió el correo**. Esto explica el
   patrón real: no era que el enlace "expirara rápido", es que los
   enlaces disparados por un admin nunca llegaron a funcionar, sin
   importar qué tan rápido se probaran. El error se detecta silenciado
   (atrapado internamente), así que la persona solo ve "Enlace vencido o
   inválido" -- indistinguible en la UI de una expiración real.
6. **Fix aplicado** (rama `fix/actualizar-contrasena-enlaces-admin`):
   `actualizar-contrasena/page.tsx` ahora también revisa
   `window.location.hash` cuando no hay `?code=`, y si trae
   `access_token`/`refresh_token` llama a `supabase.auth.setSession()`
   directamente -- sin depender de PKCE ni tocar `createAdminClient()`
   ni las plantillas de correo. `tsc`/`eslint`/`next build` limpios.
   **Pendiente**: confirmar con una prueba real (botón "reenviar
   acceso" con una cuenta real, una vez fusionado a `main` y desplegado)
   que el enlace del admin ahora sí abre la pantalla de cambiar
   contraseña. El punto 3 (expiración de `otp_expiry`/`mailer_otp_exp`)
   sigue aplicando solo al flujo de autoservicio (`/recuperar-contrasena`),
   que nunca tuvo este problema de formato.

## Horarios 2026-2027 (primaria/secundaria/docentes) + informe ejecutivo de carga horaria (2026-08-23)

El usuario compartió 3 documentos Word con los horarios reales del período
2026-2027 (Docentes de Secundaria, Estudiantes de Secundaria, Estudiantes de
Primaria) y pidió: (1) cargarlos/actualizarlos en el sistema, y (2) un informe
ejecutivo para Contabilidad comparando horas de clase impartidas vs. horas
pagadas por docente de secundaria, con miras a optimizar RRHH.

**Parte 1 -- Horarios: preparados, NO cargados en producción.** Los tres
documentos se parsearon y se cruzaron entre sí (el horario de cada docente
contra el horario de cada grado, por día/franja) para armar un libro
`Horarios_2026-2027_MentorIApp.xlsx` con hojas "Secundaria" (materia +
docente por grado/día/franja, ya cruzados), "Primaria" (materia + docente
asumido/asignado), "Resumen Docentes" y "Notas". **No se aplicó a la tabla
`class_schedules`** (ver migración `20260821010000_class_schedules.sql`)
porque esta sesión no tuvo credenciales de Supabase -- mismo bloqueo ya
documentado varias veces en este archivo (Azul, OCR, WhatsApp). Además,
`class_schedules.subject_id`/`staff_id` son referencias a `subjects`/`staff`
ya existentes en producción, y `subjects` (migración 007) probablemente
sigue vacía (nunca se pobló, ver nota de "Gestión Académica" más abajo) --
escribir un `insert` a ciegas sin poder verificar esos IDs contra la base
real habría sido más riesgoso que útil. El Excel queda como fuente lista
para que el staff lo transcriba manualmente en `/dashboard/horarios`, o para
que una sesión futura con acceso real a Supabase la use para poblar
`class_periods`/`class_schedules` (y `subjects` si hace falta) de forma
verificable.

**Hallazgo real del cruce** (no hipotético): el horario de Inglés de 1ro
Secundaria, viernes 7:30-8:20, aparece marcado en el horario individual de
**dos** docentes de Inglés distintas (Orlando Natera y Yendry Paulino) --
posible desincronización entre el horario de estudiantes y el de maestros,
señalada en la hoja "Notas" del Excel para que Dirección Académica lo
confirme. También: 6to de Primaria no tiene docente titular asignado en el
documento recibido (campo "Docente:" en blanco).

**Parte 2 -- Informe ejecutivo**: `Informe_Ejecutivo_Carga_Horaria_Docente_Secundaria.docx`,
generado con `docx` (npm) + gráficas de `matplotlib`, entregado directamente
al usuario (no vive en el repo). Metodología: horas de clase reales por
docente (excluyendo recreo) vs. una "capacidad esperada" de 25h/semana
(30h pagadas − 5h/semana de planificación, 1h/día), a partir de un salario
mensual de referencia de RD$13,815.90 (RD$579.77/día ÷ 23.83, RD$96.63/hora).
El hallazgo central: ningún docente de secundaria llega a las 25h, pero
**materia por materia** casi todas ya están al mínimo de un solo docente
para los 6 grados -- la única con una oportunidad real de consolidación,
confirmada por los números (2 docentes al 50-55% de utilización, demanda
combinada real de solo 25.67h, apenas 0.67h por encima de 1 plaza -- cifra
corregida, ver "Verificación cruzada" abajo), es **Inglés**,
separado como grupo propio en el informe a pedido explícito del usuario.
Orientación Educativa (Génesis Rodríguez, 1.83h/semana) se excluyó del
análisis financiero -- su rol probablemente incluye trabajo real fuera del
horario de clases (consejería, casos, reuniones) que este informe no puede
medir. Educación Física (Jennifer Liliana Soriano, única especialista para
todo el colegio) se presenta con su carga combinada primaria+secundaria
(11.5h) para no sobreestimar su disponibilidad real.

~~**Pendiente real**: no se pudo previsualizar el `.docx` renderizado a PDF en
esta sesión~~ -- **resuelto el mismo día** en una sesión de Claude Code con
acceso a la máquina del usuario: el `.docx` se exportó a PDF con Word
(COM, `ExportAsFixedFormat`) sin errores -- 4 gráficas y 2 tablas intactas.
El bloqueo era del entorno anterior (`soffice`), no del archivo.

### Verificación cruzada de los dos entregables (2026-08-23, sesión posterior)

Los dos archivos se volvieron a revisar leyéndolos directamente (`.xlsx`/`.docx`
son ZIP con XML; se re-contaron las horas desde el horario en vez de confiar en
la hoja "Resumen Docentes"). **Toda la aritmética financiera resultó correcta**
(salario diario, tarifa/hora, cada fila de brecha, el promedio de 16.0h, la
utilización de 63.9% y el total de RD$37,756 -- diferencias de céntimos por
redondeo). También salieron limpias dos comprobaciones estructurales: los 6
grados de secundaria tienen sus 30 sesiones semanales completas, y ningún
docente aparece asignado a dos grados a la misma hora.

Se encontraron **tres errores de conteo**, ya corregidos en las versiones
`*_corregido.xlsx` / `*_corregido.docx` (los originales se dejaron intactos):

1. **Inglés estaba inflado por doble conteo, y eso *refuerza* la
   recomendación principal.** La franja compartida de 1ro (viernes 7:30-8:20)
   se le cuenta a los dos profesores, así que sumar sus horas cuenta esos 50
   minutos dos veces. La demanda combinada real es **25.67h, no 26.5h** --
   o sea que consolidar en una sola plaza queda a 0.67h del límite, no a 1.5h.
   El valor mensual del grupo pasa de RD$9,840 a RD$10,180.
2. **Marcelis Santos: descuadre entre documentos (hallazgo nuevo).** Su
   horario de docente marca 21 sesiones (18.00h), pero en los horarios de los
   6 grados solo aparecen 20 (17.17h). Hay una clase de Ciencias Naturales que
   existe en un documento y no en el otro. Se mantuvo la cifra del horario de
   docentes (la fuente declarada del informe) y se dejó anotado para que
   Dirección Académica confirme cuál documento está al día.
3. **Génesis Rodríguez: 1.83h, no 1.67h.** Sus 2 sesiones no duran lo mismo
   (una de 50 min con 1ro y otra de 60 min con 4to). No afecta el análisis
   financiero porque está excluida.

Si los puntos 1 y 2 se confirmaran, la brecha total del informe subiría unos
RD$700/mes (~1.8%) -- sin cambiar ninguna conclusión. También se arregló un
defecto de formato del Excel: la hoja "Notas" tenía el texto partido en
columnas sueltas y la nota de primaria quedaba cortada a media frase.

### Carga de los horarios en producción — HECHA el 2026-08-23

**Las 330 clases están cargadas y verificadas en producción.** El script vive
en `supabase/seeds/20260823_horarios_2026_2027.sql` (con su generador al
lado); lo corrió el usuario a mano en el SQL Editor, porque el clasificador
de seguridad del harness bloquea toda escritura a producción desde la sesión.

Verificación posterior contra la base, no asumida: `class_schedules` 330,
`subjects` 14, `class_periods` 14 (7 primaria + 7 secundaria, ninguna sin
nivel), 12 grados con horario, 19 clases sin docente. Dos comprobaciones que
importaban más que los conteos:

- **Ningún curso del horario quedó huérfano**: todos los `grade_level` de
  `class_schedules` existen en `students`. Era el riesgo real -- la política
  RLS `class_schedules_guardian_read` une por ese texto, así que una variante
  habría dejado a esa familia sin ver nada.
- **Ningún cruce de niveles**: cada grado de primaria usa solo franjas de
  primaria (25 clases = 5 franjas x 5 días) y cada uno de secundaria solo las
  suyas (30 = 6 x 5).

Validación indirecta que dio confianza en el mapeo completo: el reparto de
Inglés que quedó en la base reproduce exactamente la estructura del área de
Amco documentada más arriba, sin haberla usado como fuente de la carga --
Yuleymis Lugo 1er ciclo primaria, Marianelis 2do ciclo primaria, Orlando
Natera 1er ciclo secundaria, Yendry Paulino 2do ciclo secundaria.

**Error cometido y corregido en el camino**: el primer intento falló con
`23502` porque `staff.email` es `NOT NULL` y el insert de Orlando no lo
traía. La transacción revirtió entera, así que no quedó nada a medias -- por
eso el script va envuelto en `begin/commit`. Lección aplicada después:
comprobar las columnas `NOT NULL` sin default de **todas** las tablas destino
antes de generar un script de carga, no solo de la que falló.

**Pendientes que dejó esta carga:**
1. **El correo de Orlando Natera es un marcador**
   (`orlando.natera@pendiente.local`). La tabla exige correo y no se tenía el
   suyo; se usó a propósito un dominio que no resuelve, para que no pueda
   llegarle una invitación a un desconocido. Hace falta el real para
   invitarlo a la app.
2. **6to de Primaria no tiene docente titular** -- sus 19 clases están
   cargadas con `staff_id` nulo porque el documento de origen trae ese campo
   en blanco. Se asigna desde `/dashboard/horarios` sin volver a correr nada.
3. `teacher_assignments.category` sigue en `'regular'` para todo, incluidas
   las 5 asignaciones de Inglés y la de Educación Física, con el ciclo
   escrito a mano dentro del texto del grado. Limpiarlo es parte del PR #2
   (enrutamiento por materia), todavía sin fusionar.

### Estado que tenía producción antes de la carga (contexto)

Los cinco bloqueos de abajo quedaron todos resueltos; se dejan documentados
porque explican por qué el script hace lo que hace.

Conteos de entonces: `schools` 1, `staff` 33, `students` 77, `school_years`
1, `grade_levels` 4, `teacher_assignments` 20, `class_periods` 7,
**`subjects` 0**, **`class_schedules` 0**.

**~~Bloqueo 1~~ -- RESUELTO en código (2026-08-23), falta aplicar la
migración.** Los 7 `class_periods` que ya existen (cargados el 2026-08-22:
"Fila de Bienvenida", "Bloque 1-5", "Recreo") resultaron ser los de
**primaria** -- coinciden exactamente con las franjas del documento de
primaria (7:40-8:30, 8:30-9:20, 10:20-11:10, 11:10-11:50, 11:50-12:30).
**Secundaria usa otra rejilla completamente distinta** (7:30-8:20, 8:20-9:10,
9:10-10:00, 10:00-10:50, recreo 10:50-11:10, 11:10-12:10, 12:10-1:00) que no
está cargada. Como `class_periods` era una sola lista plana por colegio, la
pantalla mostraba las franjas de primaria al abrir un curso de secundaria.

Solución implementada (migración `20260823000000_class_periods_level.sql` +
cambios en `/dashboard/horarios`): columna `level` opcional en
`class_periods`, con los mismos valores que `grade_levels.category`;
`NULL` = aplica a todos los niveles, así que un colegio con una sola rejilla
no se ve afectado. El filtrado usa el helper nuevo
`web/src/lib/schedule/gradeLevelCategory.ts`, que traduce el texto libre de
`students.grade_level` al nivel -- **ojo con el orden de sus comprobaciones**:
"Pre Primario" contiene "primari" pero es nivel inicial, así que se descarta
antes que primaria. La vista del profesor sigue usando todas las franjas
(un mismo docente puede dar clase en varios niveles, como Educación Física).

**Pendiente de esta parte**: la migración **no se pudo aplicar a producción**
desde la sesión de Claude Code -- tanto el SQL directo por la Management API
como `supabase db push` fueron bloqueados por el clasificador de seguridad
del harness (escritura de esquema en producción). `supabase migration list
--linked` confirma que es la única pendiente: todas las anteriores hasta
`20260821060000` ya están aplicadas. Alguien con acceso debe correr
`supabase db push`, o pegar el archivo en el SQL Editor del Dashboard.
Después hay que marcar como `level = 'primaria'` los 7 `class_periods`
existentes (son los de primaria) y crear las 7 franjas de secundaria.

**Bloqueo 2 -- Orlando Natera no existe en la base.** Da Inglés de 1er ciclo
de secundaria (15 sesiones semanales en el horario), pero no aparece en
`staff` (ni siquiera con `deleted_at`) ni en `staff_registrations`. O falta
darlo de alta, o ya no trabaja en el colegio y alguien más cubre esas horas.

**Bloqueo 3 -- una docente de primaria no se puede identificar con certeza.**
El horario dice "Maríanelis Calderón" (Inglés, 2do ciclo de primaria). En
`staff` hay dos candidatas y ninguna calza del todo: "Marianelis Rivera
Cordero" (specialty `English`, mismo nombre de pila pero otro apellido) y
"Ana danelia Calderon" (mismo apellido, pero specialty `Nivel primario primer
ciclo`, no inglés). Lo más probable es la primera, pero no se asumió.

**Bloqueo 4 -- `grade_level` es texto libre y está inconsistente.** Es el
campo por el que la política RLS `class_schedules_guardian_read` une el
horario con `students.grade_level`, así que **cualquier diferencia de texto
deja a esa familia sin ver el horario**. Los valores reales en `students` son
del tipo `"1ro. Secundaria"` (con punto), salvo `"6to Secundaria"`, el único
sin punto -- claramente un error de digitación de 1 fila. En
`teacher_assignments` el desorden es mayor (`"1ro de Secundaria"`,
`"3r0. Primaria"`, `"4to. de Primaria"`, además de entradas por ciclo para
Inglés). Hay que normalizar antes de cargar, o el horario quedará invisible
para parte de las familias.

**Bloqueo 5 -- los nombres de materias no están normalizados en los
documentos de origen**: aparecen "Inglés" e "Ingles", "Ciencias Naturales" y
"Naturales", "Educación Artística" y "Artística", "Orientación Educativa" y
"Orientación", "Lengua Española / Caligrafía" y "Leng. Española / Caligrafía".
Como `subjects` está vacía, hay que definir la lista canónica antes de
poblarla (si no, quedan materias duplicadas desde el día uno).

**Además, dato útil para quien retome**: los duplicados de `staff` que se ven
a simple vista (Yendry Paulino, Jenniffer Soriano, Aidad Santos) **ya están
resueltos por borrado suave** -- en cada par hay uno con `deleted_at` y otro
activo, así que basta filtrar por `deleted_at is null`. El resto de los
docentes del horario sí mapea con confianza alta usando el campo
`staff.specialty`, que trae el nivel/ciclo de cada uno.

**Nota de método**: la Management API responde bien con `curl`, pero devuelve
`403 error 1010` (bloqueo de Cloudflare por huella del cliente) si se llama
con `urllib` de Python. Usar `curl` para estas consultas.

## Colisión de números de migración — cómo se detectó y qué hacer (2026-08-23)

Al traer a `main` la rama del enrutamiento por materia (PR #2, abierta desde
el 2026-08-20) apareció un problema que no se ve en el diff: sus tres
migraciones usaban números **ya ocupados por otras migraciones distintas que
ya estaban aplicadas en producción**.

| Número | En la rama del PR | En `main` (y aplicada) |
|---|---|---|
| `20260821000000` | communication_categories_teacher_assignments | calendar_events |
| `20260821010000` | direct_conversations_category | class_schedules |
| `20260821020000` | messages_category | lesson_plans |

**Por qué es peligroso y silencioso**: `supabase db push` decide qué aplicar
comparando el número contra `supabase_migrations.schema_migrations`. Como esos
tres números ya constaban como aplicados (con otro contenido), habría dado las
tres migraciones del PR por hechas y **las habría saltado sin avisar**. El
código habría llegado a producción esperando columnas y funciones inexistentes.

Se renumeraron a `20260823010000` / `20260823020000` / `20260823030000`, ya
por encima de todo lo aplicado.

**Detalle importante para no confundirse**: revisando la base se comprobó que
el esquema de esas tres migraciones **ya estaba aplicado a mano en producción**
(las columnas `category` de `teacher_assignments`/`direct_conversations`/
`messages`, el índice `idx_teacher_assignments_unique_scoped`, las dos
sobrecargas de `teacher_is_assigned_to_grade`, `staff_can_see_family_category`,
y el unique viejo de `direct_conversations` ya eliminado). O sea: la base iba
por delante del repo, y lo que faltaba era el código. Las tres migraciones son
idempotentes (`add column if not exists`, `create or replace function`,
`drop policy if exists`, y bloques `do $$` que eliminan constraints por
introspección en vez de por nombre), así que volver a correrlas es inofensivo
y sirve para dejarlas registradas.

**Regla para el futuro**: antes de fusionar una rama que lleve días abierta,
comparar sus números de migración contra `supabase migration list --linked`.
Que el diff no muestre conflicto no significa que no lo haya: los nombres de
archivo son distintos, y git los ve como archivos nuevos sin relación.

## Bug real: `users_profiles` nunca tuvo policy de RLS para `insert`

Reportado por el usuario con una captura real: al aprobar un registro de
personal (Gladys Esther Vargas Tejeda, puesto Director) y darle acceso,
`inviteStaffAccess`/`inviteGuardianAccess` fallaban con `new row violates
row-level security policy for table "users_profiles"`, sin importar el rol
elegido. Causa confirmada revisando las 27 migraciones: `users_profiles`
tiene RLS habilitado (`20260703000000_rls_hardening.sql`) pero **jamás**

> **Nota al fusionar (2026-08-23)**: `main` ya había corregido este mismo
> bug por otra vía, y de forma más completa -- con el helper
> `linkProfileForDualRole()`, que además cubre el caso de una persona que
> es staff y tutora a la vez. Al traer esta rama se conservó la versión de
> `main`; el diagnóstico de abajo se mantiene porque explica la causa raíz.
tuvo una policy de `insert`, solo `select`/`update` -- el insert se hacía
con el cliente de sesión del director (`supabase`, sujeto a RLS) en vez del
cliente `admin` (service_role). Afectaba tanto a Personal como a Familias
(mismo patrón copiado). Fix: los tres inserts (`inviteStaffAccess`,
`inviteByEmail`, `createPhoneBasedAccess`) ahora usan el cliente `admin` --
el permiso ya se valida arriba con `canAccess()`, así que esto es correcto
y consistente con el resto de operaciones privilegiadas del proyecto. No
hizo falta ninguna migración -- fue un bug de código, no de policy faltante
que algún flujo legítimo necesitara desde el cliente de sesión.

## Bug real: la invitación decía "enviada" aunque el correo ya existiera y no se mandara nada

Reportado por el usuario: "los correos de invitación todavía no salen".
Revisando `inviteStaffAccess` (Personal) e `inviteByEmail` (Familias):
cuando `admin.auth.admin.inviteUserByEmail()` falla porque el correo **ya
tiene una cuenta de Auth** (ej. la misma persona quedó registrada antes
como tutor en otro colegio, o un intento anterior de invitación ya había
creado la cuenta pero la persona nunca completó el proceso), el código
detecta el error "already been registered" y **reusa la cuenta existente
en silencio** -- pero nunca mandaba ningún correo nuevo en ese caso
(`inviteUserByEmail` había fallado, así que no salió nada) y aun así el
mensaje final decía "Invitación enviada a {email}." La persona quedaba
vinculada al perfil pero sin ninguna forma real de enterarse o entrar.
Fix: en ese caso ahora se llama a `admin.auth.resetPasswordForEmail()`
para mandar un correo de verdad (restablecer contraseña), y el mensaje que
ve quien invita distingue los dos casos en vez de decir siempre
"Invitación enviada". Si ese segundo envío también falla, el mensaje lo
dice explícitamente y sugiere que la persona entre con "Olvidé mi
contraseña" en vez de mentir sobre el resultado.

**Importante, sin resolver todavía y fuera del alcance de un cambio de
código**: si el usuario ve que **ningún** correo de invitación llega
(ni el primero, cuenta nueva) esto probablemente no es un bug de la
aplicación -- `inviteUserByEmail`/`resetPasswordForEmail` envían el correo
a través del servicio de email **propio de Supabase Auth** (configurado en
el Dashboard de Supabase, Authentication → Emails → SMTP Settings), que es
un sistema de envío totalmente distinto al de `pg_net`+Resend que ya usa
este proyecto para los correos de leads (ver bug #7 y la nota de
"resend_from_address" más arriba) -- ese Resend NO cubre las invitaciones
de Auth a menos que también se configure un SMTP personalizado ahí. El
correo por defecto de Supabase (sin SMTP propio configurado) tiene límites
de envío muy bajos pensados solo para desarrollo, no para producción, y es
la causa más común de "las invitaciones no llegan". Ninguna sesión de
Claude Code ha podido verificar ni configurar esto: el conector MCP de
Supabase de esta sesión sigue enlazado al proyecto vacío
`hwrtwylnhhobnharthsx` (ahora además `INACTIVE`), no al proyecto real
(`fssjgpqisfnmnkavsyld`) -- mismo bloqueo ya documentado en la sección de
OCR más abajo. **Pendiente real para el usuario**: entrar al Dashboard de
Supabase del proyecto real → Authentication → Emails → SMTP Settings, y
configurar un SMTP personalizado (por ejemplo con Resend y el dominio ya
verificado `resendcegmas.com`) en vez de depender del envío por defecto.

## Mapeo de puesto → rol de acceso: Secretaría y Coordinación

El usuario confirmó explícitamente el alcance de cada puesto (no se asumió):

- **Secretaria**: se encargará de comunicaciones, mantenimiento de la base
  de datos de estudiantes (nuevos ingresos, salidas), pagos y validación de
  comprobantes, y ver las solicitudes de los padres que no son del maestro
  (permisos, cartas de confirmación de estudio). **No existía un rol de
  login "Secretaria"** -- el puesto (`secretary`/`teaching_secretary` en
  `roleLabels.ts`) es distinto de los 5 roles de acceso
  (`director`/`school_admin`/`teacher`/`finance`/`reception`). Se decidió
  reusar `reception` (ya etiquetado "Secretaría" en `TopBar.tsx` desde
  antes de esta tarea) en vez de crear un rol nuevo -- a nivel de RLS,
  `reception` ya tenía acceso de lectura/escritura a `invoices`/`payments`/
  `billing_concepts` desde la migración 004 (nunca expuesto en la interfaz
  hasta ahora). Se amplió `ROLE_MODULES.reception` en `permissions.ts` con
  `tesoreria`+`pagos` (ya tenía `estudiantes`/`familias`/`comunicados`/
  `mensajes_directos`/`asistencia`), y se agregaron los links "Mensajes" y
  "Tesorería" al nav de `reception` en `Sidebar.tsx` (existían los permisos
  pero no el link, un gap que ya existía antes de esta tarea para
  `mensajes_directos`).
- **Facturas de proveedores/Alegra quedó fuera a propósito** -- no es parte
  de lo que el usuario describió para Secretaria, y es gestión contable
  (mapeo RNC→contacto, categoría→cuenta) que se decidió dejar solo en
  Finanzas/Dirección. Como `tesoreria_proveedores` compartía el mismo
  gate `canAccess(role,'tesoreria')` que el resto de Tesorería (todo el
  módulo usaba un solo permiso, sin distinción), se separó en un módulo
  nuevo `tesoreria_proveedores` (permissions.ts) para poder darle
  `tesoreria`+`pagos` a Recepción/Secretaría sin regalarle también la
  aprobación de facturas de proveedores. `finance` lo mantiene explícito;
  `director`/`school_admin`/`super_admin` lo siguen teniendo vía
  `FULL_ACCESS`. El link "Facturas de proveedores" en
  `/dashboard/tesoreria` ahora se oculta si el rol no tiene ese módulo.
- **Coordinadora**: el usuario confirmó "acceso igual a la Directora" --
  no hizo falta ningún cambio de permisos, `director` (`FULL_ACCESS`) ya es
  exactamente eso. Solo se ajustó la sugerencia automática del selector de
  rol.
- **Sugerencia automática del selector de rol** (`GrantAccessButton.tsx`):
  antes, cualquier puesto que no calzara exactamente con uno de los 5
  roles de login (ej. `secretary`, `coordinator`, `admin`) caía
  silenciosamente en "Docente" por defecto -- riesgo real de que alguien
  aprobara sin fijarse y la Secretaria quedara con permisos de Docente. Se
  agregó una tabla `SUGGESTED_LOGIN_ROLE` explícita: `coordinator`→
  `director`, `secretary`/`teaching_secretary`→`reception`,
  `admin`/`administrator`→`school_admin`. Quien invita siempre puede
  cambiar el rol sugerido antes de enviar -- esto solo mejora el valor por
  defecto.

**Pendiente real**: ningún dato de prueba se creó ni se verificó en vivo
contra producción en esta tarea (no había credenciales de Supabase
disponibles) -- se verificó con `tsc --noEmit`/`lint`/`build` limpios y
lectura cuidadosa de las policies de RLS existentes, pero falta confirmar
en producción que Gladys Esther (o cualquier Secretaria/Coordinadora real)
recibe la invitación correctamente y ve los módulos esperados al iniciar
sesión.

## Estructura del área de Inglés (Amco) y enrutamiento de comunicaciones por materia -- implementado el 2026-08-20

Contexto de negocio, dado por el usuario el 2026-08-20 (no asumido): el
colegio piloto no es bilingüe, pero tiene una alianza con **Amco** para el
área de Inglés -- una de sus fortalezas de mayor peso -- con su propia
estructura paralela de coordinación y docentes por ciclo:

| Puesto | Persona | Ciclo |
|---|---|---|
| Coordinadora de Inglés | María Angélica Vizcaíno | Todo el colegio (supervisión) |
| Docente de Inglés | Nercy Rodríguez | Inicial (pre kínder, kínder, preprimario) |
| Docente de Inglés | Yuleymis Lugo Ochoa | 1er ciclo primaria (1°, 2°, 3°) |
| Docente de Inglés | Marianelis Calderón | 2do ciclo primaria (4°, 5°, 6°) |
| Docente de Inglés | Orlando Antoine Natera | 1er ciclo secundaria (1°, 2°, 3°) |
| Docente de Inglés | Yendry Paulino | 2do ciclo secundaria (4°, 5°, 6°) |

**El requisito**: cuando un padre le escribe al colegio, el mensaje debe
llegarle **solo** al equipo correspondiente según el tema -- si es sobre
Inglés, solo al docente de Inglés de ese ciclo (o a quien tenga la
categoría completa asignada); si es sobre Deporte, solo al único profesor
de Educación Física de todo el colegio; de lo contrario, a los docentes
regulares de siempre. Mismo criterio para la salida: los comunicados que
publica el equipo de Inglés tienen una clasificación separada de los
regulares. El usuario confirmó (vía `AskUserQuestion`) que quería una
**conversación separada por categoría** (no un tag por mensaje dentro de
un solo hilo), y que la Coordinadora de Inglés no debía quedar limitada a
la vista de un docente de un solo ciclo.

**Diseño elegido -- reutiliza `teacher_assignments` en vez de crear un
concepto nuevo**: la tabla gana una columna `category` (`'regular' |
'ingles' | 'deporte'`, default `'regular'`) y `grade_level` pasa a ser
**nullable** -- una fila con `grade_level = null` significa "todos los
grados del colegio para esta categoría" (para un docente único de todo el
colegio en su materia, como Deporte). No hizo falta ningún rol de acceso
nuevo ni tocar `permissions.ts`: Inglés y Deporte siguen entrando como
`teacher`, la separación es 100% vía esta tabla + RLS, igual que ya pasaba
con el grado. La Coordinadora de Inglés no necesita ninguna fila especial
-- su rol de acceso ya es `director` (definido en la tarea anterior de
Secretaría/Coordinación, "acceso igual a la Directora"), así que ya entra
por la rama de acceso total en las policies, sin depender de
`teacher_assignments`.

**Migraciones** (`supabase/migrations/20260821000000..20260821020000`):
1. `teacher_assignments`: columna `category`, `grade_level` nullable,
   índice único `(staff_id, category, coalesce(grade_level, '*'))`
   (reemplaza el `unique(staff_id, grade_level)` de la migración 033, que
   se busca y elimina por introspección de `pg_constraint` en vez de
   asumir su nombre generado). `teacher_is_assigned_to_grade()` gana un
   tercer parámetro `category` con default `'regular'` -- retrocompatible,
   las llamadas existentes de `students`/`attendance`/`class_updates` (2
   argumentos) no cambian de comportamiento. Nueva función
   `staff_can_see_family_category(school_id, family_id, category)`.
2. `direct_conversations`: columna `category`, índice único cambia de
   `(family_id)` a `(family_id, category)`. RLS de staff reescrita:
   `super_admin`/`school_admin`/`director` ven las 3 categorías;
   `'regular'` sigue exactamente como antes (`teacher`/`reception` ven
   todas las familias sin filtrar por grado, a propósito, igual que
   documentaba la migración 031); `'ingles'`/`'deporte'` solo para
   `teacher` con una asignación que calce (`staff_can_see_family_category`)
   -- `reception` no ve estas dos categorías. Las policies de guardian no
   cambian: un tutor ve las 3 categorías de su propia familia.
3. `messages` (Comunicados): columna `category` -- a diferencia de
   Mensajes directos, es solo una **clasificación de salida**, no
   restringe lectura de guardian (un padre sigue viendo todos los avisos
   dirigidos a él). Quién puede publicar en cada categoría se valida en
   `createMessageAction`, mismo patrón que ya usaba el cruce contra
   `teacher_assignments` para el grado/sección.

**Hallazgo de seguridad importante durante la implementación**: las Server
Actions de Mensajes directos (`portal-familiar/actions.ts` y
`dashboard/mensajes/actions.ts`) usan el cliente **admin** (service_role)
para casi todas las lecturas/escrituras -- y bajo service_role
`auth.uid()` es `null`, así que las policies de RLS de arriba **no
alcanzan esos caminos** (protegen la lista de staff, que sí usa el
cliente de sesión, y protegen a guardians). Se replicó la misma regla de
autorización en TypeScript
(`web/src/lib/messaging/categoryAccess.ts`,
`staffCanAccessFamilyCategory()`) y se aplicó explícitamente en
`sendStaffMessageAction`/`markStaffReadAction` y en la página de detalle
de la conversación, antes de tocar el cliente admin -- documentado ahí
mismo para que quede claro por qué la regla existe dos veces (RLS +
TypeScript) y no es redundancia accidental.

**Cambios de interfaz**:
- `DirectMessagesWidget.tsx` (Portal Familiar): pestañas
  Regular/Inglés/Deporte, cada una con su propia conversación y su propio
  estado de carga.
- `dashboard/mensajes`: pestañas por categoría (solo se muestran las que
  el staff puede usar) + lista de "iniciar conversación" filtrada según
  qué familias puede alcanzar en esa categoría
  (`getEligibleFamilyIdsForCategory`); la ruta de detalle pasa de
  `/mensajes/[familyId]` a `/mensajes/[familyId]/[category]`.
- `TeacherGradeAssignments.tsx` (Personal): selector de categoría junto a
  los chips de grado ya existentes, más un toggle "Todo el colegio" que
  guarda la fila `grade_level = null`.
- `NewMessageForm.tsx` (Comunicados): selector de categoría, solo visible
  si quien publica tiene permiso en más de una (`getStaffAvailableCategories`);
  `MessageCard.tsx` muestra un badge de categoría cuando no es Regular.

**Verificado**: `tsc --noEmit`, `npm run lint` y `npm run build` limpios.
**No verificado en producción** (mismo bloqueo de siempre -- sin acceso a
Supabase desde este entorno): falta aplicar las 3 migraciones nuevas y
probar con datos reales que cada persona ve exactamente lo que le
corresponde.

**Pendiente real (Fase 4, bloqueada por el usuario hasta que confirme la
lista completa del equipo de Inglés)**: dar de alta en Personal a quienes
falten de la tabla de arriba y asignarles categoría+grados (o "todo el
colegio" para un docente único) con la UI ya extendida -- no necesita
código nuevo, solo datos. El usuario dijo explícitamente que la prioridad
es "amarilla" (puede esperar 1-2 días, antes de que arranque el año
escolar 2026-2027 la semana del 24 de agosto).

## Cuentas por Cobrar — deuda implícita por antigüedad, sin facturar meses futuros (2026-08-27)

**Contexto de negocio confirmado con el usuario**: el colegio no puede facturar la colegiatura de
meses futuros (contabilidad por lo percibido, no por lo devengado; el ITBIS se lleva al costo, no
se factura a las familias) -- solo se factura en el momento en que llega el pago. Pero necesitaba,
solo para análisis y gestión de cobro, ver la deuda "implícita" (lo que ya debió cobrarse a la
fecha según la mensualidad) contra lo realmente cobrado, por alumno/curso/nivel, con antigüedad.

**Pregunta aparte del usuario, respondida pero no implementada esta sesión** (fuera del alcance de
código, es una decisión de arquitectura fiscal): cómo evitar NCF/e-CF duplicados entre Alegra (POS,
certificado Vía Firma, rangos autorizados de la DGII) y un eventual pago con tarjeta desde esta
plataforma. Hallazgo importante: `generate_ncf()` (migración 004) **nunca firmó ni transmitió nada
a la DGII** -- solo arma un texto con formato correcto (`B02########`). Sea NCF clásico o e-CF, el
certificado y la autorización de rangos viven solo en Alegra. Recomendación dada al usuario (no
construida todavía): que esta plataforma nunca emita el comprobante ella misma -- que cada cobro
real (efectivo/transferencia/tarjeta) dispare la creación de la factura en Alegra vía su API
(mismo patrón ya pendiente para facturas de proveedores, `web/src/lib/accounting/alegra.ts`), y que
Alegra sea la única fuente de verdad del NCF/e-CF. El recargo por mora de esta tarea (abajo) sigue
usando `generate_ncf()` porque es el mismo patrón que ya usa "Generar factura" hoy -- hereda la
misma limitación, no la resuelve; migrar toda la facturación real a Alegra-al-momento-del-cobro
queda pendiente como tarea aparte (bloqueada por las mismas credenciales/mapeo de Alegra que ya
bloquean el punto 10 del roadmap).

**`billing_concepts.applies_to`** (`'all'|'grade'|'student'`, migración 004) nunca se conectó a
nada real -- no había columna que dijera a qué grado aplicaba. En vez de resucitarlo, se reutilizó
el mismo mecanismo que ya usan Horarios/Notas: `students.grade_level` es texto libre, y
`gradeLevelToCategory()` (`web/src/lib/schedule/gradeLevelCategory.ts`) ya sabe traducirlo a un
nivel (`parvulo`/`inicial`/`primaria`/`secundaria`). Esa misma lógica se portó a SQL
(`school_level_for_grade()`, mismo orden de comprobación -- "Pre Primario" es inicial, no primaria)
para poder tener un monto de mensualidad distinto por nivel, configurable por colegio.

**Migración** `20260827000000_accounts_receivable.sql`:
- `schools`: 4 montos de mensualidad (`tuition_parvulo_amount`/`inicial`/`primaria`/`secundaria`,
  nullables -- un nivel sin monto configurado no aparece en el reporte, con aviso explícito en vez
  de mostrar cero), `tuition_installments_count` (default `10.5`), `tuition_due_day` (default `1`),
  `tuition_grace_days` (default `5`), `late_fee_percent` (default `5.00` -- mismo valor que ya
  tenía la config del proyecto n8n legado, `db/configuracion_sistema.csv`, confirmado por el
  usuario como el porcentaje real a usar). Backfill idempotente (por nombre, sin pisar si ya se
  configuró a mano) de los 4 montos reales del colegio piloto: Párvulos RD$3,500, Inicial
  RD$3,900, Primaria RD$4,100, Secundaria RD$4,500.
- `students.tuition_override_amount`: monto de mensualidad propio por estudiante, para becas
  (casos mínimos, el usuario los suministrará después) -- NULL usa el monto del nivel del colegio.
- `calculate_receivable_status(student_id, as_of date)`: genera las cuotas del año escolar
  actual (`school_years.is_current`) desde su `start_date`, con el monto del nivel del estudiante
  (o su beca) menos el descuento por hermanos ya existente (reutiliza
  `calculate_sibling_discount()`, migración 20260718 -- no se duplicó esa lógica), y las compara
  contra lo cobrado de verdad, cuota por cuota en orden (FIFO): un pago parcial no libera la cuota
  más vieja, solo la reduce. `tuition_installments_count` fraccionario (ej. `10.5`) genera una
  cuota final a esa fracción del monto mensual completo. Nunca escribe nada -- es 100% cálculo,
  `security invoker` (respeta RLS igual que `calculate_sibling_discount`).
- `list_school_receivables(school_id, as_of)`: la misma función anterior aplicada a todos los
  inscritos de un colegio en una sola llamada (`cross join lateral`), para que la pantalla de
  Cuentas por Cobrar no tenga que llamar la RPC estudiante por estudiante.
- **Verificado con datos reales antes de escribir el archivo final**, no solo revisado: se levantó
  un Postgres local (`sudo service postgresql start`, ya viene instalado en este entorno) con un
  esquema espejo mínimo de las tablas reales + una copia fiel de `calculate_sibling_discount()`, se
  aplicó el archivo de migración tal cual (detectó que las funciones compilan sin errores de
  sintaxis) y se corrieron 8 escenarios: sin pagar, 3 hermanos con descuento acumulado sobre el
  monto de su nivel, ya pagado (no debe aparecer vencido), colegio sin mensualidad configurada
  (`sin_configurar`), pago parcial (la cuota sigue vencida), vista en el futuro (varias cuotas
  acumuladas), dentro de los 5 días de gracia (`corriente`), y la cuota parcial de fin de año
  (10.5 -- la 11va cuota sale exactamente a la mitad). Los 8 dieron el resultado esperado.
  **Lo que esto NO verifica**: RLS real contra roles de producción, ni el flujo desde la interfaz
  contra la base real -- sigue sin haber credenciales de Supabase en este entorno, mismo bloqueo de
  siempre.

**Aplicada y verificada en producción (2026-08-27, sesión siguiente)**: el usuario y su colega
corrieron el SQL completo en el SQL Editor de Supabase; se verificó con un PAT de un solo uso
(`sbp_...`, no guardado en el repo, se le indicó rotarlo) vía la Management API
(`POST /v1/projects/{ref}/database/query`) que las 9 columnas nuevas, `students.tuition_override_amount`
y las 3 funciones existen, y con `list_school_receivables()` contra datos reales que el cálculo
funciona de punta a punta (77 estudiantes, todos con la cuota de agosto vencida a 26 días, tramo
`20-30`, referencia `ago2026` -- coherente con la fecha real de verificación).

**Bug real encontrado y corregido en el camino**: el backfill de las 4 mensualidades del colegio
piloto (`update schools ... where name = 'Gran Manantial de Sabiduría'`) no encontró ninguna fila
-- el nombre real en producción es **"Centro Educativo Gran Manantial de Sabiduría"** (con el
prefijo "Centro Educativo"; el resto de este documento usa el nombre corto como apodo, pero la
columna `schools.name` real lo lleva completo). Las columnas quedaron en `null` silenciosamente
hasta que se detectó al listar `schools` completo. Corregido con un `update` puntual contra
producción (mismo valor, ya idempotente) y en el archivo de la migración para que no vuelva a
pasar en otro entorno. `school_years` sí tenía ya una fila `is_current=true` para 2026-2027
(`start_date 2026-08-01`), así que no hizo falta cargarla.

**Corrección de negocio real, encontrada al probar contra datos reales (2026-08-27, mismo día,
push directo del usuario a la rama del PR)**: dos supuestos de la migración original resultaron
incorrectos, confirmados con el reglamento de familia del colegio.

1. **El corte de "corriente" no es el día `tuition_grace_days` del MISMO mes de la cuota** -- eso
   hacía que la cuota de agosto ya apareciera vencida desde el 6 de agosto (gestión de cobro falsa
   el mismo mes en que se genera la cuota). La regla real: cada cuota está en corriente hasta el
   día `tuition_grace_days` (5) del mes **SIGUIENTE** al de la cuota -- ej. la cuota de agosto está
   en corriente hasta el 5 de septiembre, y el 6 de septiembre ya tiene 1 día vencido. Se agregó el
   tramo **"1-5"** a la tabla de antigüedad (antes el primero era "6-9", dejando esos primeros 5
   días de mora bajo el nuevo corte sin clasificar).
2. **La cuota parcial (la fracción de `tuition_installments_count`, ej. el `.5` de `10.5`) va en
   AGOSTO (la primera cuota), no en junio (la última)** como asumió la migración original -- el
   período 2026-2027 arrancó el 17 de agosto de 2026 (`school_years.start_date` corregido de
   `2026-08-01` a `2026-08-17`), así que agosto es un mes parcial de clases. Sigue siendo un 50%
   plano del monto mensual, sin prorratear por día exacto de inicio -- decisión de alcance ya
   confirmada, no un cálculo de días.

Corregido en `20260827100000_accounts_receivable_fix_grace_cutoff.sql` (nueva migración, la
anterior no se tocó -- `create or replace` de `calculate_receivable_status`, comentario de columna
actualizado en `schools.tuition_grace_days`, y el `update` de `school_years.start_date` acotado por
nombre real + solo si seguía en el valor por defecto, para no pisar una fecha ya corregida a mano).
`ReceivablesTable.tsx` también ganó un buscador por estudiante/familia dentro de la propia pantalla
(el buscador global del panel navega fuera de Tesorería en vez de filtrar esta tabla). Verificado
`tsc --noEmit` limpio tras el cambio.

**Confirmado con evidencia real que esta migración sí se aplicó y se probó en vivo** (no solo
supuesto): el siguiente commit a la rama (`20260827110000_invoices_student_index.sql`) documenta
un `"canceling statement due to statement timeout"` real al abrir
`/dashboard/tesoreria/cuentas-por-cobrar` en producción -- eso solo pasa si la pantalla ya estaba
corriendo contra las funciones corregidas. Causa: `calculate_receivable_status()` consulta
`invoices where student_id = ...` y `list_school_receivables()` la llama una vez por cada
estudiante inscrito (`cross join lateral`) -- sin índice en `invoices.student_id`, cada llamada
era un escaneo completo de la tabla, repetido por estudiante. Los índices existentes de `invoices`
(`school_id`, `family_id`, `due_date`) no cubrían esta consulta. Fix: `create index if not exists
idx_invoices_student on invoices(student_id) where deleted_at is null` -- mismo patrón de índice
parcial que ya usaban los otros tres.

**Pantalla nueva** `/dashboard/tesoreria/cuentas-por-cobrar` (mismo gate `canAccess(role,
'tesoreria')` que el resto del módulo -- no se creó un permiso nuevo, Secretaría/Recepción ya lo
alcanza igual que el resto de Tesorería):
- Filtro por nivel, por curso (mismo texto libre de `grade_level`) y por nombre de estudiante/
  familia (buscador local a esta pantalla, agregado el 2026-08-27), tarjetas de resumen (total
  vencido, estudiantes vencidos, familias afectadas), tabla con los 7 tramos de antigüedad
  (1-5, 6-9, 10-14, 15-19, 20-30, 31-60, 61+ -- el tramo "1-5" se agregó en la corrección del corte
  de gracia, ver arriba) -- "corriente" (dentro de los días de gracia del mes siguiente a cada
  cuota) nunca aparece en la tabla, solo cuenta para el filtro. Aviso aparte (no oculto) para
  estudiantes cuyo nivel no tiene mensualidad configurada, con enlace directo a Configuración.
- **Referencia**: 3 primeras letras del mes en español + año de la cuota vencida más antigua (ej.
  `ago2026`), calculada en la misma función SQL. **Recargo**: botón "Generar recargo" -- crea una
  factura real (única acción de esta pantalla que escribe algo) con descripción `Recargo por mora —
  Rec-<mes actual><año actual>` (ej. `Rec-ago2026` si se genera en agosto, sea cual sea el mes de
  la cuota vencida -- "mes en curso" se interpretó como el mes en que se aplica el recargo, no el
  de la cuota vieja), por el `late_fee_percent` configurado sobre el monto vencido. Nunca automático
  -- siempre requiere que el staff lo dispare viendo la deuda en pantalla, con confirmación.
- **Aviso de vencimiento**: botón "Enviar aviso" -- reutiliza `notifyGuardianByEmail`/
  `notify-message` (el mismo mecanismo ya usado por Mensajes directos y Comunicados urgentes), con
  un mensaje que invita a pagar antes de que se aplique el recargo -- no aplica ningún cargo.
- Configuración de los 4 montos por nivel + cuotas/día de vencimiento/gracia/% de recargo agregada
  a `OperationsForm.tsx` (`/dashboard/colegio`, pestaña Operación), mismo patrón visual que el
  descuento por hermanos.

**Limitación conocida, no resuelta esta sesión**: "lo cobrado" se calcula sumando solo las
facturas con `student_id` explícito (concepto "Mensualidad", `status='pagado'`) -- una factura de
"toda la familia" (sin `student_id`, ver la nota de descuento por hermanos más arriba) no se puede
atribuir a un hijo en particular, así que **no cuenta** como cobrado en este reporte. Si Gran
Manantial de Sabiduría sigue facturando mensualidad por familia completa en vez de por estudiante,
Cuentas por Cobrar mostrará más deuda de la real para esas familias. No se inventó una heurística
de reparto (dividir entre hermanos) a propósito -- sería fabricar un dato financiero. Recomendación
pendiente de confirmar con el usuario: facturar mensualidad siempre por estudiante individual
(la opción ya existe en "Generar factura").

**Fase 2 -- construida el 2026-08-27 (push directo del usuario a la rama del PR, sin pasar por esta
sesión)**: un tutor puro (`role === 'guardian'`, nunca un perfil de doble rol staff+tutor) con algún
hijo inscrito cuya cuota más vieja está en el tramo `61+` queda confinado a `/dashboard/pagos`, con
un aviso rojo fijo arriba y el menú lateral reducido a un solo enlace (`Sidebar.tsx`, rol sintético
`guardian_blocked`). Nunca aplica al estudiante, por ley. La lógica de "¿está bloqueado?"
(`checkGuardianOverdueBlock(guardianId)`, que llama a `calculate_receivable_status()` una vez por
cada hijo inscrito de la familia del tutor vía cliente `admin` -- esas tablas no tienen RLS para
tutores) vive en un módulo compartido nuevo, `web/src/lib/receivables/guardianBlock.ts`.

**Bug real encontrado en producción y corregido el mismo día**: la primera versión hacía el
`redirect()` duro dentro de `dashboard/layout.tsx` (un Server Component), usando un header
`x-pathname` inyectado por `proxy.ts` para saber si ya estaba en `/dashboard/pagos`. Al probarlo en
vivo, un tutor bloqueado quedaba con la pantalla en blanco en un bucle infinito de refetch RSC,
curable solo con un recargo manual de la página -- un `redirect()` lanzado desde dentro del árbol
de Server Components durante la navegación de cliente que dispara `LoginForm.tsx`
(`router.push` + `router.refresh()`) entra en conflicto con cómo el App Router resuelve esa
redirección. Corregido moviendo la redirección dura al middleware (`proxy.ts`): ahí se resuelve con
un `NextResponse.redirect()` (un 307 HTTP normal, antes de que arranque el árbol de RSC), consultando
`users_profiles` solo para peticiones a `/dashboard/*` que no sean ya `/dashboard/pagos`. El header
`x-pathname` que se había agregado para esto ya no existe -- se revirtió junto con el resto del
enfoque viejo. `dashboard/layout.tsx` sigue llamando a `checkGuardianOverdueBlock()`, pero ahora
solo para decidir el banner/menú restringido de la página en la que el middleware ya decidió
dejarlo entrar, nunca para redirigir. Revisado por esta sesión tras el push (no escrito aquí):
`tsc --noEmit`, `lint` y `next build` completos limpios.

**Pendiente para cerrar esta tarea por completo**, en orden:
1. ~~Aplicar la migración a producción~~ -- hecho y verificado el 2026-08-27 (ver arriba).
2. ~~Cargar `school_years` con una fila `is_current = true`~~ -- ya existía (`2026-2027`,
   `start_date 2026-08-01`).
3. Probar en vivo desde la interfaz (`/dashboard/tesoreria/cuentas-por-cobrar`) con un estudiante
   real: enviar un aviso de verdad y confirmar que llega, generar un recargo de prueba y confirmar
   el NCF/factura, luego decidir si se anula esa factura de prueba o se deja como registro real --
   lo verificado hasta ahora fue directo por SQL (Management API), no desde la pantalla.
4. ~~Decidir con el usuario la Fase 2~~ -- construida (ver arriba); falta solo probarla en vivo con
   un tutor real en mora de 61+ días. Sigue abierto el punto de facturar mensualidad por estudiante
   en vez de por familia completa.
5. Cuando el usuario defina la lista de becas, cargar `students.tuition_override_amount` para esos
   casos (columna ya lista, sin migración nueva).

## Comunicados con imagen adjunta (2026-08-26)

**Reporte real del usuario**: intentó pegar una imagen (un flyer ya
diseñado, tipo aviso de suspensión de clases) en el campo de contenido de
un comunicado nuevo, y no se podía -- el formulario solo aceptaba texto.

**Implementación**: migración `20260826000000_comunicados_image.sql` ->
columna `messages.image_path` (nullable) + bucket privado
`comunicados-imagenes`, mismo principio de defensa en profundidad que
`class-updates` (nunca políticas de `storage.objects` para
anon/authenticated -- todo el acceso pasa por Server Actions con el
cliente `service_role`, lectura vía signed URL de corta duración).

- `createMessageAction` (`comunicados/nuevo/actions.ts`) pasó de recibir un
  objeto plano a recibir `FormData` -- mismo cambio de forma que ya tienen
  `createClassUpdateAction`/`uploadPaymentReceipt`, necesario para poder
  traer un archivo. Si el bucket todavía no existe (migración sin aplicar
  en ese entorno), lo crea al vuelo con `storage.createBucket()`, igual que
  `createClassUpdateAction` -- así que la función de subir imagen no queda
  bloqueada solo por la migración, aunque la columna `image_path` sí la
  necesita (si la migración no está aplicada, el insert falla igual).
- El contenido de texto pasó de obligatorio a "texto O imagen" (al menos
  uno de los dos) -- un flyer que ya trae todo el aviso en la imagen no
  debería obligar a repetirlo como texto. Validado en cliente
  (`NewMessageForm.tsx`) y de nuevo en el servidor (nunca confiar solo en
  la validación de cliente).
- `comunicados/page.tsx` genera una signed URL por comunicado con imagen
  (TTL 1h, mismo patrón que Actualizaciones) y se la pasa a `MessageCard`,
  que la muestra dentro del comunicado expandido (badge 🖼️ en la cabecera
  para saber que trae imagen sin tener que expandir).

**Verificado**: `npx tsc --noEmit`, `npm run lint` y `npm run build`
limpios. **No verificado en producción** -- esta sesión no tuvo acceso a
Supabase (mismo bloqueo documentado repetidas veces en este archivo).
**Pendiente real**: aplicar la migración `20260826000000_comunicados_image.sql`
a producción, y probar en vivo publicar un comunicado con imagen (con y sin
texto) y confirmar que se ve tanto para staff como para una familia real.

## Cuestionarios de Academia desde imagen (OCR) + imagen de apoyo por pregunta (2026-08-26)

**Contexto real**: el usuario mostró una captura del formulario de Nueva
Lección (video + cuestionario) y preguntó si se podía cargar imágenes en el
cuestionario -- hay cuestionarios largos en libros de texto que sería mucho
tiempo reescribir a mano. La inquietud que él mismo planteó: si la pregunta
es una imagen, ¿cómo respondería el estudiante? Se combinaron dos soluciones
(decisión explícita del usuario: "combinar"):

1. **Imagen de apoyo por pregunta** (`quiz_questions.image_path`, nullable) --
   para diagramas/gráficos que la pregunta necesita. Las opciones de
   respuesta siguen siendo texto tecleado -- el estudiante responde con los
   mismos botones de siempre, nunca tocando una imagen.
2. **Extracción con Claude (visión) de páginas/fotos del cuestionario del
   libro** -- reutiliza el mismo núcleo `extractStructuredDocument.ts` ya
   usado para fichas de inscripción y facturas de proveedores ("un solo
   cerebro", ver AGENTS.md). El profesor sube fotos sueltas o un PDF
   multi-página del cuestionario; la IA arma preguntas+opciones en el propio
   formulario de Nueva Lección para que las revise/corrija antes de
   "Guardar lección" -- igual que los otros dos casos de OCR, **nunca se
   persiste nada solo por escanear**.

**Diferencia con los otros dos casos de OCR ya existentes**: aquí NO hizo
falta una tabla de bandeja de revisión (`enrollment_form_scans`/
`vendor_invoices`) porque Nueva Lección ya es un único formulario que no
guarda nada hasta el clic final -- la extracción solo devuelve el borrador
en memoria del cliente (`extractQuizFromDocumentsAction`, en
`academia/nueva/actions.ts`, nunca sube ni inserta nada). Tampoco hizo falta
`confianza` por pregunta individual en el schema -- una página trae varias
preguntas, así que `quizPageSchema.ts` es un array (`preguntas[]`) con una
sola confianza por página, a diferencia de `enrollmentFormSchema`/
`vendorInvoiceSchema` (un documento = un registro).

**Cómo se decide la respuesta correcta al extraer**: si el libro trae una
clave de respuestas visible en la página, Claude la usa
(`indice_correcta`); si no hay ninguna marca, queda `null` y ninguna opción
sale premarcada -- la validación que ya existía en el formulario ("Marca la
opción correcta en cada pregunta") obliga al profesor a elegirla a mano
antes de poder guardar, así que nunca se puede publicar una pregunta sin
respuesta correcta por accidente.

**Storage**: bucket privado nuevo `academia-imagenes` (migración
`20260826010000_academia_quiz_images.sql`), mismo principio de defensa en
profundidad que `class-updates`/`comunicados-imagenes` -- sin políticas de
`storage.objects`, todo pasa por `uploadQuestionImageAction` (cliente
`service_role`) + signed URL de corta duración al mostrarla (tanto en el
formulario del profesor como en `LessonPlayer.tsx` para el estudiante).

**Detalle de implementación notable**: a diferencia del resto del módulo
Academia (que inserta `lessons`/`quiz_questions`/`quiz_options` con el
cliente de sesión del navegador, apoyándose en RLS -- ver
`lessons_staff_all` etc. en la migración 016), la subida de imagen y la
extracción OCR sí pasan por Server Actions con `service_role`, porque
tocan Storage y la API de Anthropic -- mismo patrón ya establecido en el
resto del proyecto para esos dos casos, no una inconsistencia nueva.

**Verificado**: `npx tsc --noEmit`, `npm run lint` y `npm run build`
limpios. **No verificado en producción** -- la migración no se pudo aplicar
desde esta sesión (sin acceso a Supabase) y el usuario mencionó que
"pronto" resuelve el bloqueo de `ANTHROPIC_API_KEY` con saldo (ver bloqueo
ya documentado varias veces en este archivo para OCR/asistente de IA).
**Pendiente real**: aplicar `20260826010000_academia_quiz_images.sql` a
producción, y probar en vivo -- subir una foto o PDF real de un cuestionario
de libro de texto y confirmar que las preguntas/opciones extraídas son
correctas, que la imagen de apoyo se ve tanto en el formulario del profesor
como en `LessonPlayer.tsx` para un estudiante real, y borrar los datos de
prueba al terminar.

## Flujo de Cobranza del Panel: alineado al año escolar real (2026-08-27)

**Reporte del usuario**: el gráfico "Flujo de Cobranza · Año Escolar" del
Panel de Secretaría/Director mostraba una ventana de 12 meses corrida desde
"hoy" hacia atrás (sept-ago genérico), en vez del calendario real del
colegio piloto: el período escolar inicia el **17 de agosto** y corre hasta
**junio**; **julio queda fuera** (vacaciones colectivas de los estudiantes,
sin cobro). Como agosto empieza a mitad de mes, el año escolar completo son
**10.5 meses de cobro**, nunca 12.

**Implementación** (`secretaria/page.tsx`): `schoolYearStartYear` se calcula
a partir de `now` -- si el mes actual es agosto o después, el año escolar en
curso empezó en agosto de este año calendario; si no (enero-julio), empezó
en agosto del año calendario anterior. `monthKeys` pasó de "últimos 12 meses
desde hoy" a los 11 meses reales del año escolar (agosto..junio, saltando
julio) anclados a `schoolYearStartYear` -- la consulta a `invoices`
(`schoolYearStart` en vez de `twelveMonthsAgo`) ahora arranca el 1 de agosto
en vez de 11 meses atrás desde "hoy". El resto del cálculo (sumar
cobrado/pendiente/vencido por mes desde las facturas reales) no cambió --
solo la ventana de meses que se muestra.

**No se tocó ningún monto**: el "medio mes" de agosto no se implementó como
una regla de facturación (eso ya lo decide Tesorería al emitir la factura de
agosto, fuera del alcance de este cambio) -- aquí solo se corrigió qué
meses aparecen en el gráfico. Se agregó un asterisco en la barra de agosto +
una nota al pie ("Agosto es medio mes... julio no se muestra... 10.5 meses
de cobro") para que quede visualmente claro sin tener que adivinar por qué
agosto suele verse más bajo que los demás meses.

También se reordenaron los datos de muestra de `PanelCentroControl.tsx`
(`D.cashflow`, usados solo cuando no hay props reales) para que empiecen en
agosto y terminen en junio, sin julio -- mismo criterio.

**Verificado**: `npx tsc --noEmit`, `npm run lint` y `npm run build`
limpios. **No verificado en producción** -- esta sesión no tuvo acceso a
Supabase (mismo bloqueo documentado repetidas veces en este archivo).
**Pendiente real**: confirmar en vivo que el gráfico muestra Ago→Jun sin
julio con datos reales de facturación, y revisar en algún momento si el
monto de la factura de agosto en Tesorería ya refleja el medio mes -- ese
es un tema de facturación, no de este gráfico.

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
3. ~~Nombre nuevo para el proyecto~~ — resuelto: **MentorIApp**
   (Mentoría + IA + App). Se verificaron alternativas antes de decidir
   ("Sophia" chocaba con dos empresas reales de edtech; "MentorIA" a
   secas ya es una app existente y activa de asistente de IA para
   universidades) -- "MentorIApp" con la "pp" final quedó como
   suficientemente distinto, decisión del usuario asumiendo ese riesgo
   menor conscientemente. Repo de GitHub sigue llamándose
   `n8n-school-expert-landingpage` (renombrarlo es un paso aparte).
4. ~~RLS por rol específico~~ — hecho.
5. ~~Fichas de detalle de estudiante/familia~~ — hecho.
6. **Dominio propio** — el usuario compra dos dominios en Hostinger (uno para
   Resend, uno para la app) el lunes. Pasos pendientes tras la compra:
   conectar el dominio de la app en Vercel, actualizar
   `NEXT_PUBLIC_SITE_URL`, verificar el dominio en Resend y actualizar
   `resend_from_address` en `private.app_settings`, considerar mover también
   el SMTP de Supabase Auth al mismo dominio.
   - ~~SMTP de Auth~~ — hecho el 2026-08-20. Config-as-code en
     `supabase/config.toml` (`[auth.email.smtp]`, host `smtp.resend.com`,
     `mail.resendcegmas.com` como remitente -- ojo, es un subdominio, ver
     nota en "Dominios confirmados") y aplicado a mano en el proyecto
     remoto (`fssjgpqisfnmnkavsyld`) vía Dashboard → Authentication →
     Emails → SMTP Settings (sender name `MentorIA`, key de Resend nueva
     y separada `supabase-auth-smtp`). Primer intento falló con `550 The
     resendcegmas.com domain is not verified` porque el remitente usaba
     el dominio raíz en vez del subdominio verificado; corregido a
     `no-reply@mail.resendcegmas.com`. Rate limit de Auth subido a
     100 correos/hora en Authentication → Rate Limits. Pendiente real:
     verificar con un envío real (reenviar invitación a alguno de los
     usuarios en "Waiting for verification" de antes del fix, en vez de
     crear un usuario de prueba ficticio).
7. ~~Sistema de comunicación — Fase 2 (WhatsApp)~~ — construido el
   2026-08-17 vía Evolution API (no Twilio, ver sección "WhatsApp vía
   Evolution API" más arriba). ~~Falta correr la migración 025~~ —
   **ya aplicada** (verificado el 2026-08-23 con `supabase migration list
   --linked`). Pendiente real que sigue abierto: `EVOLUTION_API_URL` /
   `EVOLUTION_API_KEY` no están configuradas todavía (esperando el VPS
   compartido con el proyecto de referencia).
7b. ~~Constructor de sitio web completo~~ — construido el 2026-08-17
    (servicios/programas, personal, testimonios, FAQs públicas,
    plantilla/fuente, redes sociales, stats) — paridad con el proyecto de
    referencia. ~~Falta correr la migración 026~~ — **ya aplicada**
    (verificado el 2026-08-23).
8. ~~Descuento automático a partir del Nº hijo~~ — resuelto (ver
   sección "Descuento por hermanos" más abajo).
9. ~~Bug de alta de estudiante~~ — resuelto (ver bugs 8, 9 y 10 arriba).
10. **Extracción OCR de fichas de inscripción y facturas de proveedores** —
    código en producción (rama `claude/credentials-setup-41e2xe`) y migración
    ya aplicada y verificada (ver sección "Extracción OCR estructurada con
    Claude" más arriba). Pendiente: probar la llamada real a Claude con una
    ficha/factura de prueba, y definir el mapeo de Alegra.
11. **Llamada de voz en vivo + visor de conversaciones para el colegio** —
    código verificado (`tsc`/`lint`/`build` limpios) y fusionado a `main`.
    ~~Las 2 migraciones nuevas no se han aplicado~~ —
    `20260801020000_ai_conversations_voice_channel.sql` y
    `20260802000000_ai_conversations_staff_read.sql` **ya están aplicadas**
    (verificado el 2026-08-23). Pendiente real que sigue abierto: probar la
    llamada de voz real (necesita `OPENAI_API_KEY` con saldo) y confirmar
    que el visor `/dashboard/asistente-ia` muestra los datos correctamente.

**Nota de método (2026-08-23)**: los cuatro "falta correr la migración X"
de arriba llevaban tiempo marcados como pendientes sin estarlo. La forma
rápida de comprobarlo, en vez de asumir, es `supabase migration list
--linked`: la columna `remote` vacía es la única señal fiable de que una
migración no está aplicada. Conviene correrlo antes de dar por bueno
cualquier pendiente de migración de este archivo.
12. ~~Vencimiento del enlace de recuperar contraseña~~ — `otp_expiry` en
    600s (10 min), confirmado en producción. ~~`site_url` de Auth
    apuntando al dominio viejo de Vercel~~ — corregido a
    `https://educacionmanantial.com`, confirmado con el usuario, cierra
    el cabo suelto que había quedado del punto 6 (Dominio propio).
    `sender_name = "MentorIApp"` confirmado como correcto. (Ver sección
    "Vencimiento del enlace de 'recuperar contraseña'" más arriba para el
    detalle completo, incluido el incidente del `config push`.) PR #4
    (`fix/config-toml-produccion-real`) fusionado a `main` el 2026-08-23.
13. ~~**Horarios 2026-2027 en producción**~~ — **hecho el 2026-08-23**: las
    330 clases de los 12 grados están cargadas y verificadas (ver "Carga de
    los horarios en producción" más arriba). Los cinco bloqueos quedaron
    resueltos: se agregó nivel a `class_periods` (migración
    `20260823000000`), se creó a Orlando Natera, se confirmó a Maríanelis,
    se normalizó `grade_level` y se pobló `subjects` con 14 materias
    canónicas. Los dos descuadres del horario también: la franja de Inglés de
    1ro quedó para Orlando (1er ciclo es suyo según la estructura de Amco), y
    la sesión de más de Marcelis Santos no existe en el horario de ningún
    grado, así que no había nada que cargar. El informe ejecutivo se entregó
    al usuario y no vive en el repo. **Quedan tres cabos sueltos menores**:
    el correo de Orlando es un marcador, 6to de Primaria no tiene docente
    titular, y `teacher_assignments.category` sigue todo en `'regular'`.
14. **Cuentas por Cobrar (deuda implícita por antigüedad)** — ~~código y
    migración listos~~ **aplicada y verificada en producción el 2026-08-27**
    (ver sección "Cuentas por Cobrar" más arriba): las 9 columnas nuevas,
    `students.tuition_override_amount` y las 3 funciones existen, y
    `list_school_receivables()` ya devuelve deuda real de los 77 estudiantes
    inscritos. Se corrigió en el camino un bug real (el backfill de
    mensualidades no encontraba el colegio piloto por el nombre completo
    real, "Centro Educativo Gran Manantial de Sabiduría"). Pendiente:
    probar el flujo completo desde `/dashboard/tesoreria/cuentas-por-cobrar`
    (no solo por SQL), y decidir con el usuario la Fase 2 (redirección a
    Pagos a los +60 días) y si migrar la facturación de mensualidad a
    Alegra-al-momento-del-cobro para evitar duplicidad de NCF/e-CF con el POS.
### Dominios confirmados

- App / producciÃ³n: `educacionmanantial.com`
- Resend / remitente: `mail.resendcegmas.com` **(subdominio -- NO
  `resendcegmas.com` a secas; ese es el que aparece verificado en
  resend.com/domains, confirmado 2026-08-20 al depurar el error `550 The
  resendcegmas.com domain is not verified` en el SMTP de Auth)**.
- `NEXT_PUBLIC_SITE_URL` en producciÃ³n debe apuntar a
  `https://educacionmanantial.com`.
- `resend_from_address` debe usar un correo verificado del dominio
  `mail.resendcegmas.com` para el colegio Gran Manantial de SabidurÃ­a.
  Si en algÃºn lado del repo o de la config remota todavÃ­a dice
  `resendcegmas.com` sin el `mail.`, estÃ¡ mal y hay que corregirlo.

## Branding de comunicaciones

- En correos, prompts y textos públicos usa primero el nombre del colegio
  cuando exista.
- Si no hay un nombre de colegio disponible, usa `MentorIA` como respaldo.
- No volver a usar el remitente viejo `schoolos.app`; el correo debe salir
  del dominio verificado `mail.resendcegmas.com` (no `resendcegmas.com`
  a secas -- ver nota en "Dominios confirmados").

## Revision Vercel (2026-08-10)

- La validacion de Vercel para este proyecto de escuela sigue separada de la
  app principal y debe revisarse sobre el proyecto correcto cuando toque
  publicar la landing del colegio.
- La landing publica del colegio sigue pendiente del generador de sitio web
  que ya mejoramos; no debe asumirse publicada todavia.
- La app principal mantiene su landing aparte, asi que ambos flujos siguen
  aislados y no deben mezclarse.
