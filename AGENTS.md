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
7. **(Sin resolver aún)** Al crear un estudiante nuevo, el flujo parece estar
   creando la familia pero fallando al crear el registro del estudiante en sí
   — quedaron 2 familias huérfanas sin estudiantes. Pendiente de diagnosticar
   con el error real de la consola del navegador.

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
7. **Sistema de comunicación** (el más grande, dejado para el final a
   propósito): arquitectura acordada es un solo "cerebro" de IA con acceso a
   los datos del colegio (vía Claude), con dos salidas: (a) widget interno
   para padres ya en el sistema — construible ya, sin dependencias externas;
   (b) WhatsApp Business para leads y avisos externos — requiere verificación
   de negocio con Meta (o vía Twilio/similar), depende de tener dominio
   propio. Voz (ElevenLabs) queda como extensión opcional posterior, y hay que
   decidir primero si lo que se quiere es generación de audio o llamadas
   telefónicas de verdad (son productos distintos).
8. **Descuento automático a partir del Nº hijo** — hoy la facturación es
   manual (el monto se escribe a mano en Tesorería), no hay ninguna regla
   automática de descuento por cantidad de hermanos. Pendiente de construir
   si se decide priorizar.
9. Bug sin resolver de alta de estudiante (ver punto 7 de la sección de bugs).
