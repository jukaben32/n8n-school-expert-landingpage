# Reglas de Proyecto: SchoolOS (SIS Modular)

Este documento dicta las reglas arquitectónicas para cualquier agente de IA que trabaje en este proyecto.

## Arquitectura General
- **Stack Técnico**: Next.js 15 (App Router), Tailwind CSS 4, shadcn/ui, Supabase (Postgres, Auth, Storage, Edge Functions).
- **Prohibición de n8n**: Toda lógica de automatización o integración de flujos debe escribirse en TypeScript puro usando Supabase Edge Functions. No se deben utilizar herramientas visuales como n8n.
- **Agentes LLM**: La integración de IA (ej. redactar mensajes) se debe hacer invocando el SDK de Anthropic (`@anthropic-ai/sdk`) o similares directamente dentro de las Edge Functions.

## Base de Datos y Seguridad
- **Row Level Security (RLS)**: Es obligatorio habilitar RLS en todas las tablas operacionales. 
- **Validación RLS**: Toda nueva política RLS debe requerir explícitamente un check de `school_id` para garantizar el aislamiento multi-tenant. La regla de oro es: toda policy con rol debe ir acompañada de una subquery a `users_profiles` verificando el `school_id`.
- **Soft Delete**: Usar `deleted_at` para borrado lógico en lugar de eliminar filas.

## Desarrollo Frontend
- **Colores Corporativos**: El tema principal usa `primary: #1a5f7a` y `accent: #4f9cf9`. Mantener siempre un diseño limpio, mobile-first y coherente con esta paleta.
- **Validación**: Usar `zod` para validación de datos end-to-end (formularios y APIs).

## Anatomía de Edge Functions
Toda Edge Function que reemplace un workflow debe organizarse en 5 bloques lógicos y comentados:
1. `// 1. Trigger`: Validación de webhooks o cron.
2. `// 2. Contexto`: Consultas a Postgres/Supabase para obtener los datos necesarios.
3. `// 3. Decisión`: Invocación a LLM u otra lógica para decidir qué hacer o redactar.
4. `// 4. Acción`: Llamadas a APIs externas (ej. WhatsApp Meta API) o actualizaciones a DB.
5. `// 5. Observabilidad`: Inserción en la tabla `audit_logs` del resultado y estado.
