# MentorIApp — Sistema de Información Escolar (SIS Modular)

> **"Una experiencia escolar más clara para dirección, secretaría y familias."**
> _Inspirado en la propuesta para Gran Manantial de Sabiduría. Potenciado con IA y Supabase._

---

## 🎯 Visión del Proyecto

MentorIApp es un **SIS (Sistema de Información Escolar) multi-tenant**, construido con la premisa de que el software escolar debe ser:

- **Claro para las familias:** portal móvil, avisos de asistencia y estado de cuenta en un clic.
- **Ágil para secretaría:** menos tareas manuales, automatización inteligente (sin n8n).
- **Trazable para dirección:** saber quién leyó qué, qué pagos están pendientes, qué alumnos tienen ausencias.

---

## 🏗️ Arquitectura General

```
n8n-school-expert-landingpage/        ← Carpeta raíz del proyecto
│
├── .agents/
│   └── AGENTS.md                     ← 🤖 REGLAS PARA AGENTES DE IA (leer primero)
│
├── legacy_landing/                   ← Landing page HTML original (referencia de diseño)
│
├── supabase/                         ← Backend: Base de datos + Edge Functions
│   ├── config.toml
│   ├── migrations/
│   │   └── 20260701000000_init.sql   ← 10 tablas core + RLS base
│   └── functions/                    ← Edge Functions (Deno/TypeScript) — pendiente
│
└── web/                              ← Frontend: Next.js 15 + Tailwind CSS
    ├── src/
    │   ├── app/                      ← App Router (Next.js 15)
    │   ├── components/               ← Componentes reutilizables — pendiente
    │   └── lib/
    │       └── supabase/             ← Clientes Supabase (server/client) — pendiente
    └── package.json
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) | Carpeta `/web` |
| **Estilos** | Tailwind CSS 4 | Paleta: `#1a5f7a` / `#4f9cf9` |
| **Base de Datos** | Supabase (Postgres) | Multi-tenant con RLS |
| **Auth** | Supabase Auth | Sessions SSR con `@supabase/ssr` |
| **Automatización** | Supabase Edge Functions (Deno) | **SIN n8n** |
| **IA** | Claude (Anthropic SDK) | Dentro de Edge Functions |
| **Validación** | Zod | End-to-end, formularios y APIs |

---

## 📋 Reglas para Agentes de IA

> **⚠️ IMPORTANTE:** Antes de escribir cualquier código, lee el archivo [`.agents/AGENTS.md`](.agents/AGENTS.md).

Resumen rápido:
1. **No uses n8n.** Toda automatización va en Edge Functions de Supabase.
2. **Toda tabla nueva** debe tener RLS habilitado con check de `school_id`.
3. **Toda Edge Function** debe seguir la estructura de 5 bloques: Trigger → Contexto → Decisión → Acción → Observabilidad.
4. **Usa Zod** para validar todos los datos de entrada.
5. **Colores corporativos:** `primary: #1a5f7a`, `accent: #4f9cf9`.

---

## 🗺️ Roadmap del MVP

### ✅ Fase 1: Fundación (Completada)
- [x] Reglas de IA (`.agents/AGENTS.md`)
- [x] Supabase inicializado
- [x] 10 tablas core + RLS base (`supabase/migrations/`)
- [x] Next.js 15 inicializado con paleta de colores corporativa (`/web`)

### 🔄 Fase 2: Autenticación + Portales Base
- [ ] Crear clientes Supabase SSR en `/web/src/lib/supabase/`
- [ ] Implementar middleware de autenticación en Next.js
- [ ] Portal de Padres (vista lista de hijos)
- [ ] Dashboard de Secretaría (vista gestión de estudiantes)

### ⏳ Fase 3: Comunicados + Asistencia Inteligente
- [ ] Tabla `messages` y `message_reads` (Lectura confirmada)
- [ ] Edge Function: `notify-attendance` (Claude redacta el aviso, envío WhatsApp/Email)
- [ ] UI de comunicados con confirmación de lectura

### ⏳ Fase 4: Pagos y Tesorería
- [ ] Módulo de estado de cuenta en portal familiar
- [ ] Integración con pasarela Azul/CardNet
- [ ] Generación de NCF (DGII, República Dominicana)

---

## 🚀 Cómo Ejecutar el Proyecto

### Prerequisitos
- Node.js >= 18
- Supabase CLI >= 2.0
- Docker (para Supabase local)

### 1. Base de Datos (Supabase local)
```bash
# Desde la raíz del proyecto
supabase start
supabase db reset   # Aplica las migraciones
```

### 2. Frontend (Next.js)
```bash
cd web
cp .env.example .env.local   # Completar con las keys de Supabase
npm run dev
```
Abrir `http://localhost:3000`

---

## 🎨 Paleta de Colores

| Variable | Color | Uso |
|---|---|---|
| `--primary` | `#1a5f7a` | Color principal, botones, enlaces |
| `--primary-light` | `#159895` | Hover states, acentos secundarios |
| `--primary-dark` | `#123f52` | Hover en botón primario |
| `--accent` | `#4f9cf9` | Modo oscuro, CTAs secundarios |
| `--accent-light` | `#83b8ff` | Hover en modo oscuro |

---

## 📁 Estructura de Tablas Core

| Tabla | Descripción |
|---|---|
| `schools` | Multi-tenant root. Cada colegio es un registro. |
| `families` | Grupos familiares dentro de un colegio. |
| `students` | Estudiantes vinculados a una familia. |
| `guardians` | Padres/tutores de los estudiantes. |
| `student_guardians` | Relación N:M estudiantes ↔ tutores. |
| `enrollments` | Historial de inscripciones por año escolar. |
| `staff` | Personal del colegio (docentes, admin, etc.). |
| `users_profiles` | Enlace entre Supabase Auth y los roles del sistema. |
| `roles` / `permissions` | Sistema de permisos granular por módulo. |
| `audit_logs` | Trazabilidad de todas las acciones del sistema. |

---

## 📞 Contexto del Proyecto

- **Cliente original:** Gran Manantial de Sabiduría (República Dominicana)
- **Propuesta original:** Landing page HTML en `/legacy_landing/`
- **Evolución:** SaaS multi-tenant para múltiples colegios
- **País/Moneda:** República Dominicana / DOP
- **Idioma del sistema:** Español
