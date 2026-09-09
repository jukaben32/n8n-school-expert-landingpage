# Activar la conciliación automática con Alegra

**Estado al 2026-09-09: falta UNA sola cosa** — las credenciales de API de Alegra.
Todo lo demás está aplicado, desplegado y probado de punta a punta.

---

## ⬜ Lo único que falta

En **Alegra → Configuración → API** están el correo de la cuenta y el token.
Cargarlos en Vercel (proyecto `n8n-school-expert-landingpage` → Settings →
Environment Variables → **Production**):

- `ALEGRA_EMAIL`
- `ALEGRA_TOKEN`

Y después **Redeploy** — Vercel no aplica variables nuevas al despliegue que ya
existe.

Con eso queda encendido. Para confirmarlo: Cuentas por Cobrar → «Ver
conciliación» → **«Conciliar ahora»**.

---

## ✅ Ya hecho y verificado en producción (2026-09-09)

- **Código desplegado**: PR #22 fusionado a `main`, despliegue `READY`.
- **`npm run smoke`: 37 de 37 contra producción** — las migraciones no rompieron
  ningún rol (teacher, guardian, reception, director, school_admin, finance).
- Las dos migraciones aplicadas: `alegra_sync_runs`, `alegra_payment_matches`,
  `invoices.external_reference`, los dos índices, RLS y sus dos políticas.
- **El `unique` GLOBAL de `students.student_code` eliminado** y reemplazado por
  `unique (school_id, student_code)` — confirmado con `pg_constraint`.
- `pg_cron` 1.6.4 habilitada, horario `0 23 * * 1-5` activo (7:00 pm hora RD).
- **Backfill**: los 28 cobros de Alegra ya cargados quedaron con su e-CF en
  `external_reference`, así que el guardaduplicados cubre también lo que ya había.
- `CRON_SECRET` cargado en Vercel y el mismo valor en `private.app_settings` —
  comprobado que coinciden (64 caracteres, sin imprimir el valor).
- `app_site_url` confirmada en `https://www.educacionmanantial.com`.
- **Probado de punta a punta**, tres llamadas reales contra producción:
  sin secreto → `401`; con secreto equivocado → `401`; con el correcto → `200`
  y la corrida registrada. Y disparando `private.disparar_alegra_sync()` desde
  la propia base (el camino real de las 7 pm) la app contestó `200`.
  Las dos corridas quedaron como `sin_credenciales`, que es exactamente lo que
  debe decir mientras falten las variables de Alegra.

Página con este mismo estado, para compartir:
<https://claude.ai/code/artifact/cc2a01b5-3764-4776-9a17-8be54086482c>

---

## Paso 2 — Las tres variables en Vercel

Vercel → proyecto `n8n-school-expert-landingpage` → **Settings → Environment
Variables** → entorno **Production**:

| Variable | Valor |
|---|---|
| `ALEGRA_EMAIL` | el correo de la cuenta de Alegra del colegio |
| `ALEGRA_TOKEN` | el token de API de Alegra (Alegra → Configuración → API) |
| `CRON_SECRET` | una cadena larga al azar — ver abajo |

Para generar el `CRON_SECRET`, en una terminal:

```
openssl rand -hex 32
```

**Guarde ese valor**: hace falta idéntico en el paso 3. No lo escriba en ningún
archivo del repositorio.

⚠️ **Después de agregarlas hay que volver a desplegar.** Vercel no las aplica al
despliegue que ya existe. En **Deployments**, en el último de producción,
menú `···` → **Redeploy**.

---

## Paso 3 — El mismo secreto, dentro de la base

Supabase → SQL Editor. Reemplace `PEGUE-AQUI-EL-MISMO-VALOR` por el mismo
`CRON_SECRET` del paso 3:

```sql
insert into private.app_settings (key, value)
values ('alegra_cron_secret', 'PEGUE-AQUI-EL-MISMO-VALOR')
on conflict (key) do update set value = excluded.value;
```

**Comprobación** — confirme también que la dirección de la app es la correcta
(debe decir `https://www.educacionmanantial.com`):

```sql
select key, case when key like '%secret%' then '(cargado)' else value end
  from private.app_settings
 where key in ('app_site_url','alegra_cron_secret');
```

