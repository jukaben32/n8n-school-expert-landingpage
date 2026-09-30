# Bitacora: Acceso sencillo y seguro al Portal Familiar

Fecha: 2026-09-30  
Estado: implementacion inicial preparada, sin reemplazar el acceso actual

## 0. Implementacion aplicada

Se agrego una primera version del acceso familiar por celular y codigo enviado por WhatsApp.

Lo importante para el colegio:

- El acceso anterior por correo, contrasena y codigo de estudiante sigue igual.
- La nueva entrada vive separada en `/acceso-familiar`.
- La pantalla de login anterior solo muestra un enlace extra para familias.
- El padre escribe el celular registrado en el colegio.
- El sistema busca un tutor activo con ese telefono.
- Si lo encuentra y tiene estudiantes vinculados, envia un codigo temporal por WhatsApp.
- El codigo vence en 24 horas durante la transicion.
- El codigo permite maximo 5 intentos.
- Se limitan los envios repetidos al mismo telefono.
- Si el tutor ya tenia cuenta, se reutiliza esa cuenta.
- Si el tutor no tenia cuenta, se crea una cuenta tecnica interna vinculada a su ficha de tutor.
- Al validar el codigo, el padre entra al mismo `/dashboard/portal-familiar` que ya existia.

Esto permite una transicion suave: los padres que ya entran por el sistema actual no pierden acceso, y los que no manejan bien correo/contrasena tienen una puerta mas simple.

Antes de usarlo en produccion hay que aplicar la migracion de base de datos nueva y confirmar que el WhatsApp del colegio este conectado. Esta version usa la infraestructura actual de Evolution API, por eso el riesgo de bloqueo del numero sigue existiendo hasta migrar a WhatsApp Business oficial o a un proveedor multicanal.

## 1. Problema observado

A los padres les cuesta acceder al portal/dashboard porque el flujo actual se apoya demasiado en correo electronico, enlaces de invitacion, recuperacion de contrasena y pasos que para muchas familias no son naturales.

En el contexto dominicano, muchas familias usan WhatsApp todos los dias, pero no necesariamente revisan su correo con frecuencia. Por eso, aunque el sistema funcione tecnicamente, puede sentirse dificil para el usuario final.

El problema no parece ser un solo bug. Es una mezcla de:

- Cultura baja de uso de email.
- Padres que no recuerdan contrasenas.
- Enlaces que se vencen o se abren tarde.
- Cuentas que necesitan estar bien vinculadas a la ficha del tutor.
- Secretaria teniendo que resolver casos sin una pantalla clara de diagnostico.
- Riesgo de usar WhatsApp no oficial para envios frecuentes.

## 2. Principio de diseno

El acceso familiar debe partir de la realidad del usuario, no de la comodidad tecnica del sistema.

Para las familias, el identificador mas natural suele ser:

1. Telefono celular.
2. WhatsApp.
3. Cedula, en algunos procesos administrativos.
4. Correo electronico, solo como respaldo.

Por eso, el portal familiar deberia moverse hacia este principio:

**Telefono primero. Email opcional. Contrasena casi nunca. WhatsApp como canal de comunicacion, pero no como unica base de seguridad.**

## 3. Flujo recomendado para padres

### Paso 1: Entrada separada para familias

Crear una entrada clara:

**Portal Familiar**

No mezclar en la misma pantalla:

- Padre/madre/tutor.
- Estudiante.
- Personal del colegio.
- Codigo de estudiante.
- Correo electronico.

La pantalla familiar deberia pedir algo simple:

**Numero de celular del padre, madre o tutor**

### Paso 2: Codigo de un solo uso

El padre escribe su celular y recibe un codigo de 6 digitos.

Ejemplo:

1. Padre escribe `8091234567`.
2. Sistema valida que ese telefono este asociado a un tutor activo.
3. Sistema envia un codigo temporal.
4. Padre escribe el codigo.
5. Entra al Portal Familiar.

