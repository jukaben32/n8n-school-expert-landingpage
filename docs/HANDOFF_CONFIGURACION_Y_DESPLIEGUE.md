# Handoff de Configuracion y Despliegue

## 1. Hojas de Google Sheets requeridas

### Hoja `alumnos`
- `id_alumno`
- `nombre`
- `apellidos`
- `telefono_familiar`
- `alumno_nombre`
- `drive_folder_id`
- `portal_token`
- `portal_token_exp`

### Hoja `pagos`
- `id_pago`
- `estado`
- `monto`
- `concepto`
- `alumno_nombre`
- `telefono`
- `stripe_url`
- `ultimo_envio_cobro`
- `fecha_pago`
- `metodo_pago`
- `fecha_limite`
- `recargo_mora`
- `fecha_comprobante`
- `comprobante_observacion`
- `observacion_revision`

### Hoja `asistencias`
- `id_alumno`
- `estado`
- `telefono_familiar`
- `alumno_nombre`
- `nombre`
- `motivo`
- `fecha_justificacion`

### Hoja `autorizaciones`
- `id_autorizacion`
- `telefono_familiar`
- `evento_nombre`
- `evento_fecha`
- `evento_detalles`
- `alumno_nombre`
- `tutor_nombre`
- `drive_folder_id`
- `estado`
- `fecha_respuesta`

### Hoja `matriculas`
- `id_alumno`
- `alumno_nombre`
- `tutor_nombre`
- `tutor_email`
- `telefono_familiar`
- `drive_folder_id`

### Hoja `menu_comedor`
- `dia_semana`
- `plato_1`
- `plato_2`
- `postre`
- `alergenos`

### Hoja `comunicaciones`
- `id_notificacion`
- `telefono`
- `mensaje`
- `titulo`
- `intentos`
- `ultimo_intento`
- `fecha_lectura`
- `status`
- `nombre_padre`
- `fecha_escalado`

## 2. Variables de entorno

Completar estas variables segun `.env.example`:

```env
N8N_SCHOOL_SPREADSHEET_ID=
EVOLUTION_INSTANCE_NAME=CENTRO_ESCOLAR
N8N_BASE_WEBHOOK_URL=https://n8n.example.com/webhook
N8N_SCHOOL_CURRENCY=DOP
N8N_SCHOOL_BANK_NAME=
N8N_SCHOOL_BANK_ACCOUNT=
N8N_SCHOOL_BANK_ACCOUNT_TYPE=
N8N_SCHOOL_BANK_BENEFICIARY=
N8N_SCHOOL_ACCOUNTANT_JID=
N8N_SCHOOL_MENU_BROADCAST_JID=
N8N_SCHOOL_PORTAL_BASE_URL=https://portal.example.com
N8N_SCHOOL_CONTRACT_TEMPLATE_URL=
```

Variables adicionales recomendadas para los workflows:

```env
N8N_SCHOOL_AUTOMATIC_LATE_FEES=true
N8N_SCHOOL_LATE_FEE_GRACE_DAYS=5
N8N_SCHOOL_LATE_FEE_PERCENTAGE=5
```

## 3. Configuracion de Google Sheets

### Opcion recomendada: Service Account

1. Crear un proyecto en Google Cloud.
2. Activar:
- Google Sheets API
- Google Drive API
3. Crear una Service Account.
4. Descargar el JSON de credenciales.
5. Compartir el spreadsheet principal con el email de la Service Account con permisos de editor.
6. En n8n, crear una credencial de Google Sheets usando esa Service Account.
7. Crear tambien la credencial de Google Drive con la misma cuenta si usaras Drive.

### Spreadsheet principal

Debe contener todas las hojas listadas arriba dentro del mismo documento.

El valor de `N8N_SCHOOL_SPREADSHEET_ID` es el ID del documento:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## 4. Credenciales que debes crear en n8n

### Google Sheets
- Tipo: Google Sheets OAuth2 o Service Account
- Uso: lectura y escritura de `alumnos`, `pagos`, `asistencias`, `autorizaciones`, `matriculas`, `menu_comedor`, `comunicaciones`

