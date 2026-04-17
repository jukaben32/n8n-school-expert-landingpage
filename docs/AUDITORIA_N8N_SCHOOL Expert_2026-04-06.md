# 🏫 Auditoría Completa: n8n-school-expert

**Fecha:** 2026-04-06
**Auditor:** Antigravity Agent
**Total de Workflows:** 13

---

## 📋 RESUMEN EJECUTIVO

El proyecto n8n-school-expert es un sistema robusto de automatización escolar con **13 workflows** que cubren comunicación, finanzas, asistencia, expedientes digitales y autorizaciones. La arquitectura base es sólida, pero hay **oportunidades significativas de mejora** en centralización, manejo de errores y mantenimiento.

---

## 🔍 ANÁLISIS POR WORKFLOW

### MÓDULO 1: Comunicación

| Workflow | Webhook | Trigger | Evolution API | Problemas |
|----------|---------|---------|---------------|-----------|
| **1.1 Bot Asistente Toki** | `toki-webhook` | Manual (WhatsApp) | ✅ Enviar Respuesta | Sin validación de sesión, AI puede responder cualquier cosa |
| **1.2 Notificación Certificada** | `confirmacion-lectura` | Google Sheets Poll | ✅ Enviar Circular | Webhook no está conectado en `connections`, lógica huérfana |

### MÓDULO 2: Finanzas

| Workflow | Webhook | Trigger | Evolution API | Problemas |
|----------|---------|---------|---------------|-----------|
| **2.1 Sistema Cobro Híbrido** | `stripe-webhook-success` | Google Sheets Poll | ✅ Ofrecer Métodos | Falta actualizar Sheet tras pago exitoso Stripe |
| **2.2 Validación Transferencias** | `comprobante-recepcion` | Manual (WhatsApp) | ✅ Notificar Contable | No valida si el comprobante ya fue procesado |
| **2.3 Gestión de Moras** | Ninguno | Schedule Diario | ✅ Notificar Recargo | Puede aplicar mora infinitamente sin tracking de notificaciones |

### MÓDULO 3: Asistencia

| Workflow | Webhook | Trigger | Evolution API | Problemas |
|----------|---------|---------|---------------|-----------|
| **3.1 Alerta Ausencia** | `recepcion-justificacion` | Manual + Schedule | ✅ Alerta Seguridad | Filtro `estado: "A"` puede no coincidir con Sheet real |
| **3.2 Alerta Retrasos** | Ninguno | Schedule Semanal | ✅ Notificar Infracción | "Regla de 3" es hardcoded, no configurable |

### MÓDULO 4: Expedientes

| Workflow | Webhook | Trigger | Evolution API | Problemas |
|----------|---------|---------|---------------|-----------|
| **4.1 Setup Expediente Drive** | Ninguno | Google Sheets Poll | ❌ Ninguna | No envía notificación a la familia |
| **4.2 Firma Digital** | `dropbox-sign-webhook` | Google Sheets Poll | ✅ Notificar Firma | Callback no verifica estado de firma |
| **4.3 Generador Certificados** | `solicitud-certificado` | Manual (WhatsApp) | ✅ Entregar PDF | Filtra por "certificado" en texto, puede fallar con sinónimos |

### MÓDULO 5: Comunicación + Autorizaciones

| Workflow | Webhook | Trigger | Evolution API | Problemas |
|----------|---------|---------|---------------|-----------|
| **5.1 Envío Menú y Agenda** | `buzon-notas-padres` | Schedule + Webhook | ✅ Enviar Menú | Sheet `menu_comedor` filtro `dia` puede fallar |
| **5.2 Gestión Autorizaciones** | `respuesta-autorizacion` | Webhook | ❌ Ninguna | No envía confirmación a la familia |

### MÓDULO 6: Portal

| Workflow | Webhook | Trigger | Evolution API | Problemas |
|----------|---------|---------|---------------|-----------|
| **6.1 Generador Link Padre** | `solicitud-portal-padre` | Manual (WhatsApp) | ✅ Entregar Link | Token de 1 hora es correcto, pero no hay mecanismo de renovac

---

## 🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. ❌ Sin Router Central — Gestión Caótica de Webhooks