Este modelo evita que el padre tenga que recordar contrasena o revisar correo.

### Paso 3: Sesion normal despues de validar

Despues de validar el codigo, el sistema crea la sesion normal en Supabase Auth y manda al padre a:

`/dashboard/portal-familiar`

Desde ahi ve solo lo que esta vinculado a su `guardian_id`.

## 4. Seguridad minima necesaria

Para que sea sencillo sin volverse inseguro:

- El codigo debe expirar. En una operacion completamente automatizada puede ser corto, por ejemplo 10 minutos. Durante la transicion actual se deja en 24 horas para dar margen al personal y a las familias.
- Limitar intentos por codigo, por ejemplo maximo 5 intentos.
- Limitar envios por telefono, por ejemplo pocos codigos por hora.
- No decir "este telefono no existe"; usar un mensaje neutral:
  "Si este numero tiene acceso, enviaremos un codigo."
- Registrar cada intento: telefono, fecha, IP, resultado y motivo.
- Para acciones sensibles, pedir una verificacion extra:
  - Firmar autorizaciones.
  - Cambiar datos personales.
  - Ver documentos sensibles.
  - Confirmar pagos importantes.

Esto mantiene una experiencia facil, pero con trazabilidad.

## 5. Rol de Secretaria

Secretaria no debe tener que adivinar por que un padre no entra.

Hace falta una pantalla de diagnostico por familia o tutor:

**Estado de acceso familiar**

Checks recomendados:

- Tutor registrado.
- Telefono registrado.
- Telefono normalizado.
- Cuenta de acceso creada.
- Perfil en `users_profiles` creado.
- `guardian_id` vinculado.
- Hijos vinculados en `student_guardians`.
- Ultimo codigo enviado.
- Ultimo inicio de sesion.
- Bloqueado por deuda: si/no.
- Canal disponible: SMS, WhatsApp oficial, email, clave temporal.

Esta pantalla seria una herramienta muy valiosa para soporte diario.

## 6. Email como respaldo, no como puerta principal

El correo electronico debe seguir existiendo, pero no debe ser obligatorio para que una familia use el portal.

Usos recomendados del email:

- Facturas.
- Comunicados formales.
- Recuperacion secundaria.
- Padres que si prefieren email.
- Personal administrativo o docente.

Pero para padres/tutores, el acceso principal deberia ser por telefono.

## 7. WhatsApp: punto debil actual

La app tiene disenado usar WhatsApp con Evolution API. Esto puede funcionar para pruebas, prototipos o conversaciones controladas, pero hay un riesgo importante:

**Los numeros pueden ser baneados si se usan para muchos mensajes, automatizaciones agresivas o envios masivos.**

Esto convierte WhatsApp en un punto debil del producto si se usa como columna principal sin una estrategia mas formal.

### Recomendacion

Separar dos cosas:

1. **WhatsApp como experiencia de usuario**
   - Avisos.
   - Recordatorios.
   - Mensajes de orientacion.
   - Enlaces hacia el portal.

2. **Autenticacion como seguridad**
   - Codigo OTP por telefono.
   - Proveedor oficial o canal mas estable.
   - Registro de intentos.
   - Limites anti-abuso.

WhatsApp puede decir:

"Hola, tu portal familiar esta listo. Entra aqui y usa tu numero de celular."

Pero el codigo de acceso no deberia depender exclusivamente de una instancia no oficial si el producto va a produccion con muchas familias.

## 8. WhatsApp Business y ruta mas segura

Para produccion, conviene estudiar WhatsApp Business Platform/API oficial.

La idea no es abandonar WhatsApp, sino usarlo con menos riesgo:

- Usar plantillas aprobadas para mensajes masivos o transaccionales.
- Evitar enviar mensajes no solicitados.
- Respetar opt-in de las familias.
- Medir calidad del numero.
- Mantener volumen gradual.
- Tener un canal alternativo si WhatsApp falla.

Evolution API podria quedarse para:

