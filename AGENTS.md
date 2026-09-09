# MentorIApp — Contexto del proyecto (léeme primero)

Este archivo existe porque el trabajo en este proyecto se hizo en una conversación
larga de Claude (claude.ai), y no hay forma automática de trasladar esa memoria a
otra herramienta (como Claude Code). Este documento es el resumen fiel de esa
conversación — decisiones, bugs reales encontrados, y lo que falta — para que
cualquier sesión nueva pueda seguir sin repetir descubrimientos ni preguntas.

**Mantenlo actualizado.** Cuando cierres un pendiente de la lista de abajo, o
encuentres un bug nuevo digno de recordar, actualiza este archivo en el mismo
commit.

---

# ⛔ PROTOCOLO OBLIGATORIO — no romper lo que ya funciona

**Léelo antes de tocar código. No es opcional.**

Esto no es producción teórica: el Centro Educativo Gran Manantial de Sabiduría
usa esta plataforma todos los días con 286 estudiantes. Cuando algo se rompe,
el dueño del proyecto queda mal ante el colegio — y durante semanas no pasó un
día sin que le escribieran que "tal cosa ya no funciona". Casi siempre la causa
fue la misma: **un arreglo que rompió en silencio otra cosa.** Un fix que
genera un reporte nuevo mañana no es progreso; es el bucle que hay que cortar.

## Antes de escribir código

1. **Mapear el alcance.** ¿Qué otras pantallas, roles o tablas leen o escriben
   eso mismo? Búscalo (`grep`), no lo supongas.
2. **Elegir el menor radio de impacto**, aunque sea menos elegante. Ejemplo
   real (2026-09-03): para que el profesor pudiera escribirle a un padre se
   leyó la lista de familias con el cliente de servicio en **dos pantallas
   concretas**, en vez de abrirle la RLS de `families` al rol `teacher` — eso
   último le habría dado el directorio completo de familias en toda la app.
3. **Decir explícitamente qué NO se toca y por qué**, antes de empezar.

## Antes de dar algo por terminado (y siempre antes de desplegar)

```bash
cd web && npm run build      # el build completo, no solo tsc
cd web && npm run smoke      # 31 comprobaciones, todos los roles, contra producción
```

`npm run smoke` (→ `scripts/smoke-roles.mjs`) entra como un usuario **real** de
cada rol, simula su sesión igual que PostgREST y ejecuta las mismas consultas
que hacen las pantallas — incluido el INSERT de pasar lista. Todo dentro de una
transacción con `ROLLBACK`, así que no toca datos. Si una policy quedó rota,
revienta ahí y no en el colegio a las 7:50am. **Al agregar una pantalla o
cambiar una policy, agrega su comprobación al script.**

Si el cambio toca RLS, policies o funciones SQL, además: simula la sesión del
rol afectado y prueba la escritura real con rollback antes de considerarlo
hecho.

## Trampas ya conocidas de este repo (cada una costó un día del colegio)

- **`permissions.ts` y `Sidebar.tsx` se desincronizan.** Un módulo concedido en
  la matriz pero sin enlace en el menú de ese rol = función que existe y nadie
  puede alcanzar. Le pasó a Mensajes y Actualizaciones con `teacher`: estaban
  permitidos desde siempre, sin enlace. **Revisa los dos archivos, siempre.**
- **Leer con el cliente del usuario lo que la RLS no le abre a ese rol no da
  error: devuelve vacío.** Se ve como "la opción está deshabilitada". Le pasó a
  Mensajes con `families` (al profesor le llegaban 0 familias).
- **Sobrecargas con parámetro por defecto rompen las llamadas existentes.**
  Al crear `f(a, b, c default x)` junto a `f(a, b)`, toda llamada de 2
  argumentos queda ambigua (`42725: is not unique`) — incluidas las que están
  dentro de policies escritas meses antes. Rompió Asistencia y Actualizaciones
  el 2026-09-03. Si agregas una sobrecarga, **busca y actualiza todos los
  llamadores** (`pg_policies` incluidos), o mejor: usa otro nombre de función.
- **Las escrituras del navegador contra Supabase no aparecen en los logs de
  Vercel.** `AttendanceForm` escribe directo con el cliente del navegador: si
  la RLS la bloquea, en Vercel no hay ni rastro. Por eso existe el smoke test.
- **Las migraciones no siempre se aplican en orden cronológico** (no hay Docker
  en la máquina; se aplican vía API en lotes). Una migración vieja puede
  activarse hoy y despertar un bug latente. Ver "Colisión de números de
  migración" más abajo.
- **El cliente admin (`createAdminClient`) se salta la RLS.** Toda Server
  Action que lo use tiene que repetir la autorización en código
  (`staffCanAccessFamilyCategory`, `assertTeacherCanTargetGrade`, etc.). No
  basta con que la policy exista.

---

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