**Problema:** Cada workflow define su propio webhook path:
- `toki-webhook`
- `stripe-webhook-success`
- `comprobante-recepcion`
- `recepcion-justificacion`
- `confirmacion-lectura`
- `respuesta-autorizacion`
- `solicitud-certificado`
- `buzon-notas-padres`
- `solicitud-portal-padre`
- `dropbox-sign-webhook`

**Impacto:** Con 10+ webhooks externos, mantener y monitorear es difícil.

### 2. ❌ Configuration Hardcoded y Escasamente Centralizada

**Problema:**
- `ID_DE_TU_SPREADSHEET` en todos los workflows
- `instanceName: "CENTRO_ESCOLAR"` hardcoded en todos
- `ID_STRIPE_CREDENTIALS`, `ID_CREDENTIALS_SIGN` no configurados
- `ID_CARPETA_EXPEDIENTES_2026` hardcoded

**Impacto:** Cambiar un parámetro requiere editar 13 archivos JSON.

### 3. ❌ Sin Manejo de Errores ni Reintentos

**Problema:** Ningún workflow tiene:
- Nodo de Error Catch
- Retry logic
- Alertas de fallo
- Dead letter queue

**Impacto:** Un fallo silencioso puede pasar desapercibido por días.

### 4. ❌ Webhooks No Conectados en Connections

**Problema:** En `1.2_notificacion_certificada.json`:
```json
"Recepción de Confirmación": {
  "main": [[ {"node": "Actualizar Auditoría", ...} ]]
}
```
El webhook está definido pero no hay conexión desde él en la sección `connections` principal.

### 5. ❌ Sin Validación de Estado Previo

**Problema:** `2.2_validacion_transferencias` no verifica si el comprobante ya fue aprobado/rechazado. Un mismo pago podría notificarse múltiples veces.

### 6. ❌ Duplicación de Lógica de Envío WhatsApp

**Problema:** Cada workflow tiene su propio nodo `Enviar Respuesta (WhatsApp)` copiado. Si cambia el formato de Instance ID, hay que editar todos.

### 7. ❌ Sin Variables de Entorno o Credenciales Centralizadas

**Problema:** Los credentials de Stripe y Dropbox Sign están referenciados pero no existen en el proyecto. No hay `.env` ni configuración compartida.

---

## 💡 SOLUCIÓN PROPUESTA: ROUTER CENTRALIZADO

### Concepto

Crear **un solo webhook** `central-responses` que reciba TODAS las respuestas de WhatsApp y las distribuya al workflow correcto según el `buttonId` o contenido del mensaje.

### Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                  EVOLUTION API                              │
│            (instance: CENTRO_ESCOLAR)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │ POST /webhook/central-responses
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              ROUTER WORKFLOW (Nuevo)                         │
│                                                             │
│  1. Parsear buttonId / message.conversation                 │
│  2. Extraer acción y referencia                             │
│  3. Route to workflow específico                            │
│     ├── justify_absence_* → 3.1_alerta_ausencia             │
│     ├── approve_payment_*  → 2.2_validacion_transferencias │
│     ├── reject_payment_*   → 2.2_validacion_transferencias │
│     ├── authorize_yes_*   → 5.2_autorizaciones              │
│     ├── authorize_no_*    → 5.2_autorizaciones             │
│     ├── certificado        → 4.3_generador_certificados     │
│     ├── portal             → 6.1_generador_link_padre       │
│     └── [id_notificacion]  → 1.2_notificacion_certificada   │
└─────────────────────────────────────────────────────────────┘
```

### Beneficios del Router

| Antes | Después |
|-------|----------|
| 10 webhooks públicos | 1 webhook público |
| Difícil de monitorear | logging centralizado |
| Cambios en Evolution API = editar todos | Cambio en un solo lugar |
| Riesgo de webhooks huérfanos | Todos pasan por el router |
| Sin validación central | Filtro anti-duplicados en router |

---

## 📊 PLAN DE IMPLEMENTACIÓN DEL ROUTER

### Paso 1: Crear Router Workflow

```json
{
  "name": "🔀 ROUTER: Central de Respuestas WhatsApp",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "central-responses"
      },
      "id": "webhook-central",
      "name": "Webhook Central",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "jsCode": "const buttonId = $input.first().json.data?.message?.content?.buttonResponse?.buttonId;\nconst conversation = $input.first().json.data?.message?.conversation?.toLowerCase() || '';\nconst remoteJid = $input.first().json.data?.key?.remoteJid;\n\nlet action = null;\nlet targetWorkflow = null;\nlet payload = $input.first().json;\n\n// Parse button responses\nif (buttonId) {\n  if (buttonId.startsWith('justify_absence_')) {\n    action = 'justify_absence';\n    targetWorkflow = '3.1';\n    payload.reference = buttonId.replace('justify_absence_', '');\n  }\n  else if (buttonId.startsWith('approve_payment_')) {\n    action = 'approve_payment';\n    targetWorkflow = '2.2';\n    payload.reference = buttonId.replace('approve_payment_', '');\n  }\n  else if (buttonId.startsWith('reject_payment_')) {\n    action = 'reject_payment';\n    targetWorkflow = '2.2';\n    payload.reference = buttonId.replace('reject_payment_', '');\n  }\n  else if (buttonId.startsWith('authorize_yes_')) {\n    action = 'authorize_yes';\n    targetWorkflow = '5.2';\n    payload.reference = buttonId.replace('authorize_yes_', '');\n  }\n  else if (buttonId.startsWith('authorize_no_')) {\n    action = 'authorize_no';\n    targetWorkflow = '5.2';\n    payload.reference = buttonId.replace('authorize_no_', '');\n  }\n  else if (/^\\d+$/.test(buttonId)) {\n    action = 'confirm_notification';\n    targetWorkflow = '1.2';\n    payload.reference = buttonId;\n  }\n}\n// Parse text commands\nelse if (conversation.includes('certificado')) {\n  action = 'request_certificate';\n  targetWorkflow = '4.3';\n}\nelse if (conversation.includes('portal')) {\n  action = 'request_portal';\n  targetWorkflow = '6.1';\n}\n\nreturn [{ json: { action, targetWorkflow, payload, buttonId, conversation, remoteJid } }];"
      },
      "id": "parse-action",
      "name": "Parsear Acción"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            { "value1": "={{$json.targetWorkflow}}", "operation": "exists" }
          ]
        }
      },
      "id": "if-valid-action",
      "name": "¿Acción Válida?"
    },
    {
      "parameters": {
        "resource": "message",
        "operation": "sendText",
        "instanceName": "CENTRO_ESCOLAR",
        "number": "={{$json.payload.data.key.remoteJid}}",
        "text": "Su solicitud está siendo procesada. Recibirá una confirmación en breve."
      },
      "id": "acknowledge",
      "name": "Confirmar Recepción"
    }
  ]
}
```

### Paso 2: Migrar Webhooks Existentes

Cada workflow existente que tiene webhook debe **desactivar su propio webhook** y en su lugar:
1. Guardar sus datos en Google Sheets como "cola de procesamiento"
2. El routerlee de la cola y ejecuta la lógica específica

### Paso 3: Centralizar Configuración

Crear `db/configuracion_centralizada.json`:

```json
{
  "evolution_api": {
    "instance_name": "CENTRO_ESCOLAR",
    "api_url": 'http://host.docker.internal:8080'
  },
  "google_sheets": {
    "spreadsheet_id": "ID_DE_TU_SPREADSHEET"
  },
  "drive": {
    "expedientes_folder_id": "ID_CARPETA_EXPEDIENTES_2026"
  },
  "stripe": {
    "credentials_name": "Stripe account"
  },
  "dropbox_sign": {
    "credentials_name": "Dropbox Sign account"
  },
  "notifications": {
    "accountant_phone": "34600000000"
  }
}
```

---

## 🔧 OTRAS MEJORAS RECOMENDADAS

### 1. Agregar Nodos de Error Handling a Cada Workflow

```json
{
  "parameters": {
    "errorWorkflow": "ERROR_HANDLER_WORKFLOW_ID"
  },
  "id": "error-trigger",
  "name": "Error Trigger",
  "type": "n8n-nodes-base.errorTrigger"
}
```

### 2. Dashboard de KPIs

Crear un workflow scheduled que lea stats de todos los sheets y genere un dashboard.

### 3. Desduplicación de Pagos

Antes de notificar al contable, verificar si `id_pago` ya fue procesado.

### 4. Logging Centralizado

Usar un nodo HTTP Request para enviar logs a un servicio central (PostHog, Datadog, o simplemente otra hoja de Google Sheets).

---

## 📁 ESTRUCTURA ACTUAL vs. PROPUESTA

### ACTUAL (Caótico)

```
workflows/
├── 1.1_bot_asistente_toki.json          → webhook: toki-webhook
├── 1.2_notificacion_certificada.json     → webhook: confirmacion-lectura
├── 2.1_sistema_cobro_hibrido.json        → webhook: stripe-webhook-success
├── 2.2_validacion_transferencias.json    → webhook: comprobante-recepcion
├── 2.3_gestion_de_moras.json             → (sin webhook)
├── 3.1_alerta_ausencia_seguimiento.json  → webhook: recepcion-justificacion
├── 3.2_alerta_retrasos_acumulados.json   → (sin webhook)
├── 4.1_setup_expediente_drive.json       → (sin webhook)
├── 4.2_firma_digital_automatizada.json   → webhook: dropbox-sign-webhook
├── 4.3_generador_certificados_pdf.json   → webhook: solicitud-certificado
├── 5.1_envio_menu_y_agenda.json          → webhook: buzon-notas-padres
├── 5.2_gestion_autorizaciones.json       → webhook: respuesta-autorizacion
└── 6.1_generador_link_padre_seguro.json  → webhook: solicitud-portal-padre
```

### PROPUESTA (Centralizado)

```
workflows/
├── 0_router_central_responses.json      ← UN SOLO WEBHOOK PÚBLICO
├── 1.1_bot_asistente_toki.json          (desactivar webhook propio)
├── 1.2_notificacion_certificada.json
├── 2.1_sistema_cobro_hibrido.json
├── 2.2_validacion_transferencias.json
├── 2.3_gestion_de_moras.json
├── 3.1_alerta_ausencia_seguimiento.json
├── 3.2_alerta_retrasos_acumulados.json
├── 4.1_setup_expediente_drive.json
├── 4.2_firma_digital_automatizada.json
├── 4.3_generador_certificados_pdf.json
├── 5.1_envio_menu_y_agenda.json
├── 5.2_gestion_autorizaciones.json
├── 6.1_generador_link_padre_seguro.json
└── _shared/
    ├── ERROR_HANDLER.json
    ├── CONFIGURACION_CENTRAL.json
    └── LOGGING_WORKFLOW.json
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

