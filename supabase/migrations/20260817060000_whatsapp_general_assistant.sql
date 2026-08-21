-- =========================================================================
-- MentorIApp — Migración 029: modo "recepción general" para WhatsApp
--
-- Antes, un número de WhatsApp que no coincidía con ninguna familia
-- registrada recibía un mensaje fijo de rechazo y nada más. Ahora el
-- asistente le responde en un modo separado y más restringido: solo puede
-- usar información pública del colegio (faq_document, contacto) -- nunca
-- datos de una familia especifica, porque ese modo nunca recibe
-- family_id/guardian_id (ver answerGeneralQuestion() en
-- web/src/lib/ai/answerFamilyQuestion.ts).
--
-- Esta tabla es SOLO un contador para limitar abuso/costo por número no
-- identificado (15 mensajes/24h) -- a propósito no guarda el contenido de
-- la conversación (a diferencia de ai_conversations), porque no hay
-- ninguna familia dueña de esos datos que deba poder leerlos después.
-- =========================================================================

create table if not exists whatsapp_anonymous_messages (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    phone text not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_whatsapp_anonymous_messages_lookup on whatsapp_anonymous_messages(school_id, phone, created_at);

alter table whatsapp_anonymous_messages enable row level security;

-- Solo el servidor (service_role) escribe y cuenta esto -- ningún rol
-- autenticado necesita leerlo ni escribirlo directamente.
grant all privileges on whatsapp_anonymous_messages to service_role;