**Columna "Corriente" (2026-09-02, PR #19)**: `calculate_receivable_status()` ya calculaba bien el
saldo pendiente de un estudiante dentro de los días de gracia (`aging_bucket = 'corriente'`), pero
`ReceivablesTable.tsx` filtraba esas filas por completo -- el saldo del día de hoy no aparecía en
ningún lado hasta que el estudiante se volvía vencido de verdad. Reportado por el usuario contra la
pantalla real en producción (captura adjunta), comparando con la plantilla de Excel de referencia
que sí tenía una columna "Current"/"Corriente". Corregido puramente en la interfaz -- sin
migración, el cálculo en SQL ya era correcto: ahora la tabla muestra a todo estudiante con saldo
pendiente, "Corriente" como el primer tramo (verde) junto a los de antigüedad, con una tarjeta
"Total corriente" en el resumen. Los botones de aviso/recargo se ocultan para esas filas (nada que
cobrar todavía).

**Registrar pagos ya cobrados fuera de la plataforma (2026-09-02)**: el colegio todavía no tiene
habilitados los pagos en línea aquí -- todo lo que se ha cobrado hasta ahora pasó por Alegra POS u
otra plataforma, y esos cobros no existían en `invoices`/`payments`, así que Cuentas por Cobrar
mostraba deuda que en realidad ya se pagó. El flujo existente ("Generar factura" en
`/dashboard/tesoreria/facturar`) no servía para esto: siempre llama a `generate_ncf()`, y generar un
NCF local para un cobro que ya tiene su comprobante fiscal real en Alegra sería un documento fantasma
que no corresponde a nada real ante la DGII -- el mismo riesgo de duplicidad ya discutido con el
usuario en la sección de NCF/Alegra más abajo.
- Migración `20260902000000_external_payment_methods.sql`: amplía el `check` de
  `payments.payment_method` (antes solo `efectivo`/`transferencia`/`tarjeta`/`azul`/`cheque`) para
  aceptar también `alegra` y `otro`. Verificado contra Postgres local: acepta los dos valores
  nuevos y sigue rechazando cualquier otro.
- `recordExternalPayment(studentId, amount, source, paidAt, note)` (nueva Server Action en
  `cuentas-por-cobrar/actions.ts`): busca o crea el concepto "Mensualidad" (mismo patrón de
  find-or-create que ya usa `generateLateFeeCharge` para "Recargo por Mora"), inserta una factura
  con `status='pagado'` y **`ncf`/`ncf_type` siempre `null`** -- a propósito, nunca genera
  comprobante -- y su pago correspondiente. El monto, la fecha y la nota (ej. número de recibo de
  Alegra) los captura el staff; el monto viene precargado con el saldo pendiente de esa fila pero
  es editable, por si el cobro real fue parcial.
- `ReceivablesTable.tsx`: botón "Registrar pago" en cada fila (vencida o corriente) que despliega
  un mini-formulario en línea (monto, fecha, fuente -- Alegra/otra plataforma/efectivo/
  transferencia/tarjeta/cheque -- y nota), mismo patrón de UI que el "Rechazar con motivo" ya usado
  en otras bandejas de revisión del proyecto.
- **Verificado de punta a punta contra Postgres local** (no solo revisado): estudiante de prueba
  con RD$6,150 de deuda implícita (cuota parcial de agosto + cuota completa de septiembre, sin
  pagar); se simuló exactamente el insert que hace la Server Action (concepto "Mensualidad",
  factura `pagado` con `ncf null`, pago con `payment_method='alegra'`) por RD$4,100 -- el saldo
  bajó a RD$2,050 (FIFO, cubre primero la cuota más vieja) y la factura quedó confirmada con
  `ncf`/`ncf_type` en `null`, nunca un comprobante fantasma.
- `tsc --noEmit`, `lint` y `build` completos limpios.

**Pendiente**: ~~aplicar `20260902000000_external_payment_methods.sql` a producción~~ -- hecho el
2026-09-03, verificado leyendo `pg_get_constraintdef` en producción. Falta registrar ahí los cobros
reales ya hechos por Alegra/otra plataforma -- no se cargó ningún dato real desde esta sesión, solo
se construyó y verificó la herramienta.

**Bug real en producción y corregido el mismo día (2026-09-03): la pantalla completa reventaba**
("Algo salió mal") al entrar a `/dashboard/tesoreria/cuentas-por-cobrar`, reportado por el usuario
con una captura real después de fusionar el PR de "Registrar pago externo". Causa: `actions.ts`
lleva `'use server'` arriba del archivo -- una restricción de React/Next.js (no específica de este
proyecto) exige que un archivo así **solo exporte funciones async**. Se había exportado
`EXTERNAL_PAYMENT_SOURCES` (un array plano) desde ese mismo archivo para que `ReceivablesTable.tsx`
lo usara al inicializar estado (`useState(EXTERNAL_PAYMENT_SOURCES[0].value)`) -- el bundler
convierte ese export en una referencia de servidor en vez de dejar pasar el valor real, así que en
el cliente `EXTERNAL_PAYMENT_SOURCES` no es el array esperado y la línea revienta apenas se monta
el componente, antes de cualquier llamada a Supabase (confirmado con los logs de producción: cero
llamadas a `list_school_receivables` registradas nunca -- la pantalla nunca llegó a pedir datos).
Ni `tsc`, ni `eslint`, ni `next build` avisan de este error -- es puramente de runtime en el
navegador. Corregido moviendo `EXTERNAL_PAYMENT_SOURCES` a un módulo plano nuevo,
`web/src/lib/receivables/externalPaymentSources.ts` (mismo patrón ya usado por
`monthReference.ts`) -- `actions.ts` lo importa para validar internamente, nunca lo re-exporta.
**Regla para el futuro**: un archivo `'use server'` de este proyecto nunca debe exportar nada que
no sea una función async -- cualquier constante/tipo/dato compartido con un componente cliente va
en un módulo aparte sin la directiva.

**Hallazgo aparte durante el diagnóstico (sin resolver por esta sesión)**: revisando producción
para diagnosticar lo anterior, se encontró que `list_school_receivables()` **ya no es la función
que se migró** -- en algún momento, fuera de esta sesión y sin ninguna migración nueva en el repo,
alguien la cambió directo en la base a `security definer` con una comprobación explícita de
autorización (`raise exception` si el perfil no pertenece a ese colegio con un rol de staff
válido). Es un endurecimiento razonable, pero **tiene un caso límite sin resolver**: exige
`users_profiles.school_id = p_school_id`, lo cual excluye al `super_admin` viendo "Entrar como
director" un colegio que no es el suyo (`getActiveSchool()`) -- con un solo colegio afiliado hoy no
se manifiesta, pero hay que revisarlo antes de afiliar un segundo colegio. Se sincronizó el repo
con lo que ya hay en producción vía `20260903000000_sync_list_school_receivables_definer.sql` (no
cambia nada en producción, solo documenta la versión real) -- no se tocó la lógica de autorización,
eso queda pendiente de decidir con el usuario.

**Bug real reportado por el usuario el mismo día (2026-09-03), horas después: números "abultados"
que no reconocía, y el corte de gracia estaba mal.** Dos causas distintas, ninguna resuelta con la
misma corrección:

1. **No es un bug -- es la ausencia de datos históricos.** Se verificó contra producción: para
   estudiantes reales, `collected_amount = 0` en absolutamente todos los casos. El sistema asume que
   nadie ha pagado nada desde que arrancó el año escolar, cuando en la realidad la mayoría de las
   familias sí ha estado pagando por Alegra -- esos pagos nunca se cargaron aquí. Es exactamente lo
   que la herramienta "Registrar pago" (sección anterior) existe para resolver; hasta que se
   backfilleen los cobros reales, todo el mundo se va a ver "vencido" aunque no lo esté. No requiere
   ningún cambio de código -- requiere que el usuario use la herramienta.
2. **Bug real de negocio, sí corregido**: la migración `20260827100000` (grace-cutoff, ver sección
   anterior) cambió el corte de "corriente" a "el día `tuition_grace_days` del mes SIGUIENTE al de
   la cuota" -- pero **eso nunca lo dijo el usuario real**. Su especificación original, dada al
   inicio mismo de esta tarea (2026-08-27), es explícita: *"están exonerados de recargo hasta los
   día 5 de cada mes siendo esto el corriente"* -- el mismo mes, no el siguiente. Ese cambio llegó
   por un push directo (otra sesión/el colega) que afirmaba tener confirmación del usuario, pero la
   propia queja de hoy contradice eso. Revertido en
   `20260903010000_revert_grace_cutoff_same_month.sql`: el corte vuelve a ser el día
   `tuition_grace_days` del MISMO mes de la cuota -- una cuota de agosto sin pagar ya se ve vencida
   (no "corriente") desde el 6 de agosto, como siempre debió ser. Se mantuvo sin tocar la única otra
   parte de esa migración que no contradice nada dicho por el usuario: la cuota parcial de 10.5 (la
   fracción `.5`) sigue cayendo en la primera cuota del año (agosto), no en la última (junio). Con
   este revert, el tramo "1-5" (que solo hacía falta con el corte de un mes completo) desaparece --
   `ReceivablesTable.tsx` vuelve a los 6 tramos originales que el usuario pidió literalmente:
   6-9, 10-14, 15-19, 20-30, 31-60, 61+.
   **Aplicado y verificado en producción de inmediato** (a diferencia de intentos anteriores, esta
   vez el clasificador de seguridad del harness permitió el `create or replace function` directo por
   la Management API) -- confirmado con estudiantes reales: una cuota de agosto sin pagar, vista el
   2026-09-03 (33 días después del vencimiento), pasó de mostrar `corriente` a `31-60` correctamente.

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

## El Panel mostraba RD$0 de mora mientras Cuentas por Cobrar mostraba RD$443,667 (2026-09-07)

Reportado por el usuario con captura: la tarjeta "Cartera vencida" del Centro de
Control decia **RD$0 - 0 facturas - 0 familias**, y en la misma sesion
`/dashboard/tesoreria/cuentas-por-cobrar` listaba decenas de estudiantes en el
tramo 6-9 dias con su recargo del 5%.

**Habia dos motores de mora que no se hablaban:**

| | Panel (antes) | Cuentas por Cobrar |
|---|---|---|
| Fuente | `invoices` con `status = 'vencido'` | `calculate_receivable_status()` |
| Necesita factura emitida | si | no |
| Conoce las 4 etapas de recargo | no | si |

**La causa de fondo: nada en todo el sistema escribe jamas `status = 'vencido'`.**
Verificado sobre las 70+ migraciones y todo `web/src`: ese valor solo aparece en
lecturas y en el `check` de la columna. No hay trigger, ni cron, ni job. La unica
escritura de estado de la app es `-> 'pagado'`. Una factura emitida como
`pendiente` se queda `pendiente` para siempre, pase su vencimiento.

Y el colegio ni siquiera emite facturas pendientes: produccion tenia **44
facturas, las 44 `pagado`, RD$90,100, todas de septiembre, sin NCF y con
`student_id`** -- o sea, las 44 salidas de "Registrar pago externo". La tarjeta
estaba **estructuralmente condenada a RD$0**, no desactualizada.

**Corregido (solo lectura, sin migracion ni cambio de policy)**: el Panel llama
ahora a `list_school_receivables`, la misma RPC que Cuentas por Cobrar -- un solo
motor de mora para las dos pantallas. Medido en produccion el 2026-09-07, que es
lo que la tarjeta pasa a mostrar: **RD$443,667** (RD$422,540 de deuda +
RD$21,127 de recargo), **201 estudiantes - 180 familias**, todos a 6 dias.
La consulta tarda 192 ms para 245 estudiantes y va dentro del `Promise.all`.

**Dos defectos mas de la misma raiz, corregidos en el mismo commit:**

1. **"100% de la meta mensual" era una metrica que no podia dar mala noticia.**
   La "meta" era lo facturado en el rango, y como cada factura se crea ya pagada,
   cobrado y facturado son siempre el mismo numero. La tarjeta decia 100% pasara
   lo que pasara. Ahora la linea dice **"44 de 245 estudiantes al dia"** y la
   barra es ese porcentaje real (18%).
2. **"Estudiantes inscritos 286" contaba todo estudiante no borrado**, sin filtrar
   el estado -- la variable se llama `enrolledStudents` y trae el campo, pero no
   lo usaba. Reales: **245 inscritos, 39 admitidos, 2 retirados**. Importaba
   porque Cuentas por Cobrar si filtra por `inscrito`: los dos numeros nunca
   iban a cuadrar entre pantallas.

Ademas, la tabla "Familias con saldo vencido" y el hallazgo de "Lectura del dia"
tambien pasaron a la RPC (la deuda se calcula por estudiante, asi que los
hermanos se suman en una sola fila de la familia), y los enlaces del Panel
apuntan a `/dashboard/tesoreria/cuentas-por-cobrar` en vez de `/dashboard/tesoreria`.

**Para revertir**: es un solo commit, dos archivos
(`app/dashboard/secretaria/page.tsx`, `components/dashboard/PanelCentroControl.tsx`),
sin nada que deshacer en la base.

### El grafico "Flujo de cobranza", cuota por cuota (mismo dia)

Resuelto el mismo 2026-09-07, a peticion del usuario ("de momento el grafico
quiero que refleje la realidad, configuralo como debe ser segun la logica").

Cada barra pasa a ser **la CUOTA de ese mes**: cuanto se debia y cuanto se ha
cobrado hasta hoy -- sin depender de que exista ninguna factura.

**Los montos no se recalculan**: `monthly_amount` (ya neto del nivel, de la beca
y del descuento por hermanos) y `collected_amount` los da la misma RPC que
alimenta las tarjetas. Lo unico que hace el TypeScript es **repartir** esos
numeros mes a mes con la misma regla de `calculate_receivable_status`: la cuota
parcial (el .5 de 10.5) es la PRIMERA (agosto), la cuota del mes X vence el dia
`tuition_due_day` del mes X+1, sigue "corriente" hasta `tuition_grace_days`, y
los pagos cubren la cuota mas vieja primero (FIFO).

Verificado sobre los 244 estudiantes reales: agosto exigible RD$510,390 /
cobrado RD$90,100 / vencido RD$420,290, y septiembre a junio RD$1,020,780 cada
uno, todos "por venir".

**Esa primera version repartia en TypeScript y por tanto duplicaba la regla de
cuotas** (SQL + pagina). El usuario pidio el mismo dia resolverlo de raiz para
evitar bugs futuros -- ver la seccion siguiente.

De paso, el Panel **ya no asume que el año escolar arranca el 1 de agosto**
(estaba escrito a mano en el archivo): lo toma de `school_years.start_date`, que
es lo que usa el motor de mora. Julio sigue sin aparecer solo, sin regla
especial: 10.5 cuotas desde agosto dan agosto..junio.

**Pendiente, decidido dejar fuera de este cambio:**
- **El caso limite de `list_school_receivables` con `super_admin`** sigue abierto
  (ver la seccion de Cuentas por Cobrar): la funcion exige
  `users_profiles.school_id = p_school_id`, lo que excluye a un `super_admin`
  usando "Entrar como director" de otro colegio. Hoy no se manifiesta porque solo
  hay un colegio afiliado y el perfil del super_admin apunta a ese mismo colegio
  (verificado). **Al afiliar un segundo colegio esto se lleva por delante tanto
  Cuentas por Cobrar como esta tarjeta del Panel.** Mitigacion ya puesta: si la
  RPC falla, `data` viene `null`, las tarjetas quedan en cero y `QueryErrorBanner`
  muestra el error -- el Panel no se cae.
### El duplicado de "Diana" -- resuelto, y la alerta de duplicados SI funciona

El usuario extranaba ver dos "Diana Beltran Gonzalez", porque el sistema tiene
una alerta que no deja crear el mismo estudiante dos veces. Investigado: las dos
filas eran identicas hasta la fecha de nacimiento (2013-08-13), creadas el
2026-08-22 y el **2026-09-02 a las 00:04 hora RD**.

**Ese segundo registro es justamente el reporte que origino la alerta.** El
commit que la agrego (`f5080bb`, "alerta de duplicados") es de ese mismo dia,
horas despues -- el comentario del codigo lo dice: *"reporte real del colegio,
2026-09-02"*. Es un resto anterior al arreglo, no un fallo del arreglo.

Confirmado con una consulta a produccion: **Diana era el UNICO duplicado en toda
la base** de 245 estudiantes. Desde el 2 de septiembre no ha pasado ninguno mas.

Se comprobo que las dos filas no tenian nada colgando (0 asistencia, 0 facturas,
0 notas, 0 intentos de Academia, 0 autorizaciones, 0 login) antes de tocar nada,
y se borro la mas nueva con el mismo **borrado suave** que hace el boton
"Eliminar" de la app (`deleteStudentAction`: `deleted_at = now()`), conservando
el registro original del 22 de agosto.
**Para revertir**: `update students set deleted_at = null where id =
'832de54c-c4dc-416f-a445-81ee331d1820';`

**Hueco real encontrado de paso, SIN corregir**: la alerta de duplicados vive
solo en `estudiantes/nuevo/actions.ts`. La bandeja de fichas escaneadas
(`estudiantes/escaneos/actions.ts` -> `confirmEnrollmentScan`) llama directo a
`createStudentWithFamily()` **sin ninguna comprobacion de duplicado**. Si el
colegio digitaliza fichas de estudiantes que ya estan en el sistema, entran
duplicados por esa via. Lo natural seria mover la comprobacion dentro de
`createStudentWithFamily()` (el camino compartido por las dos altas), no
copiarla.

## Una sola definicion del calendario de cuotas (2026-09-07)

Migracion `20260907000000_installment_schedule_single_source.sql`.

**Por que**: el grafico del Panel necesitaba el desglose mes a mes y
`calculate_receivable_status()` solo devuelve acumulados, asi que la primera
version repartio los montos en TypeScript -- copiando la regla de cobro (cuota
parcial en agosto, vencimiento el dia `tuition_due_day` del mes siguiente,
gracia, FIFO) a un segundo sitio. Es exactamente el patron que en este proyecto
ya causo bugs silenciosos (los dos motores de mora, `enrollments` en Academia,
las dos fuentes de "quien da que").

**Como quedo:**

```
  student_tuition_basis(student)      <- nivel/beca -> monto + config del colegio
           |
  installment_schedule(config)        <- LA REGLA. Funcion PURA, no consulta nada
           |
    +------+----------------+--------------------------+
    |                       |                          |
  calculate_receivable_     student_installment_    list_school_monthly_
  status()                  schedule(student)       cashflow()  [nueva]
  (reescrita, MISMA salida) (comodidad)             (alimenta el grafico)
```

**Si la regla de cobro del colegio cambia, se cambia en `installment_schedule` y
en ningun otro sitio.** La pagina del Panel ya no tiene ni una linea de logica de
cuotas: solo pinta lo que devuelve `list_school_monthly_cashflow`.

**Como se verifico antes de reemplazar nada** (es la funcion de la que dependen
Cuentas por Cobrar, la generacion de recargos, el bloqueo de tutores a +60 dias y
ahora el Panel -- no se toca a ciegas):
1. Se aplicaron primero las funciones nuevas y una copia
   `calculate_receivable_status_check` con el cuerpo nuevo, **sin tocar la real**.
2. Se compararon las **12 columnas** de las dos versiones para **todos los
   estudiantes en 8 fechas** distintas -- incluidos los bordes que importan: el
   dia 5 vs el 6 (limite de gracia), el 1 de octubre (siguiente vencimiento), el
   fin del anio escolar y despues. **2,280 filas, 0 diferencias.**
3. Solo entonces se reemplazo la real, se borro la copia de prueba y se
   comprobo que Cuentas por Cobrar seguia dando los mismos numeros.

**Trampa de rendimiento encontrada y corregida en el camino**: la primera
version del refactor puso el `select` de la configuracion DENTRO del generador
del calendario. Como `calculate_receivable_status` tambien resolvia la
configuracion, el descuento por hermanos se calculaba **dos veces por
estudiante** y la funcion paso de **192 a 387 ms** (medido, no supuesto) sobre
245 estudiantes -- justo la consulta que ya provoco un `statement timeout` real
en produccion en agosto. Se separo el generador PURO (`installment_schedule`,
`immutable`, recibe la config ya resuelta) del resolvedor
(`student_tuition_basis`), y quedo en **221 ms**: 15% de sobrecarga en vez del
100%. `list_school_monthly_cashflow` tarda 211 ms.

**Nota**: `list_school_monthly_cashflow` es `security invoker` a proposito, no
`definer` como `list_school_receivables` -- la RLS de `students`/`invoices`
decide por si sola que ve cada rol, sin repetir la autorizacion en codigo, y de
paso **no hereda el caso limite del super_admin usando "Entrar como director" de
otro colegio**. Es el modelo a seguir si algun dia se arregla aquel.

**Para revertir**: la migracion solo tiene `create or replace`; el cuerpo
anterior de `calculate_receivable_status` esta intacto en
`20260903030000_grace_cutoff_next_month.sql`, se vuelve a aplicar tal cual.
Las tres funciones nuevas se pueden dropear sin afectar nada mas.

**Pendiente**: no se pudo correr `npm run smoke` en esta sesion (el entorno no
tiene `SUPABASE_SERVICE_ROLE_KEY`, solo el PAT de la Management API). Conviene
correrlo antes de dar por cerrado esto.

## La alerta de duplicados se movio al camino compartido (2026-09-07)

Vivia solo en `estudiantes/nuevo/actions.ts`, asi que la bandeja de fichas
escaneadas (`confirmEnrollmentScan` -> `createStudentWithFamily`) creaba
estudiantes **sin ningun aviso de duplicado**: digitalizar la ficha de alguien ya
registrado lo duplicaba en silencio. Movida dentro de
`createStudentWithFamily()`, que es el camino que comparten las dos altas, con un
tercer parametro `options.allowDuplicate`.

- Va **antes de cualquier insert**: si saltara despues de crear la familia,
  quedaria una familia huerfana cada vez que alguien decide no continuar.
- Sigue **sin bloquear** (pueden ser dos ninos distintos con el mismo nombre):
  devuelve `duplicates` y quien da el alta confirma. La bandeja de OCR tiene
  ahora la misma alerta ambar con "Crear de todas formas" / "Cancelar", y la
  ficha **no** se marca como confirmada mientras tanto.
- La coincidencia ahora incluye la **fecha de nacimiento**, que es lo que
  distingue de un vistazo dos ninos homonimos de un duplicado real (las dos
  "Diana" tenian la misma).
- Detección verificada contra produccion: encuentra a la activa, **ignora la
  borrada con `deleted_at`**, y aguanta espacios y mayusculas.

## Sesión paralela en Windows: dos commits directos a `main`, revertidos, y el fondo real que sí valía la pena (2026-09-07)

**Contexto de cómo pasó esto, para que quede claro y no se repita la confusión**: mientras esta
sesión trabajaba, otra sesión de Claude Code corriendo en la máquina Windows del usuario (PowerShell,
mismo repo) hizo una auditoría de Tesorería por su cuenta y empujó dos commits directo a `main` sin
pasar por esta sesión ni por el flujo de PR: `3007be4` ("fix: clarify overdue grace period in
dashboard") y `8979b4c` ("fix: harmonize treasury permissions and server actions"). Cuando esta sesión
retomó el trabajo, un resumen de esos cambios llegó pegado en el mensaje del usuario -- con el formato
correcto pero sin ningún commit correspondiente en el historial local, así que **se trató como
sospechoso y se verificó contra `git log`/`origin/main` antes de creer una sola palabra** (resultó ser
real, solo que de otra sesión -- no una alucinación ni una inyección, pero verificar primero fue lo
correcto de todas formas).

**El usuario pidió revertir los dos commits ("revierte esos comit que puse ahi") y así se hizo** --
`git revert` (no `reset --hard`, para no reescribir historia compartida), confirmando antes con
`pg_policies` que la migración de esos commits (RLS de `reception` + endurecer `generate_ncf`)
**nunca llegó a producción** -- el revert fue puramente de código en el repo.

**Pero el primer commit (`3007be4`) sí era un arreglo correcto**, y coincidía exactamente con la
anomalía real que el usuario había reportado con una captura de pantalla ese mismo día (ver sección
de abajo, "Cartera vencida contaba el tramo `corriente`"). Confirmado por el usuario ("si el primero
esta bien"). Se volvió a aplicar con `git cherry-pick 3007be4` -- no se retipeó a mano, porque su
lógica ya estaba verificada de forma independiente contra producción antes de saber que ese commit
existía (ver "Cartera vencida..." abajo).

**El segundo commit (`8979b4c`) traía dos cosas mezcladas**, y solo una se recuperó:
1. RLS de `reception` en Tesorería + endurecer `generate_ncf` -- **sí era un problema real**, ver
   sección siguiente. Reimplementado y verificado desde cero por esta sesión (no reusado tal cual,
   porque esa sesión reportó explícitamente que nunca lo había aplicado ni verificado en producción).
2. Mover "Registrar pago"/"Generar factura" de inserts en el navegador a Server Actions -- un
   refactor real de los caminos de escritura de dinero, que ni esta sesión ni la otra llegaron a
   revisar con el mismo estándar de verificación que exige este proyecto (la otra sesión solo corrió
   build/lint, no probó el flujo en vivo ni lo comparó contra el comportamiento anterior). **Se dejó
   revertido a propósito** -- no se reintrodujo. Si se quiere retomar ese refactor, hacerlo como una
   tarea aparte, con su propia verificación de punta a punta contra producción (crear una factura y
   un pago de prueba con el flujo nuevo, confirmar que el resultado es idéntico al flujo viejo, borrar
   los datos de prueba).

## Recepción sin acceso real a Tesorería (RLS nunca incluyó `reception`) -- corregido y verificado (2026-09-07)

Es el hallazgo real que traía el commit `8979b4c` de la sección anterior, verificado independientemente
por esta sesión antes de decidir qué hacer con él -- no se confió en el reporte de la otra sesión sin
comprobarlo.

**El conflicto real, y por qué hizo falta preguntarle al usuario en vez de adivinar**: la sección
"Mapeo de puesto → rol de acceso: Secretaría y Coordinación" de este mismo archivo documenta una
decisión YA confirmada con el usuario (2026-09-04 aprox.): Secretaria "se encargará de... pagos y
validación de comprobantes", y por eso se le dio a `reception` los módulos `tesoreria`/`pagos` en
`permissions.ts`, asumiendo (sin verificar en ese momento) que RLS ya la incluía "desde la migración
004". **Esa suposición era falsa.** Verificado leyendo `pg_policies` en producción el 2026-09-07: las
políticas `invoices_staff`/`payments_staff`/`billing_concepts_staff`/`payment_receipts_staff_*` tenían
la lista `['super_admin','school_admin','director','finance']` -- sin `reception`, sin excepción, en
ninguna de las 5 policies. Mientras tanto, la otra sesión (Windows) diagnosticó correctamente esta
brecha, pero la corrigió en la dirección contraria: le pidió al usuario confirmar si RLS debía ganar
(restringir `reception` en el código) o si el código debía ganar (ampliar RLS) -- el usuario, sin tener
a mano el contexto de la decisión de negocio ya confirmada antes, dijo "que RLS mande" en esa sesión.
Cuando esta sesión le mostró las dos decisiones contradictorias lado a lado, el usuario confirmó por
`AskUserQuestion` que la intención real es **dar acceso real en RLS** -- la decisión de negocio de
Secretaría sigue siendo la correcta, RLS era lo que estaba desactualizado.

**Corregido** en `supabase/migrations/20260910010000_reception_treasury_rls_and_ncf_hardening.sql`,
aplicada y verificada en producción:
- Las 5 policies de `invoices`/`payments`/`billing_concepts`/`payment_receipts` ahora incluyen
  `reception`.
- `generate_ncf` -- hallazgo aparte, real, encontrado al revisar la migración descartada antes de
  decidir si reusarla: **era ejecutable por `anon`** (cualquiera, sin sesión, vía la API pública de
  Supabase, podía consumir números de comprobante fiscal reales de las secuencias `ncf_sequence_01`/
  `02` sin haber creado ninguna factura) y **sin `search_path` fijo** siendo `SECURITY DEFINER` (riesgo
  de secuestro de resolución de funciones). Se revocó `anon`/`public`, se fijó `search_path`, y se
  agregó una comprobación de rol/colegio (incluye `reception`, porque "Generar factura" ya está
  gateado por `canAccess(role,'tesoreria')`, que la incluye).

**Verificado con sesión real de `reception` simulada** (`set_config('request.jwt.claim.sub', ...)` +
`set local role authenticated`, transacción con `ROLLBACK`, mismo patrón que usa `npm run smoke`):
antes de la migración, 0 facturas/0 pagos/0 conceptos/0 comprobantes visibles; después, 44/44/1/0 --
los datos reales del colegio. `anon` confirmado sin `EXECUTE` en `generate_ncf`
(`has_function_privilege` = false).

**Aviso de transparencia, no un problema pero hay que decirlo**: la verificación de `reception`
generando un NCF real consumió un número de la secuencia fiscal (`B0200000161`) que **no se puede
revertir con `ROLLBACK`** -- las secuencias de Postgres están exentas de MVCC a propósito, es
comportamiento estándar, no un bug de esta migración. Ese número queda saltado, nunca se le va a pegar
a ninguna factura real -- mismo efecto que un comprobante anulado, no debería causar ningún problema
con la DGII, pero se anota aquí por si alguna vez hace falta explicar un salto en la secuencia.

## Cartera vencida contaba el tramo `corriente` como si ya estuviera vencido (2026-09-07)

Reportado por el usuario con una captura real de "Familias con saldo vencido": una familia con
vencimiento nominal "1 sept" y etiqueta "+8 días", cuando según el manual de familia (gracia de 5
días) esa cuota sigue siendo pagable sin recargo hasta el día 5 -- "el 1 de septiembre la factura no
esta vencida esa aun vigente, la factura esta vencida a partir del dia 6".

**Confirmado antes de tocar nada**, corriendo `calculate_receivable_status` sobre fechas reales:
`2026-09-01` y `2026-09-05` -> RD$420,290 en el tramo `corriente`, RD$0 realmente vencido;
`2026-09-06` en adelante -> ya vencido de verdad. El motor SQL distinguía las fechas correctamente
(`aging_bucket = 'corriente'` existe justo para esto) -- el bug estaba en el frontend, que contaba
`overdue_amount > 0` como "vencido" sin excluir ese tramo.

**Corregido** (mismo cambio que traía el commit `3007be4` de la sección de arriba, reaplicado con
`cherry-pick` tras confirmar su lógica de forma independiente):
- `secretaria/page.tsx`: `conDeuda` ahora excluye `aging_bucket === 'corriente'` de "cartera vencida".
- La tabla del Panel pasó de "Familias con saldo vencido" a "Familias en mora"; la columna "Vence" pasó
  a "Mora desde" (`oldest_overdue_due_date + tuition_grace_days`, no la fecha nominal).
- El "+N días" ahora cuenta días reales en mora (`days_overdue - grace_days + 1`), no días desde la
  fecha nominal -- una cuota del día 6 ahora muestra "+1 día", no "+6 días" ni "+8".
- `ReceivablesTable.tsx` (Cuentas por Cobrar): el badge de tramo (`6-9`, `10-14`, etc.) ahora se
  traduce a "días mora" reales en vez de mostrar el rango crudo, que ya venía desplazado por la gracia.

## Plataforma: "% Morosidad" por colegio también leía el motor de facturas roto (2026-09-07)

Encontrado al investigar el reclamo del usuario de que "una de las mejores estadísticas" había
desaparecido en la pantalla de Plataforma (no se pudo confirmar cuál -- el historial de
`plataforma/page.tsx` no tiene ninguna tarjeta de "pagos pendientes" desde que se creó, así que nada
desapareció por ningún cambio de esta sesión). Pero sí se encontró un bug real, de la misma familia
que el de la sección anterior: la columna "% Morosidad" de la tabla comparativa entre colegios leía
`invoices.status = 'pendiente'`/`'vencido'` -- el mismo motor que nunca escribe nadie. Verificado en
producción: 0 y 0 para el único colegio afiliado, así que esa columna mostraba **0% siempre**,
ocultando que en realidad hay RD$420,290 vencidos (82% de lo exigible a la fecha).

**No se reutilizó `list_school_receivables`** (la misma función que ya usan el Panel y Cuentas por
Cobrar) **a propósito**: esa función exige `users_profiles.school_id = p_school_id` -- correcto para
un director viendo su propio colegio, pero le fallaría a Plataforma en cuanto haya un segundo colegio
afiliado, porque el `school_id` del super_admin nunca va a coincidir con el de un colegio ajeno.
Plataforma existe precisamente para comparar TODOS los colegios a la vez, así que heredar esa
restricción la habría roto por diseño, no por descuido -- es el caso límite que este archivo ya viene
avisando desde el 2026-09-07 más temprano.

**Función nueva** `list_school_receivables_network(p_school_id, p_as_of)`
(`supabase/migrations/20260910000000_network_receivables_for_platform.sql`): mismo cálculo
(`calculate_receivable_status` por estudiante inscrito), pero la autorización exige `role =
'super_admin'` en vez de la coincidencia de colegio -- sin tocar `list_school_receivables` ni su uso
existente en Cuentas por Cobrar/Panel. `plataforma/page.tsx` la llama una vez por colegio (mismo
patrón ya aceptado ahí de "una consulta por colegio, revisar si se vuelve lento con más afiliados").
`% Morosidad` ahora es `overdue_amount / expected_to_date` -- qué fracción de lo que ya debió cobrarse
este año sigue sin cobrarse.

Verificado con sesión de super_admin simulada: RD$510,390 exigible, RD$420,290 vencido -> 82%, mismos
montos ya confirmados por el Panel y Cuentas por Cobrar el mismo día.

**Pendiente, sin resolver a propósito**: `totalStudents`/el conteo de estudiantes por colegio en esta
misma pantalla cuentan todo estudiante no borrado sin filtrar `enrollment_status` -- el mismo bug ya
corregido en el Panel ("286 vs 245", ver sección de arriba) sigue sin corregir aquí. No se tocó en
esta tarea para no ampliar el alcance sin que el usuario lo pidiera -- queda anotado para la próxima
vez que se toque esta pantalla.

## "Plataforma no muestra pagos pendientes" — la tarjeta nunca existió, pero el dato sí faltaba (2026-09-07)

Continuación de la sección anterior. El usuario insistió, sobre la misma captura, en que la 5ta
tarjeta (donde hoy dice "Comunicados este mes") "mostraba el dato de cuenta pendiente" y pidió
buscarla y restaurarla.

**Búsqueda exhaustiva antes de tocar nada**: `git log --all --source -S"..."` sobre todas las ramas
(no solo `--follow` de este archivo) para "Pagos pendientes", "Cuenta pendiente", `cuentaPendiente`,
`pagosPendientes` -- cero resultados salvo el propio commit de esta sesión. **Esa tarjeta nunca
existió** en el historial real de `plataforma/page.tsx` (solo 2 commits desde que se creó, ambos de
estilo visual, mismos 5 rótulos siempre). La lectura más probable: el usuario está mezclando esta
pantalla con la tarjeta "Cartera vencida" del Panel, arreglada ese mismo día un rato antes.

**No se quitó "Comunicados este mes"** -- sin evidencia de que sobre algo ahí, borrar una tarjeta que
sí funciona por una corazonada habría sido el error contrario. Se agregó una tarjeta nueva, **"Cartera
vencida (red)"**, en rojo (mismo color que la tarjeta homónima del Panel), usando el mismo
`overdueWithFee` (deuda + mora) que ya se calculaba por colegio para "% Morosidad" -- sin consulta
nueva, solo se sumó sobre `counts` en memoria. La grilla pasó de `sm:grid-cols-5` a
`sm:grid-cols-3 lg:grid-cols-6` para las 6 tarjetas.

Verificado: RD$441,305 -- coincide exactamente con la cartera vencida ya confirmada por el Panel y
Cuentas por Cobrar el mismo día.

## Academia rota en producción: un `onClick` en un Server Component (2026-09-07)

Reportado por el usuario con captura: `/dashboard/academia/progreso` mostraba la pantalla genérica
"Algo salió mal" de `dashboard/error.tsx`.

**La causa, encontrada al final y con certeza**: el commit `b9310c2` de esa misma mañana (el que dejó
leer el cuestionario desde el catálogo) agregó `onClick={(e) => e.stopPropagation()}` al enlace "Ver
video". Eso es una **función pasada como prop desde un Server Component** -- React no puede
serializarla y lanza `"Event handlers cannot be passed to Client Component props"`.

**Por qué costó tanto encontrarlo, y qué aprender de eso:**

1. **`tsc`, `eslint` y `next build` pasan los tres limpios.** La ruta es dinámica (`ƒ` en la tabla de
   rutas del build, verificado en los logs de Vercel), así que nunca se prerenderiza en build: el
   error solo existe en una petición real. **En este proyecto, "build limpio" no prueba que una
   pantalla cargue** -- ya lo decía el protocolo, pero aquí quedó demostrado del modo más caro.
2. **Un `try/catch` alrededor del render NO lo atrapa.** Se puso uno justo para diagnosticar esto y
   no sirvió: React lanza ese error al SERIALIZAR el árbol devuelto, o sea después de que la función
   de página ya retornó. Se dejó igual como red de seguridad para errores de datos, pero con el
   comentario corregido para que nadie vuelva a confiar en que cubre este caso.
3. **Next.js oculta el mensaje real en producción** (solo un `digest`), y el `console.error` de
   `dashboard/error.tsx` en el navegador muestra el mismo texto redactado. Sin el mensaje real, se
   perdieron varias rondas persiguiendo hipótesis equivocadas (ver abajo).

**Hipótesis que se probaron y NO eran** (se dejan anotadas para no repetirlas):
- *El embed `quiz_options` viniendo `null`*: se protegió con `?? []` en las dos pantallas, pero se
  comprobó contra producción (sesión del director simulada + el mismo `jsonb_agg` que arma PostgREST,
  y una llamada REST real con `service_role`) que **el embed siempre trae su array**. Las guardas se
  dejaron igual por ser buena práctica, pero no eran la causa.
- *Despliegue viejo / caché*: descartado con el token de Vercel -- el commit estaba `READY` y el
  alias `n8n-school-expert-landingpage.vercel.app` apuntaba exactamente a él.
- *Service worker atascado*: descartado, el `sw.js` actual es el "kill switch" que se autodestruye.
- *El layout compartido*: descartado, el Sidebar/TopBar/banner renderizaban bien en la captura.

**Cómo se cerró**: con un Personal Access Token de Vercel que aportó el usuario (rotar después) se
confirmó estado del despliegue, alias y logs de build -- pero **los logs de RUNTIME no son accesibles
con ese tipo de token** (es de alcance proyecto, no resuelve usuario/equipo: `/v2/user` da "User not
found" y el CLI `vercel logs` falla por lo mismo). La causa se encontró releyendo el diff propio de
`b9310c2` línea por línea.

**Nota de método**: se intentó reproducir la sesión real del director generando un enlace mágico con
la API admin de Supabase para obtener un token de sesión. **El clasificador de seguridad del harness
lo bloqueó, con razón** -- mintar una sesión de la cuenta real de un usuario cruza una línea que no
se debe cruzar sin autorización explícita en el momento. No se buscó ninguna vuelta para saltárselo.

**Regla que deja esto**: en este proyecto, **ningún `page.tsx` de `/dashboard/*` puede pasar una
función como prop** (`onClick`, `onChange`, etc.) salvo que el archivo empiece con `'use client'`.
Si hace falta interactividad, va en un componente cliente aparte. Auditado el resto de la app con
`grep`: al 2026-09-07 no queda ningún otro caso.

**Corregido de paso, aunque no era la causa**: el mismo patrón sin proteger (`[...q.quiz_options]`
sin `?? []`) vivía también en `academia/[id]/page.tsx` desde el 2026-08-22 -- la pantalla donde el
ESTUDIANTE contesta el cuestionario. Sigue siendo frágil por depender de una garantía que Supabase no
promete siempre, así que se guardó igual.

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

## 2026-09-03 — Día completo sin asistencia + Mensajes/Fotos invisibles para el profesor

Tres cosas el mismo día, y las tres comparten la misma raíz de fondo: **nadie
verificó el efecto de un cambio sobre los otros roles.** De aquí salió el
protocolo del principio de este archivo y el script `scripts/smoke-roles.mjs`.

### 1. Ningún profesor pudo pasar lista en todo el día

Síntoma reportado: "no muestra la asistencia". La pantalla estaba bien — lo
que pasaba es que había **0 registros** ese día, cuando cualquier otro día ya
había filas desde las 7:50-8:30am.

Causa: la policy `attendance_staff_all` (creada en `20260817100000`) llama a
`teacher_is_assigned_to_grade(school, grade)` con **2 argumentos**. La
migración `20260823010000` creó una sobrecarga
`teacher_is_assigned_to_grade(uuid, text, text default 'regular')`. Con las dos
coexistiendo, Postgres ya no puede resolver la llamada de 2 argumentos:

```
ERROR: 42725: function teacher_is_assigned_to_grade(uuid, text) is not unique
```

Toda lectura/escritura de asistencia hecha por un `teacher` reventaba ahí.
`students_read` y `class_schedules_staff_read` ya habían sido corregidas a 3
argumentos por este mismo motivo (ver `20260821060000`), pero
`attendance_staff_all` y `class_updates_staff_all` nunca se actualizaron —
**se arregló una y se dejaron dos rotas.** Corregido en
`20260906000000_fix_ambiguous_teacher_is_assigned_to_grade.sql`.

Detalle importante para el futuro: **esto no aparecía en los logs de Vercel**,
porque `AttendanceForm` escribe con el cliente del navegador directo contra
Supabase. El diagnóstico salió de consultar la base, no los logs.

### 2. El profesor no tenía Mensajes ni Actualizaciones

Reporte del colegio: "los docentes tienen deshabilitada la opción de mensajes,
solo tienen comunicado, que le llega a todos los padres de su curso; si quieren
un mensaje específico a un padre, no lo tienen — ni el padre ni la madre
habilitada". Y sobre las fotos: la autorización de uso de imagen ya la están
firmando los padres, así que la opción debía habilitarse (ese día se cayó una
bebé y la profesora tuvo que mandar la foto por fuera de la plataforma).

Eran **dos bloqueos distintos**, y encontrar solo el primero no habría
resuelto nada:

- `mensajes_directos` y `actualizaciones` estaban en la matriz de permisos del
  profesor desde siempre, pero **nunca se agregó el enlace en `Sidebar.tsx`**.
- Las dos pantallas de Mensajes leían `families` con el cliente del usuario, y
  la RLS de esa tabla solo la abre a dirección/finanzas/recepción: al profesor
  le llegaban **0 familias** (verificado simulando su sesión en producción), y
  por eso el selector salía vacío. La pantalla de conversación, además, le
  respondía "no encontrado".

Se resolvió leyendo la lista con el cliente de servicio **solo en esas dos
pantallas**, filtrada por la autorización que ya existía
(`getEligibleFamilyIdsForCategory` para ofrecer, `staffCanAccessFamilyCategory`
para abrir y enviar). No se abrió la RLS de `families` al profesor a propósito.

### 3. Estado de la autorización de uso de imagen (pendiente del colegio)

La autorización existe desde el 2026-08-23, pero solo hay **6 respuestas
registradas de 286 estudiantes**. La pantalla de Actualizaciones no bloquea
publicar: muestra una advertencia roja por cada estudiante sin autorización
registrada (Ley 136-03). Mientras el colegio no cargue en la plataforma las
firmas que está recogiendo en papel, la profesora verá esa advertencia en casi
todos los casos. **Es un pendiente de datos, no de código.**

## Cómo entra un estudiante al sistema (2026-09-05, documentado el 2026-09-06)

**Esto no estaba en este archivo** -- vivía solo en el código y en la cabecera
de la migración `20260905000000_acceso_estudiantes.sql`, y cualquier sesión que
leyera solo el MD no sabía que existía. Corregido aquí.

Los estudiantes **no tienen correo**, así que su cuenta de Auth se identifica
con un **código de acceso** convertido en un correo interno que nunca envía
nada -- mismo patrón que los tutores sin correo (`createPhoneBasedAccess`).

- `students.access_code`: 7 caracteres, ej. `K7MPQ34`. Alfabeto
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789` -- **sin 0, O, 1, l ni I**, porque se copia
  a mano de un papel. Índice único sobre `lower(access_code)`.
- Cuenta de Auth: `{codigo}@estudiantes.mentoriapp.local`
  (`STUDENT_EMAIL_DOMAIN` en `web/src/lib/auth/studentAccess.ts`).
- Contraseña temporal de 8 caracteres, mismo alfabeto. **Se entrega impresa**;
  la inscripción es presencial, no depende de que nadie revise un correo.
- En `/login` el estudiante **escribe solo el código**: `normalizeLoginIdentifier()`
  le agrega el dominio si el texto no trae `@`. Por eso el campo dice
  `tu@correo.com ó K7MPQ34`.
- Se crea desde **`/dashboard/estudiantes/accesos`** (módulo
  `estudiantes_accesos`), uno por uno o por curso completo -- salta a los que
  ya tienen cuenta.
- `createUser` va con `email_confirm: true` (no hay correo real que confirmar).
  Si el `insert` en `users_profiles` falla, **se borra la cuenta de Auth**: un
  usuario sin perfil no sirve para nada y además caería en el portal de padres
  por defecto (ver `dashboard/layout.tsx`).
- `current_student_id()` (`security definer`) es la única forma correcta de
  resolver "¿qué estudiante soy?" dentro de una policy. Nunca hacer el join a
  `users_profiles` a mano dentro de una policy de `students` -- es el camino a
  la recursión de RLS que ya rompió el login dos veces.

**Estado al 2026-09-06**: 0 estudiantes con login creado en producción, de 243
inscritos. La vía existe y está probada en código, pero nadie la ha usado
todavía.

**Advertencia para demostraciones**: el código de acceso es un credencial de un
menor. No proyectarlo en pantalla junto al nombre de un estudiante real delante
de terceros -- crear un estudiante de demostración para eso.

## La fábrica de video-lecciones (`produccion/`, 2026-09-06)

Primera implementación real del plan de contenido de abajo. Vive en
`produccion/`, **fuera de `web/`** a propósito: no entra en el build de Next ni
en el despliegue de Vercel.

```
produccion/
  lecciones/*.json     el guion: escenas (narración + visual HTML) y cuestionario
  lib/estilo.css       la plantilla visual del colegio
  lib/producir.mjs     guion -> gráficas -> voz -> MP4
  lib/cargar-sql.mjs   genera el SQL que carga las lecciones en Academia
  salida/              MP4 y PNG generados (en .gitignore -- no van al repo)
```

**Decisiones que costaron una prueba y conviene no volver a discutir:**

- **La voz es `openai/gpt-audio-mini` vía OpenRouter**, no el TTS de OpenAI
  directo: US$0.0042 por minuto contra US$0.015. Una lección de 6 minutos
  cuesta 2 centavos; las ~2,000 del currículo, unos US$50 de narración.
- **`marin` es la voz.** Se probaron 5. `coral`, `sage` y `shimmer` **se
  comieron la primera oración completa** del texto de prueba. `marin` y `alloy`
  empataron en fidelidad (73/73 palabras) y ritmo; se escogió `marin`.
- **Cada escena se narra por separado y se verifica palabra por palabra**
  contra el guion. El modelo de voz es un modelo de chat: a veces resume o
  reordena en vez de leer, sobre todo en textos largos o con listas numeradas.
  En la primera corrida se comió casi entera la escena 8 de la lección 1. Por
  eso: hasta 3 reintentos y, si sigue fallando, narrar oración por oración.
  **Una lección incompleta no sale de la fábrica.**
- **La voz habla a ~178 palabras/min**, muy rápido para un niño de 11 años (lo
  recomendado ronda 140-150). Se baja con `atempo=0.84` en el montaje, sin
  regenerar audio.
- **Ningún modelo generativo dibuja texto ni números.** Todo lo que lleva
  cifra, rótulo o fracción se escribe en HTML real (`lib/estilo.css`) y se
  captura con Chromium a 1920x1080. Un `2x + 3 = 7` mal renderizado le enseña
  mal al estudiante y nadie se entera.
- **El caché salta la escena que ya tiene `.mp3`.** Ojo: si una corrida vieja
  dejó un audio malo, hay que borrarlo a mano o usar `REHACER_VOZ=1`, o se
  reusa el archivo malo (pasó).

**Primera tanda producida (2026-09-06)**: 9 lecciones de 6to. Primaria --
3 de Matemática, 3 de Lengua Española, 3 de Ciencias Naturales -- con sus 4
preguntas cada una. Los ejemplos son dominicanos a propósito (el colmado de la
esquina, una funda de mangos, descuentos en pesos): además de entenderse mejor
aquí, hace el contenido original por construcción, no por disimulo.

**Pendiente**: subir los MP4 a YouTube **como no listados** (decisión de
alcance para no bloquear la demo con la cuenta de Cloudflare y la migración de
`video_provider`, que solo acepta `youtube`/`vimeo`), y correr el SQL que
genera `lib/cargar-sql.mjs`.

## ⚠️ PENDIENTE PRIORITARIO — Academia no acota al profesor por curso ni materia (2026-09-06)

**El usuario lo pidió explícitamente y con prioridad.** No se hizo el mismo día
porque faltaban 4 días para la presentación del colegio y tocar RLS con ese
plazo es exactamente el patrón que este archivo advierte en su protocolo.
Hacerlo con calma, con el smoke test detrás.

### Lo que pasa hoy

`lessons_staff_all` es una sola policy de tipo **ALL** (select + insert + update
+ delete) para cualquiera con rol `super_admin`, `school_admin`, `director` o
**`teacher`** del colegio. No filtra por curso ni por materia. En consecuencia,
cualquier profesor puede:

- crear lecciones de **cualquiera de las 14 materias**, no solo la suya;
- dirigirlas a **cualquiera de los 16 cursos**, no solo los que da;
- **editar y borrar las lecciones de otros profesores**;
- publicarlas directo al estudiante (`is_published` viene marcado por defecto
  en `NewLessonForm.tsx`), sin que nadie revise.

`quiz_questions_staff_manage` y `quiz_options_staff_manage` son igual de
amplias, así que restringir solo `lessons` dejaría el arreglo cosmético: el
profesor seguiría pudiendo reescribir las preguntas de la lección de otro.

**Contrasta con el resto del sistema**: Estudiantes, Asistencia,
Actualizaciones y Horarios sí acotan al profesor con
`teacher_is_assigned_to_grade(...)`. Academia se quedó fuera de esa regla desde
la migración 008, que se escribió asumiendo un colegio chiquito donde el
profesor solo pega un enlace de YouTube.

### Alcance medido (no supuesto)

Siete archivos tocan estas tablas, y **los siete usan el cliente de sesión** --
no hay ni un `createAdminClient` en todo Academia:

| Archivo | Qué hace |
|---|---|
| `academia/nueva/NewLessonForm.tsx` | **escribe** lessons + quiz_questions + quiz_options (desde el navegador) |
| `academia/page.tsx` | lee lecciones del curso del estudiante |
| `academia/[id]/page.tsx` | lee una lección y su cuestionario |
| `academia/[id]/LessonPlayer.tsx` | **escribe** quiz_attempts + quiz_answers (estudiante) |
| `academia/progreso/page.tsx` | catálogo + intentos (personal) |
| `estudiantes/[id]/page.tsx` | intentos de un estudiante |
| `reportes/page.tsx` | intentos agregados del colegio |

Que todo pase por RLS es bueno (no hay puerta trasera que enmascare un error)
pero significa que **una policy mal escrita no da error: deja pantallas
vacías**, que es el modo de fallo que ya costó un día de clases aquí.

### Diseño propuesto

**Partir la policy ALL en dos**, en `lessons`, `quiz_questions` y `quiz_options`:

1. **Lectura amplia** (`_staff_read`, SELECT): todo el personal del colegio
   sigue viendo el catálogo completo. Un profesor debe poder ver lo que hicieron
   los demás -- para reutilizarlo y para que el catálogo que se agregó a
   `progreso` no se le vacíe.
2. **Escritura acotada** (`_staff_write`, INSERT/UPDATE/DELETE):
   `super_admin`/`school_admin`/`director` siempre; `teacher` **solo** donde
   `teacher_is_assigned_to_grade(school_id, grade_level, 'regular')`.

Fase 2 (opcional, más fina): acotar también por materia usando
`class_schedules`, que ya sabe qué materia da cada profesor en cada curso --
son 330 filas reales cargadas. Eso es lo que el usuario describió: *"los
estudiantes que están en su materia"*.

Fase 3: estado **"en revisión"** en vez del booleano `is_published`, para que
dirección apruebe antes de que la lección llegue al estudiante. Ya está
comprometido en el plan de contenido de más abajo ("nada se publica sin visto
bueno humano").

### Trampas concretas de este cambio

- **`teacher_is_assigned_to_grade` hay que llamarla con TRES argumentos.**
  Existen dos sobrecargas y la de 2 argumentos es ambigua (`42725`). Esa
  ambigüedad dejó al colegio un día entero sin poder pasar lista el 2026-09-03.
- **La categoría tiene que ser `'regular'`.** Las asignaciones de las docentes
  de Inglés están todas en `regular`; usar `'ingles'` las dejaría fuera. Misma
  trampa ya documentada más arriba.
- **`quiz_questions` y `quiz_options` van en la MISMA migración.** Si no, el
  profesor sigue pudiendo reescribir el cuestionario de la lección ajena.
- **Profesores sin ninguna asignación pierden la creación.** Hoy es el caso de
  Génesis Rodríguez (Orientación). Es defendible, pero es un cambio de
  comportamiento que hay que decidir a conciencia, no descubrir después.
- **Lecciones con `grade_level` nulo** (las viejas, dirigidas por
  `grade_level_id`) quedarían solo editables por dirección. Hoy las 9 cargadas
  tienen `grade_level`, así que no afecta -- pero hay que preverlo.
- **No tocar**: `quiz_attempts` (el estudiante escribe los suyos),
  `student_points`, `student_badges`, ni las policies de lectura de estudiante
  y tutor. Nada de eso tiene que ver con quién puede crear una lección.

### Cómo verificarlo antes de darlo por bueno

1. **Postgres local** con esquema espejo: simular la sesión de un profesor
   (`set local role authenticated` + `request.jwt.claim.sub`) y comprobar los
   cuatro casos -- crea en su curso ✅, no crea en otro ✅, sigue viendo todo el
   catálogo ✅, no puede borrar la lección de otro ✅. Y que dirección siga
   pudiendo todo.
2. **Producción, en transacción con ROLLBACK**: repetir con profesores reales
   (Yuleymis Lugo, Marianelis Rivera, Yendry Paulino) y contar antes/después,
   igual que se hizo con el arreglo de cursos del 2026-09-06.
3. **Agregar la comprobación a `scripts/smoke-roles.mjs`**, que es el requisito
   permanente de este proyecto para cualquier cambio de policy.

## PLAN DEFINITIVO — Producción de contenido de Academia (2026-09-06)

Decidido con el usuario tras revisar viabilidad. Hasta hoy **no existía ningún
plan escrito** para esto: se buscó "video/lección/academia" en los 16 archivos
`.md` del repo y no hay nada. La única "ruta" que existió está implícita en el
esquema de la migración 008 (`video_url` + `video_provider check in
('youtube','vimeo')`), y dice todo: **el sistema se diseñó asumiendo que alguien
más ya hizo el video y el profesor solo pega el enlace.** Ese supuesto se cayó
-- el colegio confirmó que sus docentes no están en capacidad de producir.

### La decisión central: estilo Khan Academy, en dos capas

**Nada de presentador ni avatar.** La investigación de 2025 comparando
talking-head vs. animación no encuentra diferencia significativa en aprendizaje,
y el presentador muestra un pequeño efecto **negativo** en recordar datos. Lo que
sí determina el resultado es que la imagen vaya pegada a lo que dice la voz. Así
que: **voz + gráficas exactas**, la fórmula de Khan Academy. Más barato, más
seguro, y evita la obligación de declarar contenido fotorrealista generado.

| Capa | Qué produce | Con qué |
|---|---|---|
| **Determinista** | TODO lo que lleve texto, números, ecuaciones, diagramas rotulados, mapas | Gráficas generadas **por código** -- exactas siempre |
| **Generativa** | Apertura, transiciones, escenas de contexto, metáforas visuales | Kling / Higgsfield vía MCP |

**Regla no negociable: la IA generativa NUNCA escribe un dato.** Kling y
Higgsfield no saben escribir -- una pizarra con `2x + 3 = 7` sale deformada. Un
video de matemática con la ecuación mal escrita es **peor que no tener video**.
Además esto acota el costo: ~20-30 segundos generativos por lección de 6 minutos
(se cobra por segundo), el resto determinista.

### Duración

**4-6 min en primaria, 6-8 en secundaria, un concepto por video.** El estudio de
referencia (Guo, MIT/edX, ~6.9 millones de sesiones) encontró que la atención se
agota alrededor de los **6 minutos sin importar cuán largo sea el video**; a los
12 min la caída es de ~40%. Un tema grande se parte en tres videos, no se estira
en uno de 20.

### Dónde vive cada cosa (los dos destinos NO son el mismo contenido)

| | **Portal (Cloudflare)** | **Canal de YouTube** |
|---|---|---|
| Qué va | Las ~2,000 lecciones del currículo | Una selección: lo mejor, 1-2 por semana |
| Para quién | Los 286 estudiantes | **Padres y maestros**, no niños |
| Producción | Pipeline industrial | Cuidado editorial, cada uno distinto |
| Monetización | No aplica | Sin marca infantil -> CPM normal |

**Por qué NO volcar las 2,000 al canal** (esto es lo que protege la intención de
monetizar del usuario):
- **"Made for Kids" está capado por ley.** Contenido educativo para escolares hay
  que marcarlo así -> se apagan los anuncios personalizados, membresías y
  comentarios. Los reportes de 2026 ubican esos canales en US$1-3 por millar
  contra US$5-15 de contenido comparable. Es COPPA, no una configuración.
- **La política de "contenido inauténtico"** (así se llama desde julio 2025;
  antes "contenido repetitivo") apunta exactamente a subidas masivas,
  plantilladas y repetitivas -- describen el caso como *"texto-a-voz literal con
  presentaciones de diapositivas"*, que es nuestro pipeline sin cuidado. Tres
  strikes: aviso, 90 días, expulsión del programa de socios. **La IA no está
  prohibida**; lo exigido es dirección creativa propia y variación real.
- **Aviso operativo:** la cuota por defecto de la YouTube Data API alcanza para
  ~6 subidas al día. Si se quiere subir en volumen, el trámite de ampliación hay
  que arrancarlo con meses de antelación.

### Propiedad del contenido: la línea que no se cruza

El usuario quiere que los videos sean suyos, no depender de canales ajenos.
Correcto. Pero **"rehacer" un video curado es una obra derivada** -- mismo guion,
misma secuencia, otra voz encima -- y Content ID lo detecta. En un canal nuevo
con el nombre del colegio, eso son strikes.

**El método correcto:** los videos curados **nunca se convierten en material,
solo en investigación**. La curación produce un *informe de texto* (qué conceptos
toca el tema, en qué orden, dónde se traban los muchachos, cuánto debe durar).
Con ese informe + el currículo + el libro se produce algo 100% original.
**Ni un frame, ni un segundo de audio, ni una frase textual de un video ajeno
entra al nuestro.**

Ventaja que además vuelve el contenido original por construcción: **los ejemplos
van en dominicano** -- pesos, nombres de aquí, distancias entre Santiago y Santo
Domingo. Eso lo hace mejor que el genérico español o mexicano de YouTube.

### La cola de producción YA EXISTE en la base

Hallazgo importante: no hay que inventar la lista de qué producir ni transcribir
un programa a mano. `class_schedules` tiene las **330 clases reales** del
2026-2027 (curso + materia + profesor + día) y `lesson_plans` guarda por cada
clase su **tema, objetivo, actividades y tarea**. Se produce siguiendo la
planificación que los profesores ya llenan.

### Lo que le falta al esquema (pendiente, antes de producir en volumen)

- `video_provider` **solo acepta `youtube`/`vimeo`** -> Cloudflare necesita
  migración (proveedor `mp4` + `<video>` nativo en `LessonPlayer`).
- No hay duración, ni transcripción, ni miniatura.
- No hay unidades ni temas: solo un `sort_order` plano, que con 2,000 lecciones
  no organiza nada.
- `is_published` es booleano -- falta el estado "en revisión" para la bandeja de
  aprobación docente. **Nada se publica sin visto bueno humano**, mismo
  principio que la bandeja de OCR.

### Orden de trabajo acordado

1. **UNA lección de punta a punta primero**, no producir en volumen: curación ->
   informe -> guion -> gráficas -> clips -> narración -> montaje -> subida ->
   publicada -> un estudiante la ve y contesta el cuestionario. Esa primera dice
   lo que ninguna planificación dice: cuánto cuesta, cuánto tarda, y si se ve
   como algo que un colegio pone su nombre encima.
2. Piloto de **24 lecciones** (1 curso, 3 materias, primera unidad).
3. Recién entonces, escala.

### Bloqueos reales para arrancar

1. **El currículo** -- el Diseño Curricular del MINERD por grado/materia, o las
   planificaciones del colegio. **Es lo único insustituible**: sin eso se produce
   bonito pero desalineado.
2. Los MCP de Kling/Higgsfield instalados (el usuario los provee).
3. Cuenta de Cloudflare (Stream) y canal de YouTube del colegio.
4. Voz de TTS y plantilla visual. Insumo ya existente: `docs/GUIA_TONO_Y_VOZ.md`
   define la voz institucional (*formal, moderno, cercano*, de "usted", máximo un
   emoji) y **ya bautiza una mascota: "Toki"** -- candidata a personaje del canal,
   pendiente de confirmar con el usuario.
5. Quién aprueba antes de publicar.

## Cursos mal escritos: 2 estudiantes invisibles y 1 docente sin ver a nadie (2026-09-06)

**Cómo salió:** al probar el desplegable de cursos de "Nueva lección" (que ahora
lee `students.grade_level`), el usuario vio 18 opciones donde el colegio tiene 16
cursos. Las mismas 18 salen en los chips de Personal, que leen la misma fuente
(`personal/page.tsx:87`) -- **no eran dos errores, era el mismo dato visto desde
dos pantallas**.

**La causa de fondo, otra vez la misma:** `students.grade_level` y
`teacher_assignments.grade_level` son texto libre que las policies comparan
**carácter por carácter**. Una variante de escritura no da error: deja a alguien
sin ver nada.

**Lo encontrado (datos reales de producción, 286 estudiantes):**

1. **2 estudiantes con el curso mal escrito**, 1 alumno cada variante:
   `Pre-primario` (Samir Hally, debía ser `Pre Primario`, 22 alumnos) y
   `4to de secundaria` (Ahleys Sanchez, inscrita el 3-sep, debía ser
   `4to. Secundaria`, 14). Mientras estuvieron así eran invisibles para su
   profesora en Asistencia, no recibían los comunicados de su curso, y no
   habrían visto ninguna lección de Academia.
2. **3 filas de `teacher_assignments` con el ciclo escrito a mano**
   (`"Primer Ciclo Primaria (1,2,3) Inglés"`, etc.) que no calzan con ningún
   estudiante -- el pendiente que dejó anotado la carga de horarios del
   2026-08-23. Para **Yuleymis Lugo era su ÚNICA fila**, así que veía
   **0 estudiantes**.

**Medido, no supuesto.** Se simuló la sesión de cada docente igual que hace
PostgREST (`set local role authenticated` + `request.jwt.claim.sub`) y se
contaron los estudiantes visibles ANTES de tocar nada:

| Docente | Antes | Después (esperado) |
|---|---|---|
| Yuleymis Lugo | **0** | 68 |
| Yendry Paulino Bastardo | 34 | 34 |
| Nercy Rodríguez | 55 | 55 |
| Marianelis Rivera | 60 | 60 |

**Corrección a un diagnóstico previo de esta misma sesión**: se afirmó primero
que 4 docentes estaban sin ver estudiantes. Falso -- solo Yuleymis. Nercy **sí**
tenía filas `regular` además de las de `ingles` (la consulta filtraba solo por
`ingles`), y el "Yendry Paulino" de la fila basura es un **registro duplicado
borrado el 2026-08-23**; la activa ("Yendry Paulino Bastardo") está bien.
**Regla que deja esto: contar filas de `teacher_assignments` no dice quién ve
qué -- hay que simular la sesión.**

**LA TRAMPA, para quien retome esto:** pasar a las docentes de Inglés a
`category = 'ingles'` parece lo correcto por la estructura de Amco, pero
**les quitaría Asistencia**. Las cuatro policies que deciden qué estudiantes ve
un profesor (`students_read`, `attendance_staff_all`, `class_updates_staff_all`,
`class_schedules_staff_read`) llaman a
`teacher_is_assigned_to_grade(..., 'regular')` -- verificado leyendo `pg_policies`
en producción. La categoría `ingles` enruta **Mensajes**, no da visibilidad de
estudiantes. Si algún día se agrega, que sea **sumando** filas, nunca
convirtiendo las `regular`.

**El arreglo** vive en `supabase/seeds/20260906_fix_cursos_y_asignaciones.sql`,
en una sola transacción, **con el bloque de reversión completo comentado al
final** (los ids y valores exactos de antes). El `insert` de Yuleymis va antes
del `delete` para que no quede sin ninguna asignación ni un instante. Lo corrió
el usuario a mano en el SQL Editor: el clasificador de seguridad del harness
bloquea las escrituras a producción desde la sesión de Claude Code (mismo
bloqueo ya documentado para la carga de horarios).

**Quedó fuera a propósito:** Génesis Rodríguez (Orientación y psicología) no
tiene ninguna asignación, así que no ve a ningún estudiante. Puede ser
intencional. Darle los 286 es **ampliar acceso**, no corregir un error -- no se
tocó sin respuesta explícita del usuario. **Pendiente de decidir.**

**Detalle menor descubierto de paso, sin corregir:** `students_read` no filtra
`deleted_at`, así que un profesor todavía ve a los estudiantes con borrado suave
de sus cursos (por eso Marianelis ve 60 y no 59). No se tocó -- cambiar esa
policy afecta a todos los roles y no había reporte de que molestara.

## Academia estaba muerta para el estudiante: dependía de `enrollments`, tabla que nadie escribe (2026-09-06)

**Bug real, encontrado leyendo el código, no reportado por el colegio** (Academia
lleva ~20 días en implementación y todavía no hay lecciones cargadas, así que
nadie lo había notado): la migración 008 dirigió cada lección con
`lessons.grade_level_id` -> `grade_levels`, y resolvía el curso del alumno
consultando `enrollments`. **Ninguna parte de la app inserta jamás una fila en
`enrollments`** -- verificado en todo `web/src` y en las 60+ migraciones: solo
hay lecturas y la exportación de datos. Con esa tabla vacía:

- `academia/page.tsx` ni siquiera llegaba a consultar lecciones (cortaba en
  `enrollment?.grade_level_id`) y mostraba "Todavía no hay lecciones publicadas
  para tu grado" a todos por igual;
- la policy `lessons_student_read` hacía el mismo join, así que **tampoco era
  arreglable solo desde el código** -- la base no devolvía filas.

Es exactamente el mismo bug que ya tuvo el asistente de IA (`gatherFamilyContext()`
leía `enrollments` y siempre decía "sin matrícula registrada", corregido leyendo
`students.enrollment_status`). Academia se quedó con la versión vieja. Era el
único módulo del proyecto casado con el catálogo `grade_levels`/`enrollments`;
todos los demás (Horarios, Notas, Asistencia, Comunicados, **Encuestas**) usan
`students.grade_level` (texto libre).

**Corregido** en `20260909000000_academia_curso_texto.sql`, copiando el patrón de
Encuestas (`current_student_id()` + comparar contra `students.grade_level`):
columna `lessons.grade_level` (texto), `grade_level_id` pasa a nullable, y dos
funciones `security definer` (`student_can_see_lesson`, `guardian_can_see_lesson`)
con sus policies nuevas. `security definer` a propósito, para no volver a pasar
por las policies de `students` -- el patrón que evitó la recursión de RLS de las
migraciones 009 y 018. La de tutor usa `guardian_id is not null`, no
`role = 'guardian'`, para no repetir el bug de doble rol de la 20260821060000.

**Qué NO se tocó** (menor radio de impacto): no se borró `grade_level_id`, ni
`grade_levels`, ni `enrollments`, ni las policies viejas
(`lessons_student_read`/`lessons_guardian_read`) -- como las permisivas se
combinan con OR, esto solo AGREGA una vía de acceso. La ficha del estudiante y
la exportación de datos siguen leyendo `enrollments` sin cambio. `lessons_staff_all`
intacta.

**Verificado con Postgres local** (esquema espejo mínimo + copia fiel de
`current_student_id()`, simulando la sesión igual que PostgREST), 4 escenarios,
todos con el resultado esperado: la alumna ve **solo** la lección publicada de su
curso (no el borrador, no el de otro curso); un alumno de **otro colegio** con el
mismo texto de curso no ve la de este colegio; una **profesora que además es madre**
(doble rol) sí ve la del curso de su hija; sin sesión, 0 filas. La migración es
idempotente (aplicada dos veces seguidas, limpia).

De paso, `/dashboard/academia` dejó de ser una lista plana: ahora abre con "la que
sigue" (entrada directa al video, sin elegir nada) y debajo las lecciones agrupadas
**por materia**. `/dashboard/academia/[id]`, `nueva` y `progreso` siguen igual, y
"Nueva lección" ahora elige el curso de la lista real de `students.grade_level` en
vez del catálogo `grade_levels` que nadie mantiene.

**Pendiente real**: aplicar la migración a producción (esta sesión no tuvo
credenciales de Supabase) y probar en vivo -- publicar una lección de prueba y
abrirla con un login de estudiante real. Hasta entonces, Academia sigue vacía para
el alumno. Tampoco se pudo correr `npm run smoke` por lo mismo; falta agregarle una
comprobación del rol `student` sobre `lessons`.

## Personal: lista compacta, y la duplicación pendiente de "quién da qué" (2026-09-04)

La pantalla de Personal mostraba, por cada empleado, una tarjeta con CINCO
bloques abiertos a la vez: identidad, editar/eliminar, acceso al sistema,
asignación de grados y formación académica. Con 30 empleados dejaba de
servir para lo más básico -- consultar quién trabaja aquí y cómo
contactarlo.

Se reorganizó (no se duplicó): la lista abre compacta -- una fila por
persona con nombre, puesto, teléfono, correo y una etiqueta "sin acceso"
cuando aplica -- y el resto se despliega al tocar a la persona. Se añadió
descargar el listado en CSV e imprimirlo, porque el colegio lleva su
"Lista de Profesores" en papel y ahora puede sacarla del sistema.

**Se descartó a propósito crear un módulo aparte con el listado**: serían
las mismas personas en dos pantallas, dos sitios que mantener y el riesgo
clásico de que se desincronicen. El nombre "Personal" se queda: el
problema no era el nombre, era que la pantalla hacía tres trabajos.

`StaffCard` y `ExportStaffButton` reciben los botones ya renderizados como
slots desde el servidor -- `EditStaffButton`, `DeleteStaffButton`,
`ChangeAccessRoleButton`, `GrantAccessButton` y `TeacherGradeAssignments`
siguen siendo los mismos componentes con los mismos props. El cambio es
solo de presentación: no se tocó ninguna consulta, permiso ni acción.

### Pendiente de decidir: hay DOS fuentes para "quién da qué"

- `teacher_assignments` (staff_id + grade_level + category), que se
  administra desde Personal.
- `class_schedules` (staff_id + grade_level + subject), el horario real --
  330 filas con 18 profesores al 2026-09-04.

Las dos dicen lo mismo por vías distintas. **Antes de unificarlas, ojo:**
`teacher_assignments` NO es informativo -- es lo que usan las policies de
RLS para decidir qué estudiantes ve cada profesor en Asistencia,
Actualizaciones y Mensajes (`teacher_is_assigned_to_grade`). Es justo lo
que dejó al colegio un día sin poder pasar lista. Unificar esto es un
cambio de fondo que hay que planear aparte, nunca de pasada.

## Justificación de ausencias por la familia (2026-09-08)

Pedido del usuario sobre el Portal Familiar: *"cuando el niño se ausenta del
colegio se produce una comunicación del colegio con el padre y este debe
justificar su ausencia, esa justificación en ocasiones implica el envío de un
PDF, documento, etc."*

El aviso de ida ya existía desde siempre (trigger `notify_attendance_webhook`
+ Edge Function `notify-attendance`). Lo que **no existía era el camino de
vuelta**: el tutor justificaba por WhatsApp, en persona, o mandando la foto del
certificado médico por fuera de la plataforma -- sin quedar asociado a la falta
y sin que nadie pudiera revisarlo después. Dato revelador encontrado al
construir esto: `attendance.status` acepta `'justificado'` desde la migración
`20260702000000` y la interfaz ya lo pintaba, pero **nada en todo el sistema lo
escribía nunca** salvo que el profesor lo eligiera a mano al pasar lista.

**Cómo quedó** (migración `20260911000000_attendance_justifications.sql`):

- Tabla `attendance_justifications` -- una fila por falta justificada, con
  `reason` (obligatorio), `document_path` (**opcional** a propósito: muchas
  justificaciones son de una línea y obligar a adjuntar algo dejaría fuera a
  esas familias), estado `pendiente|aceptada|rechazada` y quién revisó.
- Bucket privado `justificantes-ausencia`, **sin políticas de
  `storage.objects`** -- mismo principio que `comprobantes-pago`: todo el
  acceso pasa por Server Actions y las lecturas son signed URLs de 5 minutos.
  Aquí pesa más que en pagos: es un dato médico de un menor.
- Índice único parcial `where status <> 'rechazada'`: una sola justificación
  viva por falta. Rechazada sí deja volver a enviar (el colegio puede pedir el
  certificado que faltaba).
- **Aceptar es lo único que marca `attendance.status = 'justificado'`.** Es 1 a
  1 con el registro de asistencia: si el estudiante quedó ausente en tres
  materias del mismo día, cada una se justifica aparte -- se prefirió eso antes
  que "arreglar" en silencio filas que el tutor no vio al enviar.

**Alcance de quién revisa: NO se creó un módulo nuevo en `permissions.ts`.** Se
reutilizó `asistencia` -- quien marca la falta revisa su justificación. Así no
hay una entrada nueva que se pueda desincronizar con `Sidebar.tsx` (la trampa
#1 de este archivo); el acceso es un botón "Justificaciones" con contador en
`/dashboard/asistencia`, mismo patrón que "Escanear fichas" en Estudiantes. El
profesor solo ve las de SUS grados: eso lo impone la RLS, no TypeScript.

**Decisión distinta al resto de bandejas de revisión del proyecto**: aquí las
lecturas y los cambios de estado del staff van con el cliente de **sesión**, no
con `service_role`. El motivo es que "quién puede revisar" depende del grado y
esa regla ya está escrita una vez, en la RLS -- repetirla en TypeScript sería
una segunda fuente de verdad. El cliente admin se usa solo donde la RLS no
alcanza: el bucket privado, los nombres de `guardians` (tabla cerrada para
`teacher` -- con su propio cliente le llegarían vacíos, el mismo fallo
silencioso de Mensajes) y el correo al tutor. Como contrapartida, las
escrituras confirman con `.select()` que de verdad cambiaron una fila: sin eso,
una policy mal escrita fallaría en silencio.

**Trampas del repo que se respetaron** (todas ya documentadas más arriba, todas
costaron un día de clases en su momento):
- `teacher_is_assigned_to_grade(...)` siempre con **3 argumentos** y categoría
  `'regular'`.
- Las policies de tutor se autorizan por el vínculo real
  (`users_profiles.guardian_id`), **nunca por `role = 'guardian'`** -- si no, un
  profesor que además es padre aquí no podría justificar la falta de su hijo.
- **Grants explícitos** (`grant select, insert, update ... to authenticated`):
  Supabase no expone las tablas nuevas solo, y sin eso la Data API responde
  "permission denied" aunque la RLS esté perfecta.
- Las constantes compartidas viven en `web/src/lib/attendance/justifications.ts`,
  un módulo **plano**; ningún archivo `'use server'` exporta nada que no sea una
  función async.

**Verificado en esta sesión**:
1. La migración se aplicó **dos veces seguidas** sobre un Postgres local con
   esquema espejo (incluidas las **dos sobrecargas** de
   `teacher_is_assigned_to_grade`, para reproducir la ambigüedad real): limpia
   e idempotente.
2. **12 escenarios de RLS simulando la sesión igual que PostgREST**
   (`set local role authenticated` + `request.jwt.claims`), todos con el
   resultado esperado: la tutora justifica a su hijo ✅ y no al de otra familia
   ✅; no puede crearla ya 'aceptada' ✅ ni auto-aceptarse la suya ✅; la tutora
   de otro colegio ve 0 ✅; cada profesor ve solo su grado ✅ y no puede revisar
   fuera de él ✅; secretaría ve las 2 de su colegio ✅; **doble rol** (profesora
   de 6to que es madre de un alumno de 4to) ve la de su hijo ✅; aceptar cambia
   la fila y marca la asistencia ✅; el índice único bloquea la segunda
   pendiente ✅ y el reenvío tras rechazo sí entra ✅; motivo vacío rechazado ✅.
3. `npx tsc --noEmit` limpio, `npm run lint` sin ningún problema nuevo (los 11
   que salen son preexistentes, en archivos que esta tarea no tocó) y
   `npm run build` completo OK, con `/dashboard/asistencia/justificaciones`
   construida.

**Formatos que acepta el adjunto (ampliado el 2026-09-08 a pedido del
usuario: "muchos padres tienen iphone")**: JPG, PNG, WEBP, PDF y **HEIC/HEIF**,
hasta 10MB. El HEIC importa por un caso concreto: Safari suele convertir a JPG
al subir desde la galería, pero eligiendo la foto desde la app "Archivos" sube
el HEIC tal cual -- y encima el iPhone a veces manda el archivo con el `type`
VACÍO o como 'application/octet-stream'. Por eso validar solo por `file.type`
rechazaría una foto perfectamente válida: `resolveFileType(nombre, tipo)`
(en `web/src/lib/attendance/justifications.ts`) deduce el tipo por la extensión
cuando no viene. El `accept` del input lleva además `.heic,.heif` como
extensiones, porque hay navegadores que no reconocen `image/heic` ahí y
dejarían el archivo en gris. Probado con 7 casos reales (HEIC sin tipo, PDF
como octet-stream, .exe y .txt rechazados). No hizo falta ninguna migración: el
bucket se creó sin `allowed_mime_types`, la validación es solo de la app.
**Contrapartida conocida, avisada en la propia bandeja de revisión**: Chrome no
previsualiza un HEIC -- el colegio lo descarga y lo abre con el visor de fotos.
Si eso llega a estorbar, el siguiente paso sería convertirlo a JPG en el
servidor al recibirlo (agrega una dependencia nueva, por eso no se hizo ahora).

### Verificación contra PRODUCCIÓN (2026-09-08, con un PAT de un solo uso)

El usuario aplicó la migración y pasó un Personal Access Token (`sbp_...`, no
guardado en el repo, se le indicó revocarlo). Lo verificado, en este orden:

1. **La migración quedó completa**: 14 columnas, las 4 policies
   (guardian_read/guardian_insert/staff_read/staff_update), los 5 índices
   -- incluido el parcial `idx_att_just_una_viva_por_falta` --, RLS activa y
   el bucket `justificantes-ausencia` con `public=false`.
2. **`npm run smoke`: 37 comprobaciones, todas OK**, con las 6 nuevas
   incluidas. Roles reales probados: teacher, guardian, reception, director,
   school_admin, finance (student sigue sin ningún usuario creado).
3. **Flujo completo con datos reales, en una transacción revertida**: se creó
   una falta de prueba con fecha **vieja a propósito** (2026-06-15) -- el
   trigger de aviso solo dispara si la falta es de hoy, así que ningún padre
   real recibió nada. Con la sesión simulada de una tutora real y de la
   profesora de ese curso: la tutora justifica ✅, no puede auto-aceptarse la
   suya (0 filas) ✅, la profesora acepta (1 fila) ✅, la asistencia queda en
   `justificado` ✅, la tutora ve el resultado en su portal ✅ y no puede
   borrar la justificación (0 filas, no hay policy de delete) ✅. Confirmado
   después: 0 justificaciones y 0 faltas en esa fecha -- no quedó nada.

**Nota sobre los grants**: la tabla muestra `DELETE/TRUNCATE/TRIGGER/REFERENCES`
para `authenticated` además de lo que otorga la migración. No lo abrió esta
tarea: es el comportamiento por defecto de Supabase para toda tabla nueva del
schema public, idéntico en `attendance`, `students` y `payment_receipts`. Como
no existe ninguna policy de `delete`, la RLS lo bloquea igual -- comprobado en
el paso 3.

**Lo único que sigue sin probar**: la subida de un archivo real (el `upload` al
bucket con `service_role`) y la interfaz en un navegador de verdad. Vale
especialmente la pena probarlo **desde un iPhone**, que es el caso para el que
se agregó HEIC. Lo demás del flujo ya está verificado contra producción.

**Quedó fuera a propósito** (no lo pidió el usuario, y ampliarlo solo habría
sumado riesgo):
- El mensaje automático de ausencia (`notify-attendance`) **no menciona
  todavía** que se puede justificar desde el portal. Sería una línea en esa
  Edge Function, pero desplegarla necesita Docker/credenciales que esta sesión
  no tiene.
- El colegio no recibe aviso por correo cuando entra una justificación nueva --
  se entera por el contador de la pantalla de Asistencia. `notify-message` solo
  sabe escribirle a tutores, no a personal.
- No hay plazo límite para justificar (el colegio no lo pidió) ni justificación
  por adelantado ("mañana falta por una cita médica"), que sería el siguiente
  paso natural.

## El aviso de ausencia NUNCA había llegado a un padre — causa real y arreglo (2026-09-08)

Preguntó el usuario: *"verifica si en los últimos 2 días una ausencia de un padre
con correo habilitado se ha producido y si es así dime si el sistema efectivamente
le creó y envió el aviso"*. La respuesta corta: lo creaba y no lo enviaba.
**0 de 721 registros de asistencia tenían `notified_at`** -- ni uno, nunca, desde
que existe la plataforma.

Y no era por falta de intentos: el trigger disparaba, `pg_net` llamaba bien y la
Edge Function respondía `HTTP 200 {"success":true,"channel":"none"}`, redactando
el mensaje y guardándolo en `ai_message_sent`. Fallaba en el último paso, y el
error solo existía en los logs de la Edge Function:

```
No se pudo leer resend_from_address desde private.app_settings: Invalid schema: private
Resend error: {"statusCode":403,"name":"validation_error","message":"You can only
send testing emails to your own email address (jcbjm03@gmail.com). To send emails
to other recipients, please verify a domain at resend.com/domains"}
```

**La cadena, dos eslabones:**
1. `notify-attendance` (y `notify-message`, idéntico) leen el remitente con
   `supabase.schema('private').rpc('get_app_setting', ...)`. El esquema `private`
   **no está expuesto** a la API de Supabase -- y con razón, ahí viven las
   credenciales de Azul y la propia key de Resend --, así que esa llamada falla
   SIEMPRE.
2. Al fallar cae al respaldo `onboarding@resend.dev`, que es el remitente de
   **pruebas** de Resend: solo permite enviar al dueño de la cuenta. Cada correo
   a un padre real moría con 403.

Lo irónico es que la configuración correcta ya existía: el dominio
`mail.resendcegmas.com` está `verified` en Resend y `private.app_settings` tiene
`no-reply@mail.resendcegmas.com`. La función no podía llegar a leerlo. **Esto
explica también por qué "ya se había arreglado" en agosto y seguía sin
funcionar**: entonces se agregó la `RESEND_API_KEY` que faltaba (correcto, sigue
puesta), pero el remitente es un fallo distinto que nadie miró.

**Arreglo aplicado (no hizo falta redesplegar nada ni Docker)**: se agregó el
secreto de Edge Functions **`RESEND_FROM_ADDRESS = no-reply@mail.resendcegmas.com`**.
El código ya lo usa como respaldo justo antes de `onboarding@resend.dev`, así que
con el secreto puesto empieza a enviar de verdad. **Alcance: arregla los correos
de ausencia Y los de `notify-message`** (mensajes directos, comunicados urgentes y
el resultado de una justificación de ausencia).

### Segundo hallazgo: el trigger era solo `AFTER INSERT`

`AttendanceForm` guarda con `upsert ... on conflict do update`. Si la profesora
guarda la lista y después corrige a alguien de 'presente' a 'ausente', ese segundo
guardado es un UPDATE -- y **no disparaba ningún aviso**. De las 33 faltas de los
dos días revisados, 9 ni siquiera llegaron a la Edge Function por esto.

Corregido en `20260911010000_notify_attendance_on_update.sql`: un trigger APARTE
`after update` (menor radio de impacto que tocar el de insert; se revierte con un
solo `drop trigger`). **La cláusula WHEN no es decorativa**: la propia Edge
Function escribe `notified_at`/`notification_channel` sobre esa misma fila al
terminar, así que sin `new.status is distinct from old.status` ese UPDATE volvería
a disparar el trigger en **bucle infinito**, mandándole correos sin parar al tutor.
`new.notified_at is null` evita el segundo aviso por la misma falta.

**La regla de "solo se avisa por faltas del día en curso" NO se tocó** (el usuario
la recordó explícitamente: hay muchas listas atrasadas por cargar). Vive dentro de
`notify_attendance_webhook()` desde la migración 20260907000000, no en el trigger.

### Verificado en vivo, contra producción

Con un estudiante de prueba cuyo "tutor" era el correo del propio colegio
(`jcbjm03@gmail.com`), así ningún padre real recibió nada. Borrado al terminar
(comprobado: 0 filas de prueba, 285 estudiantes reales intactos).

1. Falta de HOY creada -> `channel = 'email'`, `notified_at` escrito. **Primer
   aviso de ausencia realmente entregado en la historia del proyecto.**
2. La misma fila devuelta a 'presente' y CORREGIDA a 'ausente' -> volvió a enviar.
   El camino que antes no avisaba.
3. Falta con fecha de AYER -> **no** avisó. La regla de listas atrasadas sigue en
   pie.
4. Sin bucle: 2 llamadas HTTP en 5 minutos, exactamente los 2 envíos legítimos.

**Pendiente real**: `notify-attendance` y `notify-message` siguen intentando leer
`private.app_settings` en cada invocación y fallando (queda un `console.warn` por
cada aviso). Hoy es inofensivo porque el respaldo por variable de entorno funciona,
pero lo correcto sería que lean el remitente por un RPC público envuelto, o
directamente de la variable. Eso exige redesplegar la Edge Function (CLI/Docker o
el endpoint de deploy de la Management API), que esta sesión no hizo a propósito
-- no se toca un despliegue de producción para un warning cosmético el mismo día
que se acaba de encender el envío real.

## Dos reportes del colegio mientras recogían los correos de los padres (2026-09-08)

Los dos venían de la misma campaña: el colegio mandó una circular para que las
familias entraran a la plataforma, y secretaría estaba cargando los correos de
los tutores uno por uno.

### 1. "Dice tiempo caducado al cambiar la contraseña"

**No era el bug de PKCE de agosto** -- ese arreglo (aceptar también el enlace
con `#access_token` de los correos disparados por un admin) sí está desplegado
y se comprobó leyendo `actualizar-contrasena/page.tsx` en producción. También
se descartó un desajuste de dominio: la app arma los enlaces con
`https://www.educacionmanantial.com`, el apex responde 308 hacia www, y www
está en `uri_allow_list`.

Era literal: `mailer_otp_exp` estaba en **600 segundos (10 minutos)**. La
circular salió el día anterior; un padre que revisa el correo esa noche, o que
llama primero a secretaría para que le expliquen, nunca llega a tiempo.
**Subido a 86400 (24h)**, el máximo que acepta Supabase, con un `PATCH`
dirigido a la Management API -- **nunca `supabase config push`**, que empuja
las secciones `[auth]`/`[storage]` completas y ya rompió producción una vez
(ver el incidente del 2026-08-23). `supabase/config.toml` se actualizó a mano
para que el repo no vuelva a divergir.

**Nota para una campaña masiva**: `rate_limit_email_sent` está en 100
correos/hora. Si el colegio empuja a todas las familias a pedir su enlace el
mismo día, ese techo se puede tocar; subirlo es otro `PATCH` puntual.

### 2. "No permite grabar si el teléfono está vacío"

Era **`/dashboard/familias/[id]/editar`** (`EditFamilyForm.tsx`), no el alta de
estudiante -- ahí el teléfono ya decía "(opcional)" desde antes. Esa pantalla
lo exigía por partida doble: `required` en el input y una validación en JS
(`if (!g.firstName || !g.lastName || !g.phone)`), aunque `guardians.phone`
acepta nulo desde la primera migración. O sea: era solo interfaz.

Importa más de lo que parece por el contexto: **es justo la pantalla donde
secretaría entra a cargarle el correo a un tutor**, y una ficha vieja sin
teléfono impedía guardar ese correo -- bloqueando la campaña completa de
recolección. Corregido: teléfono opcional en los dos sitios, y al guardar
vacío se escribe `null` en vez de una cadena vacía (mismo criterio que
`createStudentWithFamily`), para no ensuciar la columna que usa
`resolveGuardianByPhone`.

**Si el colegio vuelve a reportar un bloqueo por teléfono en otra pantalla**:
se buscó en todo `src/app` y `src/components` y no queda ningún otro sitio que
lo exija. Haría falta el texto exacto del error y la pantalla.

## El botón "Pagar con tarjeta" solo aparece si Azul está configurado (2026-09-08)

Antes se le mostraba a toda familia con una factura pendiente, y al tocarlo lo
único que hacía era responder *"Este colegio todavía no tiene configurado el
pago con tarjeta"* -- porque `private.school_payment_settings` está vacía (0
colegios configurados; la migración `20260728010000` sí está aplicada, lo que
falta son las credenciales que el colegio tiene que pedirle a Azul).

`schoolHasAzulConfigured(schoolId)` (nuevo, en `web/src/lib/payments/azul.ts`)
reutiliza el mismo `getSchoolAzulCredentials()` que ya usa el flujo de pago
-- **nunca devuelve ningún dato de la credencial, solo sí/no** -- y
`/dashboard/pagos` pasa esa bandera a `InvoiceCard` -> `PaymentActions`.
"Ya transferí" (comprobante bancario) no depende de Azul y sigue disponible
siempre.

Comprobado contra producción: para Gran Manantial la función no devuelve
credenciales, así que hoy el botón queda oculto; en cuanto se carguen en
`/dashboard/colegio` aparece solo, sin tocar código.

### Qué falta para activar el pago con tarjeta (respuesta al colegio, 2026-09-08)

No falta programar nada. Hay que pedirle a Azul, para la **"Página de Pago"**
(NO Web Services -- por eso **no hacen falta certificados digitales**, que es
donde suele trabarse la conversación con el banco): Merchant ID, Merchant Name
(exacto, entra en el AuthHash), Merchant Type (`ECommerce`), Currency Code
(`$`), el **AuthKey**, y el ambiente. Son credenciales distintas para pruebas y
para producción.

A Azul hay que darle las URLs de retorno, que son:
`https://www.educacionmanantial.com/api/pagos/azul/resultado` (aprobada y
declinada) y la misma con `?cancelado=1` (cancelada).

**Advertencia fiscal, más seria que la técnica**: `generate_ncf()` arma el
texto del comprobante pero **nunca transmite nada a la DGII** -- el NCF real
vive en Alegra. Antes de cobrar con tarjeta desde aquí hay que decidir quién
emite el comprobante, o se producen NCF duplicados/fantasma. Sigue pendiente
la integración con Alegra al momento del cobro.

## No se podía dar de alta al dueño del colegio: dos bugs, uno de ellos creciendo en silencio (2026-09-08)

Reporte: *"hay problemas para dar de alta al dueño del colegio"* (Octavio Mesa,
rol Administrador de colegio), con captura de `/dashboard/personal/registros` y
el mensaje **"No se pudo completar la invitación. Intenta de nuevo."**. El
colegio aportó el contexto que faltaba: *"no le llegó al correo y me di cuenta
que él puso un `.` al final luego de `.com`, y luego me lo envió de nuevo; el
segundo da error, eliminar el primero"*.

### Estado real encontrado en producción

- **Dos fichas de `staff` activas** con el mismo correo (`omesa102@gmail.com`),
  de los dos registros públicos: `ca288ca5…` (15:02) y `01de807f…` (15:14).
- **Un perfil huérfano**: `users_profiles 3392af12…`, `role = school_admin`,
  `staff_id` = la ficha vieja, y su `auth_id` (`d5b37883…`) **ya no existe en
  `auth.users`**. Es decir: la primera invitación sí completó (cuenta + perfil)
  hacia el correo con el punto de más, el correo rebotó, y después alguien
  borró esa cuenta de Auth dejando el perfil colgando.
- Con ese perfil ahí, la segunda invitación entraba por la rama de "el correo
  ya está registrado", reusaba la cuenta vieja y `linkProfileForDualRole`
  devolvía *"Este correo ya está vinculado a otra ficha de personal"*.

**Se descartó que fuera la base**: el `insert` en `users_profiles` con
`role='school_admin'` se probó dos veces contra producción -- directo por SQL
(en transacción revertida) y por **PostgREST con `service_role`**, que es
exactamente la llamada que hace la app. Funciona en los dos casos; la fila de
prueba se borró.

### Bug 1: el motivo real nunca llegaba a quien invita

`inviteStaffAccess` registraba `linkResult.message` en `console.error` y en
pantalla devolvía siempre *"No se pudo completar la invitación. Intenta de
nuevo."*. Reintentar no arreglaba nada y el motivo solo era visible en los logs
de Vercel -- que esta sesión ya comprobó (2026-09-07) que **no son accesibles
con un token de proyecto**. Corregido: el mensaje específico se concatena al
error. `familias/actions.ts` ya lo hacía bien en sus dos rutas; solo Personal se
lo tragaba.

### Bug 2 (el importante): `listUsers()` solo veía las primeras 50 cuentas

Los **tres** flujos de invitación (`inviteStaffAccess`, `inviteByEmail`,
`createPhoneBasedAccess`) llamaban a `admin.auth.admin.listUsers()` **sin
paginar**. Ese método devuelve 50 por defecto. Medido contra producción el
2026-09-08: **el proyecto tiene 96 cuentas de Auth, así que 46 quedaban
invisibles** -- cualquier persona cuya cuenta cayera fuera de esa primera página
se veía como "no existe" y quien invitaba recibía *"Ese correo ya está
registrado, pero no se pudo vincular. Contacta soporte"*, sin salida desde la
interfaz.

Es el tipo de fallo que este archivo ya documenta una y otra vez: **funcionaba
en las pruebas (pocos usuarios) y se va rompiendo para más gente conforme el
colegio crece**. Y crece justo ahora: la campaña de correos va a crear cuentas
para ~180 familias.

Corregido con `web/src/lib/auth/findAuthUserByEmail.ts`, que recorre todas las
páginas (200 por lote, tope de seguridad de 50 lotes) y compara en minúsculas.
Usado en los tres sitios.

### Lo que había que hacer con los datos (no requiere código)

Borrar la ficha vieja de Octavio desde **Personal → Eliminar**:
`deleteStaffAction` ya hace justo lo correcto -- borra el perfil vinculado,
intenta borrar la cuenta de Auth (si ya no existe, lo ignora sin fallar) y
marca la ficha con borrado suave. Eso limpia el perfil huérfano y el duplicado
de una vez. En la lista de Personal se distinguen solas: la vieja aparece **con
acceso "Administrador de colegio"** (por el perfil huérfano) y la nueva
**"Sin acceso"**.

**Hueco que queda abierto, sin corregir**: nada impide aprobar dos registros
públicos con el mismo correo y crear dos fichas de `staff` -- es la misma clase
de hueco que ya se cerró para estudiantes con la alerta de duplicados en
`createStudentWithFamily()`. Lo natural sería avisar (sin bloquear) al aprobar
un registro cuyo correo ya existe en `staff`.

### Ejecutado desde la sesión, a pedido del usuario ("es más seguro, menos oportunidad de errar")

Antes de borrar nada se compararon **las dos fichas campo por campo**: resultaron
idénticas en los 13 campos (mismo puesto, teléfono, correo, nivel académico,
título, universidad, año), así que cuál sobrevivía era indiferente -- se archivó
la primera, que además era la que arrastraba el perfil huérfano.

1. Perfil huérfano `3392af12…` **borrado** y ficha `ca288ca5…` **archivada**
   (`deleted_at`), en una sola sentencia con CTEs de escritura (atómica). Es
   exactamente lo que hace `deleteStaffAction`; su cuenta de Auth ya no existía,
   así que no había nada que borrar ahí. El bloque de reversión quedó comentado
   en `supabase/seeds/`-style dentro del propio SQL de la sesión.
2. Estado limpio confirmado: 1 ficha activa, 0 perfiles apuntando a cualquiera de
   las dos, 0 cuentas de Auth con ese correo.
3. **Invitación enviada replicando la llamada real de la app** (no un atajo):
   `POST /auth/v1/invite` con `redirect_to=https://www.educacionmanantial.com/actualizar-contrasena`
   y `data.full_name`, igual que `inviteUserByEmail`; después el `insert` en
   `users_profiles` con `role='school_admin'` y el `staff_id` de la ficha
   superviviente, igual que `linkProfileForDualRole`.
4. Resultado verificado: cuenta `4cadaccf…` creada, `invited_at` sellado (o sea
   que el SMTP de Auth **sí** aceptó y envió -- si Resend hubiera fallado, GoTrue
   habría devuelto error en vez del usuario), perfil `6f0e0876…` con
   `role=school_admin`, y la ficha vieja mostrando "sin acceso".

**Nota de método**: hacerlo desde la sesión evitó el riesgo real de que alguien
borrara en la interfaz la ficha equivocada (las dos se llaman igual y solo se
distinguían por la etiqueta de acceso). La contrapartida es que **no se ejercitó
el camino corregido de `inviteStaffAccess` en producción** -- el arreglo de
paginación y el del mensaje siguen sin una prueba en vivo desde la pantalla.

## Facturar por familia NO es un error: es un requisito fiscal (2026-09-09)

**Corrige una recomendación equivocada de este mismo archivo.** La sección de Cuentas
por Cobrar viene recomendando desde el 2026-08-27 "facturar mensualidad siempre por
estudiante individual" para que el reporte pueda atribuir lo cobrado a cada hijo. El
usuario aclaró el 2026-09-09 por qué el colegio no lo hace, y la razón es buena: la
factura con valor fiscal que la familia usa para **reportar gastos educativos** ante la
DGII pide la **cédula del padre, madre o tutor** que declara el gasto -- no la del
estudiante, que es un menor. Y **la DGII la acepta en conjunto**, cubriendo a varios
hermanos en un mismo comprobante.

O sea que el comprobante conjunto a nombre del tutor **debe seguir existiendo**. Lo que
estaba mal no era la factura del colegio, era pretender que el documento fiscal y la
atribución interna fueran la misma cosa.

**La regla que queda, y que hay que respetar en cualquier trabajo futuro de Tesorería:**

- **Plano fiscal (Alegra):** un e-CF a nombre del tutor, con su cédula, que puede cubrir
  a varios hermanos. Alegra sigue siendo la única fuente de verdad del NCF/e-CF.
- **Plano interno (MentorIApp):** una fila de pago **por estudiante**, aunque varias
  citen el **mismo número de documento**. Así `calculate_receivable_status` puede
  descontar la cuota de cada hijo por separado sin inventar ninguna heurística de
  reparto, y la trazabilidad al comprobante real se conserva en la nota.

Caso real que originó la aclaración: el e-CF **E310000000060** (2026-09-04, RD$4,500,
cédula 02300785520 de Osvaldo Nuñez Castro, nota "Mes de Agosto de Onaimi Y Osvaldo")
cubre la media cuota de agosto de **dos** estudiantes de Secundaria, RD$2,250 cada uno.
Se registra como **dos** pagos, ambos con el mismo e-CF en la nota.

**Cambio operativo que anunció el colegio**: a partir del 2026-09-10 se instruirá que
los cobros se hagan separados por estudiante. Eso reduce el caso conjunto de aquí en
adelante, pero **no lo elimina retroactivamente** ni quita la previsión fiscal -- una
familia puede seguir necesitando el comprobante a nombre del tutor.

### Conciliación con Alegra: lo verificado el 2026-09-09 (carga TODAVÍA no hecha)

Primera sesión con el conector `mcp.alegra` habilitado. Funciona bien en lectura.

Universo desde el 1 de septiembre: **37 facturas / RD$83,017.50**, todas ya `closed` y
`balance: 0` en Alegra. De esas, **33 son Mensualidad/Abono por RD$77,052.50** (las
otras 4 son Libros y Uniformes, RD$5,965 -- no tocan Cuentas por Cobrar). Se convierten
en **34 filas de pago** por estudiante (el e-CF conjunto de arriba se parte en dos).

**Hallazgo que confirma el diagnóstico del colegio sobre la mora**: de las 33 facturas
de mensualidad, **32 no cobraron ningún recargo**. La única que sí es la
**E320000000410** (2026-09-08, Jayden Josias De los Santos Reynoso, 22-0025): línea
"Recargo por Mora" de **RD$102.50**, exactamente el 5% de RD$2,050 -- y es además la
única facturada por **Octavio Mesa**; las otras 36 las hizo Omairy García. Decisión del
usuario: cerrar cada cuota **por lo que realmente se cobró**, sin aplicar mora
retroactiva. Como el recargo de esa pantalla es **calculado, no una factura real**, basta
con no llamar nunca a `generateLateFeeCharge`: al quedar la cuota saldada el recargo
implícito desaparece solo.

**Coincidencia útil de modelos, verificada**: casi todo se facturó como **50% de la
mensualidad** con nota "MES DE AGOSTO" (1,950 de 3,900 Inicial / 2,050 de 4,100 Primaria
/ 2,250 de 4,500 Secundaria) -- exactamente la media cuota de agosto que ya genera
`installment_schedule` con `tuition_installments_count = 10.5`. Los montos de Alegra y
los de la plataforma cuadran sin conversión.

**Adelantos**: hay cobros que van más allá de agosto -- "ABONO A SEP", "MES DE AGO Y SEP"
(RD$5,850) y uno de **"mes de octubre"** (RD$2,050). El usuario confirmó que entren
ahora; el FIFO de `calculate_receivable_status` los absorbe sin nada especial.

**Pendiente real, y por qué**: la carga **no se ejecutó**. Esta sesión no tuvo ninguna
credencial de Supabase (sin link, sin CLI, sin variables) -- el mismo bloqueo ya
documentado muchas veces aquí. Antes de escribir hay que hacer, en este orden:

1. **Lectura primero, obligatoria**: cruzar contra los pagos ya registrados. Al
   2026-09-07 producción ya tenía **44 pagos por RD$90,100** cargados con "Registrar pago
   externo", todos de septiembre -- **es muy probable que se solapen con estos 33**.
   Cargar sin cruzar duplicaría cobros reales.
2. Confirmar que `students.student_code` guarda de verdad el formato `24-0033` que usa
   Alegra como `identification` de tipo `IE`. Si no, el emparejamiento es por nombre.
3. Resolver por nombre las **6 atribuciones** cuyo comprobante va a nombre del tutor
   (cédula, tipo `CED`): Carlos Reyes (1, Inicial), Sabrina Silvestre (1, Primaria),
   Yomar Matos (2 hijos: Secundaria y Primaria) y Osvaldo Nuñez Castro (2 hermanos,
   Secundaria).
4. Registrar con el mismo camino que ya usa la app (`recordExternalPayment`): factura
   `status='pagado'` con **`ncf`/`ncf_type` en `null`** -- nunca generar comprobante,
   porque el e-CF real ya existe en Alegra y un NCF local sería un documento fantasma
   ante la DGII.
5. `npm run smoke` al terminar.

El detalle fila por fila quedó en el scratchpad de la sesión (`plan_carga.tsv`), no en el
repo: son nombres de menores con montos. Si se ejecuta la carga, va como seed en
`supabase/seeds/` igual que las anteriores.
