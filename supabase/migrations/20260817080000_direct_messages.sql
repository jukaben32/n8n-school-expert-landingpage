-- =========================================================================
-- MentorIApp — Migración 031: mensajería directa de dos vías (familia ↔ colegio)
--
-- "Comunicados" es unidireccional (aviso -> confirmación de lectura). Esto
-- es aparte: una conversación privada por familia donde un tutor puede
-- escribirle al colegio y el staff (profesor/dirección/recepción) puede
-- responder. No existe un vínculo formal profesor-salón en este esquema
-- todavía (grade_levels/enrollments nunca se pobló -- ver migración 030),
-- así que por ahora la conversación es "familia <-> colegio" en general,
-- visible para cualquier staff con permiso de comunicados, no solo un
-- profesor específico asignado.
--
-- Todas las escrituras van por Server Actions con service_role (mismo
-- patrón que website_inquiries) -- por eso solo hay policies de SELECT,
-- ninguna de insert/update para roles autenticados.
-- =========================================================================

create table if not exists direct_conversations (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    family_id uuid not null references families(id) on delete cascade,
    guardian_last_read_at timestamptz,
    staff_last_read_at timestamptz,
    last_message_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (family_id)
);
create index if not exists idx_direct_conversations_school on direct_conversations(school_id, last_message_at desc);

create table if not exists direct_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references direct_conversations(id) on delete cascade,
    sender_type text not null check (sender_type in ('guardian', 'staff')),
    sender_profile_id uuid not null references users_profiles(id),
    body text not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_direct_messages_conversation on direct_messages(conversation_id, created_at);

alter table direct_conversations enable row level security;
alter table direct_messages enable row level security;

drop policy if exists "direct_conversations_guardian_read" on direct_conversations;
create policy "direct_conversations_guardian_read" on direct_conversations
for select using (
    family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

drop policy if exists "direct_conversations_staff_read" on direct_conversations;
create policy "direct_conversations_staff_read" on direct_conversations
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
);

drop policy if exists "direct_messages_guardian_read" on direct_messages;
create policy "direct_messages_guardian_read" on direct_messages
for select using (
    conversation_id in (
        select dc.id from direct_conversations dc
        join guardians g on g.family_id = dc.family_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

drop policy if exists "direct_messages_staff_read" on direct_messages;
create policy "direct_messages_staff_read" on direct_messages
for select using (
    conversation_id in (
        select dc.id from direct_conversations dc
        where dc.school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid()
              and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
        )
    )
);

grant select on direct_conversations, direct_messages to authenticated;
grant all privileges on direct_conversations, direct_messages to service_role;