Si `app_site_url` no coincide con el dominio real de producción, corríjalo:

```sql
update private.app_settings set value = 'https://www.educacionmanantial.com'
 where key = 'app_site_url';
```

---

## Paso 4 — Probarlo a mano ANTES de confiar en el automático

Entre a la plataforma como Directora, Administrador o Secretaría y vaya a:

**Cuentas por Cobrar → "Ver conciliación"** (o directo a
`/dashboard/tesoreria/alegra`)

Toque **"Conciliar ahora"**. En unos segundos debe responder algo como:

> *37 facturas revisadas · 4 cobros registrados · 3 para revisar · 30 ya estaban.*

Eso es todo: ya está funcionando. Debajo aparece la tabla "Últimas corridas" con
el registro, y en Cuentas por Cobrar la línea verde de *"última actualización"*.

**Los cobros que quedan "para revisar"** son los que necesitan criterio humano
(el nombre en Alegra no calza exacto, un comprobante a nombre del tutor que cubre
a dos hermanos, un estudiante que todavía no está dado de alta). Cada uno muestra
por qué, sugiere el estudiante más parecido, y se resuelve eligiendo el estudiante
y tocando **Registrar**. Nada de eso entra solo, a propósito.

---

## Al día siguiente — confirmar

El sábado o el martes siguiente, entre a `/dashboard/tesoreria/alegra` y mire la
tabla "Últimas corridas": debe haber una fila con origen **Automática** fechada
a las 7:0x pm del día hábil anterior.

Si no aparece ninguna automática, vea "Si algo no funciona" abajo.

---

## Si algo no funciona

**"Alegra sin configurar"** en la tabla de corridas → faltan `ALEGRA_EMAIL` /
`ALEGRA_TOKEN` en Vercel, o se agregaron pero **no se volvió a desplegar**
(paso 2).

**"Conciliar ahora" da un error de permiso** → el usuario no tiene acceso al
módulo de Tesorería. Debe entrar como Directora, Administrador de colegio,
Finanzas o Secretaría.

**Corren las manuales pero nunca la automática** → revise, en este orden:

```sql
-- 1. ¿Está programado?
select jobname, schedule, active from cron.job where jobname = 'alegra-sync-diario';

-- 2. ¿Intentó correr y con qué resultado?
select runid, status, return_message, start_time
  from cron.job_run_details
 where jobname = 'alegra-sync-diario'
 order by start_time desc limit 5;

-- 3. ¿Qué contestó la app cuando la llamó?
select id, status_code, left(coalesce(content,''), 300), created
  from net._http_response order by created desc limit 5;
```

- Si el paso 3 devuelve **401** → el `CRON_SECRET` de Vercel y el
  `alegra_cron_secret` de la base **no son iguales**. Repita los pasos 2 y 3.
- Si devuelve **HTML de Vercel en vez de JSON** → el proyecto tiene *Deployment
  Protection* activa en producción; hay que desactivarla para producción, o la
  llamada nunca llega a la aplicación.
- Si el paso 2 dice que corrió bien pero el paso 3 no muestra nada → falta
  `alegra_cron_secret` en la base (la función avisa y no llama a nadie a
  propósito, para no mandar llamadas sin autorización todos los días).

---

## Dos cosas que conviene saber

**Nunca genera comprobantes fiscales.** Los cobros que registra van con
`ncf`/`ncf_type` en nulo a propósito: el e-CF real ya lo emitió Alegra y emitir
otro aquí sería un documento fantasma ante la DGII.

**Nunca aplica mora.** Cierra cada cuota por lo que de verdad se cobró. Si el
colegio no cobró el recargo, aquí tampoco aparece.

---

## Recomendado después (no hace falta para encender esto)

Pasar la **matrícula** de cada estudiante de Alegra (`24-0033`, etc.) a la
plataforma. Mientras la columna esté vacía, el emparejamiento depende del nombre,
que es lo frágil: una tilde o una letra de diferencia manda el cobro a la bandeja
en vez de registrarlo solo. Con la matrícula cargada, casi todo entra automático.
La base ya está lista para recibirla.
