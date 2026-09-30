# Guia para el personal: acceso al Portal Familiar por celular y codigo de WhatsApp

Fecha: 2026-09-30  
Uso: guia sencilla para secretaria, direccion y personal que ayuda a las familias.

## 1. Que cambio

El Portal Familiar ahora tiene una forma mas sencilla de entrar.

Antes, muchos padres tenian que usar correo electronico, contrasena o enlaces de invitacion. Eso puede ser dificil para familias que no revisan el correo con frecuencia.

Ahora existe una entrada nueva:

`https://n8n-school-expert-landingpage.vercel.app/acceso-familiar`

En esa pantalla, el padre, madre o tutor escribe su celular registrado en el colegio. El sistema le envia un codigo por WhatsApp. Luego escribe ese codigo y entra al Portal Familiar.

## 2. Que NO cambio

El acceso anterior no fue eliminado.

Esto significa:

- Los padres que ya entran con correo y contrasena pueden seguir entrando igual.
- El personal del colegio sigue usando su acceso normal.
- Los estudiantes siguen usando su acceso normal.
- Nadie pierde acceso por activar esta nueva opcion.
- Esta es una transicion suave, no un cambio brusco.

## 3. Objetivo de esta nueva funcion

El objetivo es facilitar la entrada de las familias al Portal Familiar.

La idea es que el padre no tenga que recordar una contrasena ni revisar un correo electronico.

El proceso queda asi:

1. Escribe su numero de celular.
2. Recibe un codigo por WhatsApp.
3. Escribe el codigo.
4. Entra al Portal Familiar.

## 4. Que necesita tener un tutor para poder entrar

Para que el acceso funcione, el tutor debe cumplir estas condiciones:

- Estar registrado en la ficha familiar.
- Tener un numero de celular registrado.
- Tener al menos un estudiante vinculado.
- Que el numero no este repetido en dos tutores distintos de forma incorrecta.
- Que el WhatsApp del colegio este conectado y funcionando.

Si una de esas condiciones falla, el padre no podra entrar hasta que secretaria revise la ficha.

## 5. Como entra un padre paso a paso

### Paso 1: abrir la pantalla

El padre abre esta direccion:

`https://n8n-school-expert-landingpage.vercel.app/acceso-familiar`

Tambien puede entrar desde la pantalla normal de inicio de sesion, usando el boton:

**Entrar con celular y codigo de WhatsApp**

### Paso 2: escribir el celular

El padre escribe el celular que tiene registrado en el colegio.

Ejemplo:

`809-000-0000`

Tambien puede escribirlo sin guiones:

`8090000000`

### Paso 3: recibir el codigo

El sistema envia un codigo de 6 digitos por WhatsApp.

Ese codigo se crea automaticamente. El personal del colegio no tiene que crearlo manualmente.

### Paso 4: escribir el codigo

El padre escribe el codigo recibido.

Si el codigo es correcto, entra al Portal Familiar.

### Paso 5: revisar que ve sus hijos

Al entrar, el padre debe ver los estudiantes que tiene vinculados.

Si no ve sus hijos, secretaria debe revisar el vinculo entre tutor y estudiante.

## 6. Duracion y seguridad del codigo

El codigo es temporal.

Reglas importantes:

- El codigo dura 24 horas.
- Solo sirve una vez.
- Permite hasta 5 intentos.
- Si vence, el padre debe pedir otro codigo.
- El codigo no debe compartirse con nadie.
- El personal nunca debe pedirle el codigo al padre.

La regla para el personal es simple:

**Si el padre recibe un codigo, ese codigo es privado del padre.**

## 7. Que debe hacer secretaria si un padre no puede entrar

Cuando un padre diga que no puede entrar, revisar en este orden.

### Revision 1: confirmar el numero

Preguntar:

> Cual es el numero de celular que esta usando para entrar?

Luego revisar si ese numero esta escrito igual en la ficha del tutor.

No importa si tiene guiones, espacios o parentesis. Lo importante es que los ultimos 10 digitos sean correctos.

Ejemplo:

- `809-123-4567`
- `(809) 123-4567`
- `1 809 123 4567`

Todos representan el mismo numero si los digitos coinciden.

### Revision 2: confirmar que el tutor existe

Verificar que la persona este registrada como padre, madre o tutor.

Si el numero pertenece a una persona que no esta registrada como tutor, el sistema no debe darle acceso.

### Revision 3: confirmar que tiene estudiante vinculado

El tutor debe estar vinculado a uno o mas estudiantes.

Si el tutor existe, pero no tiene estudiantes vinculados, puede validar el numero, pero no tendra una vista familiar correcta.

### Revision 4: revisar telefonos duplicados

Si el mismo celular aparece en dos tutores distintos, el sistema no adivina.

Por seguridad, en casos duplicados no se debe entregar acceso automaticamente.

Secretaria debe corregir la ficha o decidir cual tutor debe tener ese numero.

### Revision 5: confirmar WhatsApp del colegio

Si WhatsApp no esta conectado, el codigo no se puede enviar.

En ese caso, revisar el modulo de WhatsApp del colegio y confirmar que este:

- conectado
- habilitado
- con estado activo

## 8. Mensajes que puede usar el personal

### Mensaje corto para enviar a una familia

> Buen dia. Ya puede entrar al Portal Familiar usando su celular registrado en el colegio. Entre aqui: https://n8n-school-expert-landingpage.vercel.app/acceso-familiar Escriba su numero de celular, recibira un codigo por WhatsApp y con ese codigo podra entrar.

### Mensaje si el padre dice que no recibio codigo

> Vamos a revisar su ficha. Por favor confirme el numero de celular que esta usando para entrar. El codigo se envia al WhatsApp registrado en el colegio.

