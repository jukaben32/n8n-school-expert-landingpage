# Guia Maestra de Implementacion: Escuela Digital 2026

## Fase 1: Infraestructura

1. Instalar n8n `1.40+` y publicar la URL HTTPS del entorno.
2. Instalar Evolution API y registrar la instancia configurada en `EVOLUTION_INSTANCE_NAME`.
3. Habilitar Google Sheets API y Google Drive API.
4. Crear las credenciales de Stripe y Dropbox Sign dentro de n8n.

## Fase 2: Datos base

1. Importar el modelo de `db/database_design.md` en el spreadsheet principal.
2. Crear las hojas: `alumnos`, `asistencias`, `autorizaciones`, `comunicaciones`, `matriculas`, `menu_comedor`, `pagos`.
3. Completar las variables de entorno descritas en `db/configuracion_centralizada.json` o en `.env.example`.

## Fase 3: Importacion de workflows

1. Importar los 13 workflows de la carpeta `workflows/`.
2. Verificar que el router `0_router_central_responses.json` quede publicado.
3. Asignar credenciales reales a Google Sheets, Google Drive, Stripe, Dropbox Sign y Evolution API.

## Fase 4: Validacion funcional

1. Probar `central-responses` con botones de ausencia, autorizacion y pagos.
2. Simular pago Stripe y validar que `pagos.estado` cambie a `Pagado`.
3. Solicitar portal por WhatsApp y validar emision de token temporal.
4. Enviar un comprobante bancario y revisar el flujo de aprobacion del contable.

## Fase 5: Salida a produccion

1. Publicar los workflows.
2. Confirmar que `N8N_BASE_WEBHOOK_URL` apunta a la URL real de produccion.
3. Revisar tablas y columnas antes del primer envio masivo.

## Notas

- El proyecto ya no depende de leer configuraciones desde CSV binario en los workflows criticos.
- La configuracion operativa se centraliza via variables de entorno.
- El backup previo al refactor se guardo fuera del proyecto actual.
