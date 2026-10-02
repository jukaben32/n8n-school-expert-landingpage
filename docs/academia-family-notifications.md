# Avisos de Academia para familias

Desde la separación de biblioteca y tareas, el aviso se genera al **asignar**
una actividad a un curso. Publicar un video en la biblioteca no avisa ni lo
convierte en tarea. Se registra cada estudiante inscrito destinatario y una
restricción por tutor, hijo y asignación evita duplicados. Las tareas retiradas
no permiten acceso. Véase [Biblioteca y tareas](academia-library-and-assignments.md).

## Portal y acceso

- La campana muestra el número de avisos y enlaza a la tarea de cada hijo.
- El Portal Familiar muestra los avisos nuevos y los actualiza cada minuto
  mientras la pestaña está visible.
- El tutor puede marcar un aviso como leído. Esto no completa la tarea.
- No puede modificar los datos del aviso ni crear, editar, borrar o responder
  tareas por su hijo. La vista familiar mantiene la autorización por vínculo,
  colegio y curso, incluso al cambiar manualmente los identificadores de URL.
- Los borradores, tareas retiradas y avisos sin un vínculo vigente se ocultan.
- Las cuentas de personal con doble rol conservan sus permisos laborales, pero
  la vista familiar y los avisos solo muestran sus propios hijos.

Cada hijo ve únicamente sus asignaciones vigentes como destinatario de su curso.
El tutor consulta sus instrucciones, respuestas y progreso en modo lectura.

## WhatsApp

La cola se genera junto con el aviso del portal. El webhook privado y un trabajo
pg_cron cada 15 minutos procesan avisos pendientes de hasta siete días de edad.
Antes de enviar se vuelven a comprobar colegio, tutor, vínculo, hijo y curso de
la tarea publicada. No se acepta un destinatario o texto del cuerpo del webhook.
Las escuelas desconectadas no bloquean la cola de las que sí están conectadas.

Se utiliza la integración Evolution existente, únicamente con una conexión
`evolution_api` habilitada y conectada. La Edge Function `notify-academia`
requiere `WEBHOOK_SECRET` (existente) y `EVOLUTION_API_URL` (pendiente de configurar
en Supabase). No hace falta la clave global de Evolution para enviar: usa el
token por instancia almacenado en `whatsapp_connections`. `SITE_URL` es opcional;
por defecto usa el dominio Vercel publicado.

El envío real de WhatsApp **no está operativo** mientras falte esa configuración
y la conexión del colegio. No se activaron conexiones ni se enviaron mensajes
a padres durante las pruebas. Falta validar una entrega real con un destinatario
de prueba después de configurar y conectar el servicio.

La reserva atómica impide que dos ejecuciones envíen el mismo aviso a la vez.
Un fallo de proveedor se deja en `failed`; una ejecución terminada después de
reservar puede quedar en `sending`. No se reintenta automáticamente una entrega
ambigua, para evitar duplicados. Esos casos requieren revisión de soporte. Los
avisos pendientes antiguos no se envían después de siete días. No se notifican
retroactivamente las tareas anteriores a la migración.

## Despliegue y comprobaciones

- Migración CLI `20261002014053_family_academia_notifications` aplicada y
  registrada en Supabase. No requiere que el usuario ejecute SQL.
- Edge Function desplegada: rechaza solicitudes sin secreto con HTTP 401;
  la solicitud privada respondió HTTP 200 indicando configuración pendiente.
- Job de reintento instalado y activo; cero lecciones/avisos de prueba restantes.
- 60 comprobaciones reales de roles: todas OK.
- Prueba SQL real con ROLLBACK: borradores, destinatarios, deduplicación,
  lectura propia, reconocimiento propio, modificación del aviso prohibida,
  edición/borrado/respuesta de tareas prohibidos, curso ajeno y despublicación.
- Siete pruebas del trabajador WhatsApp con proveedor simulado: autorización,
  conexión apagada, configuración ausente, destinatario verificado, datos
  ajenos/retirados, fallas transitorias, concurrencia y no repetir envíos.
- Ocho pruebas de alcance familiar y doce comprobaciones de render Next.
- TypeScript, lint de archivos de aplicación modificados y build completo pasan.
  El entorno local usó temporalmente workerThreads y typeRoots; se restauraron.
  El render de prueba redirige todas las llamadas Supabase a una fixture local,
  incluyendo las URL públicas que Next haya incorporado durante el build.

El asesor de seguridad señala que el predicado de autorización
`family_can_read_academia_notice` es SECURITY DEFINER ejecutable por usuarios
autenticados. Es deliberado: solo devuelve un booleano, exige `auth.uid()`,
verifica vínculo/colegio/curso, tiene `search_path` vacío y no permite ejecución
anónima ni escrituras. No se concedió acceso adicional al esquema privado.
Las pruebas anteriores verifican que no autoriza avisos de otras familias.