| Prioridad | Tarea | Estado |
|-----------|-------|--------|
| 🔴 Alta | Crear Router Workflow (`0_router_central_responses.json`) | Pendiente |
| 🔴 Alta | Crear `db/configuracion_centralizada.json` | Pendiente |
| 🟡 Media | Actualizar todos los workflows para usar config central | Pendiente |
| 🟡 Media | Agregar Error Handling a cada workflow | Pendiente |
| 🟡 Media | Fix `1.2_notificacion_certificada.json` connections | Pendiente |
| 🟢 Baja | Crear dashboard de KPIs | Pendiente |
| 🟢 Baja | Implementar logging centralizado | Pendiente |

---

## 🎯 CONCLUSIÓN

El sistema n8n-school-expert tiene una base sólida con 13 workflows bien diseñados para el dominio escolar. Sin embargo, la **falta de un router central** es el principal dolor de cabeza actual. Implementar la arquitectura de router propuesta resolverá:

1. **Gestión simplificada** — 1 webhook público vs 10+
2. **Mejor mantenibilidad** — cambios en Evolution API en un solo lugar
3. **Monitoreo central** — logging y tracking de todas las interacciones
4. **Escalabilidad** — agregar nuevos flujos sin crear nuevos webhooks públicos

**Recomendación:** Priorizar la creación del Router Central (Workflow 0) antes de cualquier otra mejora. Esto habilitará el resto de las optimizaciones de forma más limpia.
