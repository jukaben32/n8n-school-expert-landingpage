# Exámenes de inglés en Excellent (Amco) — período 2026-2027

Conservado el 2026-10-15 a pedido del colegio, para cualquier otro requerimiento.
Origen: Coordinación del Área de Inglés (María Angélica Vizcaíno Martínez,
mariaav15@do.amcoedu.org). Las listas de correos de los estudiantes están en
`docs/amco/` (los dos .docx tal como llegaron).

## Los dos correos originales (sin cambios)

### 1. «Exámenes de excellent» — martes 13/10/2026, 10:36

> 📣 COMUNICADO A LOS PADRES, MADRES Y TUTORES
>
> Reciban un cordial saludo.
>
> Les compartimos las instrucciones para acceder a la plataforma Excellence, donde nuestros estudiantes realizarán sus exámenes de inglés.
>
> 🔗 Enlace: https://app.eecertification.com/
>
> 📱 Importante: Deben descargar la aplicación en un teléfono o tableta compatible para realizar los exámenes.
>
> 🔐 Datos de acceso:
>
> * Usuario: Correo electrónico del estudiante.
> * Contraseña: 12345678 (del 1 al 8).
>
> ✅ Por favor, ingresen a la plataforma y verifiquen que puedan acceder correctamente.
>
> ⚠️ Atención: Les informaremos por esta misma vía cuándo podrán comenzar a realizar los exámenes. Favor esperar nuestra autorización antes de iniciarlos.
>
> Agradecemos su colaboración y apoyo.
>
> Coordinación del Área de Inglés
> Centro Gran Manantial de Sabiduría (CEGMAS)

### 2. «Lista de correos de excellent» — miércoles 14/10/2026, 10:18

Adjuntos: «De primero a sexto de secundaria…» y «De Tercero a sexto de Primaria…» (en `docs/amco/`).

> Saludos, aquí les comparto la lista de correos de excellent desde 3ero de primaria hasta 6to de secundaria.
>
> También les comparto este link que explica de manera detallada de cómo los estudiantes deben entrar a la plataforma:
>
> https://youtu.be/qNFdgJy3NH4?feature=shared
>
> Recuerden que les envié un correo ayer con la contraseña y el link de la plataforma.
>
> Gracias, feliz día.

## Comunicado unificado (el que recibe cada familia)

Lo arma `web/src/lib/amco/excellentEmail.ts`: mismo estilo y frases del
comunicado original, más (a) el correo de Amco de cada hijo, con su vigencia
(todo el período 2026-2027), (b) el video tutorial, (c) el aviso de que los
estudiantes deben tomar una evaluación del período y los padres darles el apoyo
que necesiten en casa, y (d) el sitio web del colegio
(https://www.educacionmanantial.com/colegio/cegmas), que tiene el enlace a Amco.
Se usa «Excellent» (como lo escribió la coordinación en el segundo correo; el
primero decía «Excellence»).

## Cómo se envía

- **Cuándo:** viernes 16/10/2026, 8:00 am hora RD (12:00 UTC), con pg_cron.
  Se programa en tres horarios (12:00, 12:10, 12:20 UTC) porque Resend limita la
  velocidad; no duplica nada: cada familia se reserva en `amco_access_dispatches`.
- **A quién:** un correo por familia, al tutor principal (si no tiene correo, al
  primero con correo registrado) — la misma regla de los comunicados urgentes.
  Familias sin ningún tutor con correo quedan como `sin_correo` en
  `amco_access_dispatches` para que Secretaría las atienda en persona.
- **Qué estudiantes:** solo los que se emparejaron con un estudiante inscrito del
  sistema. Una fila sin emparejar nunca se envía.
- **Lote 1:** 3ro de Primaria a 6to de Secundaria. **Lote 2 (pendiente):** 1ro y
  2do de Primaria e Inicial, si la supervisora confirma que participan: cargar
  con `batch = 2` en `amco_student_accounts` (y `send_after` de ese día) y
  disparar `/api/cron/amco-excellent?batch=2`.

## Puesta en marcha (en este orden)

1. Fusionar a `main` y esperar el despliegue (el código de la ruta tiene que
   estar en producción antes de las 8:00 am; no desplegar en horario de clases).
2. Aplicar `supabase/migrations/20261015000000_amco_student_accounts.sql` y
   `20261015010000_amco_excellent_cron.sql`.
3. Correr `supabase/seeds/20261015_amco_cuentas_excellent.sql` y **revisar el
   reporte**: filas `sin_emparejar` (con candidatos sugeridos) y estudiantes
   inscritos de esos cursos que no están en la lista de Amco.
4. Correr `supabase/seeds/20261015_faq_excellent_amco.sql` (asistente de IA) y `20261015_website_card_excellent.sql` (tarjeta «Excellent · para estudiantes» en el sitio web).
   El aviso al teléfono NO existe en los comunicados urgentes (solo correo; WhatsApp sigue sin configurar): las familias sin correo las atiende Secretaría.
5. Ensayo sin enviar nada:
   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://www.educacionmanantial.com/api/cron/amco-excellent?batch=1&dry=1"`
   — devuelve cuántas familias recibirían el correo y cuántas no tienen correo.
   (Antes de las 8:00 am UTC-4 devuelve 0 porque `send_after` aún no llegó.)
6. Confirmar que `alegra_cron_secret` en `private.app_settings` tiene el mismo
   valor que `CRON_SECRET` de Vercel (es el de la conciliación con Alegra).

## Datos de la lista a confirmar con la Coordinación de Inglés

- «Jair Esther Soriano Romero» (jairs2) aparece en 1ro y en 3ro de Secundaria con
  el mismo correo.
- «Yanela Alejandra Herrera Solano» aparece en 3ro (yanelah2) y en 6to Secundaria
  (luisah13): el segundo correo parece de otra persona.
- «Roosenvelt Xaviell Marte Jhonson» (6to Primaria) vino sin correo.
- Varios nombres traen faltas de ortografía (p. ej. «Gonzles», «Darlin Feliz»):
  esas filas quedan sin emparejar y se resuelven a mano (el seed explica cómo).