### Mensaje si el numero no coincide

> El numero que esta usando no coincide con el registrado en su ficha. Vamos a actualizar o confirmar sus datos para que pueda entrar correctamente.

### Mensaje si WhatsApp del colegio esta fallando

> En este momento el envio por WhatsApp no esta disponible. Estamos revisando la conexion. Su acceso anterior por correo o contrasena sigue funcionando si ya lo tenia activo.

## 9. Como explicar esto a los padres en lenguaje simple

Usar esta explicacion:

> Para entrar al Portal Familiar ya no necesita recordar una contrasena. Solo escriba su celular registrado en el colegio. Le enviaremos un codigo por WhatsApp. Escriba ese codigo y entrara al portal.

Evitar explicaciones tecnicas como:

- autenticacion
- enlace magico
- usuario interno
- codigo de un solo uso
- Supabase
- sistema de sesiones

Para el padre, solo importa esto:

**Celular registrado + codigo por WhatsApp = entrada al Portal Familiar.**

## 10. Preguntas frecuentes del personal

### El codigo lo crea secretaria?

No. El codigo lo crea el sistema automaticamente.

### Secretaria puede ver el codigo?

No deberia verlo ni pedirlo. El codigo es privado del padre.

### El padre puede seguir usando correo y contrasena?

Si. El acceso anterior sigue funcionando.

### Que pasa si el codigo vence?

El padre pide otro codigo desde la misma pantalla.

### Que pasa si el padre cambia de celular?

Secretaria debe actualizar el celular en la ficha del tutor.

### Que pasa si dos tutores tienen el mismo numero?

El sistema puede bloquear el acceso automatico por seguridad. Secretaria debe corregir o confirmar el dato.

### Esto envia mensajes masivos automaticamente?

No. La nueva entrada solo envia codigo cuando el padre lo solicita escribiendo su numero.

Ademas, durante la transicion se desactivo el cron que enviaba recordatorios automaticos cada hora a padres que nunca habian entrado.

### Cuanto tiempo tiene el padre para usar el codigo?

El padre tiene 24 horas para usarlo.

Aunque dure 24 horas, se debe explicar como un codigo de tiempo limitado. No es una clave permanente.

### Esto depende de WhatsApp?

Para recibir el codigo, si. Por eso el WhatsApp del colegio debe estar conectado.

### Si WhatsApp falla, el padre pierde su acceso?

No necesariamente. Si ya tenia acceso anterior por correo y contrasena, puede seguir usandolo.

## 11. Recomendacion para iniciar la transicion

No anunciarlo a todo el colegio de golpe.

Primero hacer una prueba controlada:

1. Elegir 3 a 5 familias.
2. Confirmar sus telefonos.
3. Confirmar que tienen estudiantes vinculados.
4. Pedirles que entren por la nueva pantalla.
5. Anotar los problemas encontrados.
6. Corregir fichas o telefonos.
7. Luego anunciarlo al resto.

## 12. Checklist para secretaria

Antes de decirle a una familia que use el nuevo acceso, confirmar:

- El tutor esta registrado.
- El celular esta registrado.
- El celular esta correcto.
- El tutor tiene estudiante vinculado.
- WhatsApp del colegio esta conectado.
- El padre sabe que recibira un codigo por WhatsApp.

## 13. Checklist cuando una familia reporta problema

Revisar:

- Que numero esta escribiendo.
- Si ese numero esta en la ficha del tutor.
- Si el numero esta repetido en otro tutor.
- Si el tutor tiene estudiantes vinculados.
- Si WhatsApp esta conectado.
- Si el padre esta escribiendo el codigo dentro de las 24 horas.
- Si el padre pidio demasiados codigos seguidos.

## 14. Situacion actual: WhatsApp automatico no activo

Si el WhatsApp automatico del colegio todavia no esta activo, no se debe anunciar el acceso de forma masiva.

Durante la transicion, la recomendacion es trabajar con pocas familias por dia:

1. Elegir pocas familias de prueba.
2. Confirmar que el celular esta correcto.
3. Confirmar que el tutor tiene estudiante vinculado.
4. Enviar instrucciones manualmente por WhatsApp Business.
5. Dar seguimiento para confirmar que lograron entrar.

Mensaje manual sugerido:

> Buen dia. Estamos probando el nuevo acceso al Portal Familiar. Entre aqui: https://n8n-school-expert-landingpage.vercel.app/acceso-familiar Escriba su celular registrado y siga las instrucciones. El codigo de acceso tiene tiempo limitado y vence en 24 horas.

Nota importante:

El sistema actual esta preparado para enviar el codigo automaticamente cuando WhatsApp este conectado. Si el colegio va a enviar codigos manualmente, debe usarse un flujo controlado por secretaria, nunca mostrar codigos en publico ni compartirlos fuera del tutor correspondiente.

## 15. Frase clave para el personal

La forma mas simple de explicarlo es:

> El padre entra con su celular registrado. El sistema le manda un codigo por WhatsApp. Con ese codigo entra al Portal Familiar.

## 16. Nota de seguridad

El personal del colegio nunca debe pedir al padre que le envie el codigo.

Si alguien llama diciendo "deme el codigo que le llego", no se debe compartir.

El codigo sirve para entrar al portal de esa familia. Debe manejarse como algo privado.

## 17. Estado actual del sistema

Estado al 2026-09-30:

- Nueva pantalla de acceso familiar creada.
- Acceso anterior conservado.
- Codigo automatico por WhatsApp implementado.
- Codigo con vencimiento de 24 horas durante la transicion.
- Cron de recordatorios automaticos por correo desactivado durante la transicion.
- Pendiente operativo: probar con pocas familias antes de anunciarlo masivamente.