- Ambientes de prueba.
- Colegios pequenos.
- Flujos internos.
- Casos donde el riesgo este aceptado.

Pero para un SaaS escolar con muchos padres, el camino mas sano es considerar un proveedor oficial o una capa de mensajeria que permita WhatsApp oficial, SMS y email segun disponibilidad.

## 9. Flujo operacional recomendado

### Alta de familia

1. Secretaria registra familia.
2. Secretaria registra tutor principal.
3. Sistema exige al menos un telefono valido.
4. Email queda opcional.
5. Sistema muestra estado:
   "Portal familiar pendiente de activar."

### Activar portal

1. Secretaria pulsa "Activar portal familiar".
2. Sistema valida telefono, vinculos y duplicados.
3. Sistema crea o vincula la cuenta.
4. Sistema marca el acceso como activo.
5. Sistema envia mensaje de bienvenida por el mejor canal disponible.

### Primer acceso del padre

1. Padre entra a "Portal Familiar".
2. Escribe celular.
3. Recibe codigo.
4. Escribe codigo.
5. Entra.

### Soporte

Si no puede entrar, secretaria revisa la pantalla de diagnostico y ve exactamente el punto roto.

## 10. Que hacer con la clave temporal

La clave temporal actual es util, pero debe ser plan B.

Usarla solo cuando:

- El padre no recibe SMS/codigo.
- No tiene smartphone.
- El telefono esta mal registrado.
- Secretaria necesita resolver presencialmente.

No debe ser el flujo principal porque vuelve a introducir el problema de recordar/copiar contrasenas.

## 11. Que hacer con enlace magico por email

El enlace magico por email debe revisarse antes de promoverlo como opcion principal.

Si se mantiene:

- Debe tener callback claro.
- Debe crear sesion correctamente.
- Debe llevar al dashboard correcto.
- Debe mostrar mensajes simples.

Si no se corrige, es mejor ocultarlo para padres y dejarlo solo para personal o usuarios avanzados.

## 12. Fases propuestas

### Fase 1: Claridad y diagnostico

- Separar visualmente acceso de familias, estudiantes y personal.
- Crear pantalla de diagnostico de acceso por tutor/familia.
- Revisar o quitar temporalmente el enlace magico para padres.
- Documentar los estados de acceso.

### Fase 2: Telefono como identificador principal

- Normalizar telefonos.
- Detectar duplicados.
- Usar telefono como identificador de acceso familiar.
- Mantener email como campo opcional.

### Fase 3: OTP por telefono

- Implementar envio de codigo.
- Implementar verificacion.
- Agregar limites de seguridad.
- Registrar intentos.

### Fase 4: Mensajeria estable

- Evaluar WhatsApp Business Platform/API oficial.
- Definir si se usara SMS como respaldo.
- Mantener Evolution API solo donde el riesgo sea aceptable.
- Crear reglas de envio para evitar bloqueo de numeros.

### Fase 5: Campana de activacion

- Mensaje simple para familias:
  "Su portal familiar esta listo. Entre con su numero de celular."
- Secretaria activa familias por grupo.
- Medir cuantos entraron, cuantos fallaron y por que.

## 13. Decision recomendada

La direccion del producto deberia ser:

**Acceso familiar por telefono con codigo temporal, apoyado por WhatsApp para comunicacion y por email solo como respaldo.**

Esto es mas natural para las familias dominicanas, reduce friccion, reduce soporte por contrasenas y evita depender de que el padre revise un correo a tiempo.

El punto a cuidar es WhatsApp: si se usa una solucion no oficial para mucho volumen, el riesgo de bloqueo puede afectar al colegio. Por eso conviene planificar desde ahora una ruta hacia WhatsApp Business oficial, SMS de respaldo o un proveedor multicanal.

## 14. Referencias tecnicas a revisar antes de implementar

- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Phone Sign-in: https://supabase.com/docs/guides/auth/phone-login
- Supabase `signInWithOtp`: https://supabase.com/docs/reference/javascript/auth-signinwithotp
