-- =========================================================================
-- SCHOOLOS — Migración 021: historial del asistente de IA ("un solo
-- cerebro, dos salidas")
--
-- Guarda cada turno (pregunta del guardian / respuesta del asistente) de
-- la conversación con el asistente de IA de Portal Familiar. La columna
-- `channel` existe desde ya para que la Fase 2 (WhatsApp/Twilio, sin
-- construir todavía -- ver AGENTS.md) reutilice esta misma tabla sin
-- migraciones nuevas: ambos canales llaman al mismo `answerFamilyQuestion`,
-- que siempre escribe aquí con el `channel` correspondiente.
--
-- Política de acceso (decidida explícitamente, no asumida):
-- - Cada guardian puede LEER únicamente las conversaciones de su propia
--   familia (mismo patrón que `invoices_guardian_read`).
-- - El personal del colegio (staff/dirección) NO tiene ninguna política
--   de lectura sobre esta tabla -- ni siquiera school_admin/director.
--   Son conversaciones privadas de la familia con el asistente, igual que
--   no leen los mensajes de WhatsApp de una familia con el colegio.
--   Si en el futuro se necesita soporte/auditoría, eso requiere una
--   decisión de producto explícita y una política nueva, no se abre por
--   defecto aquí.
-- - Todas las escrituras (inserts) las hace el server-side core con
--   `service_role` (nunca el cliente directamente), filtrando siempre por
--   `family_id`/`school_id` explícitos -- ver web/src/lib/ai/answerFamilyQuestion.ts.
--   Por eso no existe política de INSERT para `guardian`: el client-side
--   nunca escribe directo a esta tabla.
-- =========================================================================

create table if not exists ai_conversations (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    family_id uuid not null references families(id),
    guardian_id uuid not null references guardians(id),
    channel text not null default 'widget'
        check (channel in ('widget', 'whatsapp')),
    role text not null
        check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_family_time on ai_conversations(family_id, created_at);

alter table ai_conversations enable row level security;

drop policy if exists "ai_conversations_guardian_read" on ai_conversations;
create policy "ai_conversations_guardian_read" on ai_conversations
for select using (
    family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);