### Google Drive
- Tipo: Google Drive OAuth2 o Service Account
- Uso: expedientes, contratos, autorizaciones

### Stripe
- Nombre esperado en workflows: `Stripe account`
- Uso: crear payment links

### Dropbox Sign
- Nombre esperado en workflows: `Dropbox Sign account`
- Uso: solicitud de firma

### Evolution API
- Debe existir el nodo/plugin instalado
- Configurar:
  - instancia
  - base URL
  - API key

## 5. Orden correcto de importacion en n8n

1. Cargar variables de entorno.
2. Reiniciar n8n para que lea las variables.
3. Crear credenciales:
- Google Sheets
- Google Drive
- Stripe
- Dropbox Sign
- Evolution API
4. Importar los 13 workflows.
5. Revisar manualmente que cada nodo tenga la credencial correcta asignada.
6. Activar primero:
- `0_router_central_responses.json`
- `2.1_sistema_cobro_hibrido.json`
- `2.2_validacion_transferencias.json`
- `3.1_alerta_ausencia_seguimiento.json`
- `5.2_gestion_autorizaciones_interactivas.json`
- `6.1_generador_link_padre_seguro.json`
7. Activar despues:
- `1.1_bot_asistente_toki.json`
- `1.2_notificacion_certificada.json`
- `2.3_gestion_de_moras.json`
- `3.2_alerta_retrasos_acumulados.json`
- `4.1_setup_expediente_drive.json`
- `4.2_firma_digital_automatizada.json`
- `4.3_generador_certificados_pdf.json`
- `5.1_envio_menu_y_agenda.json`

## 6. Pruebas minimas antes de produccion

### Router
Probar POST al webhook `central-responses`.

### Portal
Enviar mensaje que termine en flujo de portal y verificar:
- actualiza `portal_token`
- actualiza `portal_token_exp`
- envia el link

### Pagos
1. Crear fila en `pagos` con `estado=Pendiente`
2. Verificar que se cree `stripe_url`
3. Simular callback de pago o evento de router para:
- `request_bank_details_<id_pago>`
- `approve_payment_<id_pago>`
- `reject_payment_<id_pago>`

### Ausencias
1. Crear fila con `estado=A`
2. Verificar envio del aviso
3. Simular `justify_absence_<id_alumno>`
4. Confirmar cambio a `estado=J`

### Autorizaciones
1. Crear fila en `autorizaciones`
2. Verificar envio del boton
3. Simular `authorize_yes_<id_autorizacion>`
4. Confirmar `estado=Autorizado`

### Certificados
1. Verificar busqueda en `alumnos`
2. Generacion PDF
3. Envio del documento

## 7. Acceso para prueba definitiva desde VPS o local

Si luego quieres que yo lo pruebe de verdad, necesito una de estas opciones:

### Opcion A: acceso SSH al VPS
Necesitare:
- host
- usuario
- metodo de autenticacion
- ruta del proyecto
- forma de arranque

Ejemplos de arranque:
- `docker compose up -d`
- `docker compose ps`
- `systemctl status n8n`
- `pm2 status`

### Opcion B: tener el despliegue dentro del workspace
Traer a este workspace:
- `docker-compose.yml`
- `.env`
- workflows exportados
- configuracion relacionada

### Opcion C: staging clonado
Lo correcto antes de tocar produccion:
- clonar el entorno
- probar webhooks reales
- validar credenciales
- y luego pasar a produccion

## 8. Archivos clave del proyecto

- `docs/HANDOFF_CONFIGURACION_Y_DESPLIEGUE.md`
- `docs/GUIA_IMPLEMENTACION_PASO_A_PASO.md`
- `db/configuracion_centralizada.json`
- `.env.example`

## 9. Nota sobre Antigravity

Si Antigravity no te muestra bien el historial, usa este archivo local como fuente de verdad. Ya queda guardado dentro del proyecto.
