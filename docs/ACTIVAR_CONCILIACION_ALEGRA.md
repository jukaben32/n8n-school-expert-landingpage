# Activar la conciliación automática con Alegra

**Para quien tiene acceso a Supabase y a Vercel.** Son 6 pasos en este orden.
No se salte el orden: el paso 1 no sirve de nada si el paso 0 no está hecho.

Al terminar, la plataforma revisa Alegra **sola, de lunes a viernes a las 7:00 pm**,
registra los cobros que emparejan sin ninguna duda, y deja los dudosos en una
bandeja para que alguien del colegio los resuelva. En Cuentas por Cobrar aparece
una línea que dice cuándo fue la última revisión.

Datos que va a necesitar a mano:
- Proyecto de Supabase: `fssjgpqisfnmnkavsyld`
- Proyecto de Vercel: `n8n-school-expert-landingpage` (Root Directory `web`)
- Correo y token de API de Alegra (Alegra → Configuración → API)

---

## Paso 0 — Desplegar el código

El trabajo está en la rama **`claude/alegra-payments-receivables-7ar06s`**.
Fusiónela a `main` (Vercel despliega solo al hacerlo).

Sin esto, la dirección `/api/cron/alegra` no existe todavía y todo lo demás
llamaría al vacío.

**Cómo saber que quedó**: en Vercel, el despliegue de producción en `READY`, y al
abrir `/dashboard/tesoreria/cuentas-por-cobrar` aparece una línea gris que dice
*"Conciliación con Alegra: todavía no ha corrido ninguna vez"*. Esa línea gris es
la señal correcta en este punto.

---

## Paso 1 — Aplicar las dos migraciones

Supabase → **SQL Editor**. Pegue y ejecute los dos archivos, **en este orden**:

1. `supabase/migrations/20260912000000_alegra_sync.sql`
2. `supabase/migrations/20260912010000_alegra_sync_cron.sql`

Las dos son idempotentes: si algo sale a medias, se pueden volver a pegar sin
hacer daño.

La segunda puede mostrar un aviso amarillo diciendo que **pg_cron no está
habilitado**. Eso es normal y no es un error: se resuelve en el paso 2.

**Comprobación** (pegue esto y debe devolver 4 filas):

```sql
select table_name from information_schema.tables
 where table_name in ('alegra_sync_runs','alegra_payment_matches')
union all
select 'invoices.external_reference' from information_schema.columns
 where table_name='invoices' and column_name='external_reference'
union all
select 'idx_students_code_por_colegio' from pg_indexes
 where indexname='idx_students_code_por_colegio';
```

---

## Paso 2 — Habilitar pg_cron y volver a aplicar la segunda migración

1. Supabase → **Database → Extensions** → busque **`pg_cron`** → actívela.
2. Vuelva al SQL Editor y **pegue otra vez** el archivo
   `20260912010000_alegra_sync_cron.sql` completo. Ahora sí registra el horario.

**Comprobación** (debe devolver una fila con `0 23 * * 1-5`):

```sql
select jobname, schedule, active from cron.job where jobname = 'alegra-sync-diario';
```

`0 23 * * 1-5` es **7:00 pm hora de República Dominicana**, de lunes a viernes.
(La base trabaja en UTC y el país está en UTC-4 todo el año.)

---

## Paso 3 — Las tres variables en Vercel

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

**Guarde ese valor**: hace falta idéntico en el paso 4. No lo escriba en ningún
archivo del repositorio.

⚠️ **Después de agregarlas hay que volver a desplegar.** Vercel no las aplica al
despliegue que ya existe. En **Deployments**, en el último de producción,
menú `···` → **Redeploy**.

---

## Paso 4 — El mismo secreto, dentro de la base

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

## Paso 5 — Probarlo a mano ANTES de confiar en el automático

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

## Paso 6 — Confirmar al día siguiente

El sábado o el martes siguiente, entre a `/dashboard/tesoreria/alegra` y mire la
tabla "Últimas corridas": debe haber una fila con origen **Automática** fechada
a las 7:0x pm del día hábil anterior.

Si no aparece ninguna automática, vea "Si algo no funciona" abajo.

---

## Si algo no funciona

**"Alegra sin configurar"** en la tabla de corridas → faltan `ALEGRA_EMAIL` /
`ALEGRA_TOKEN` en Vercel, o se agregaron pero **no se volvió a desplegar**
(paso 3).

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
  `alegra_cron_secret` de la base **no son iguales**. Repita los pasos 3 y 4.
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
La base ya está lista para recibirla (paso 1).
