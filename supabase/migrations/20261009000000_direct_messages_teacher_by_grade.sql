-- =========================================================================
-- MentorIApp — Mensajes directos: la maestra solo ve las familias de su aula
--
-- Reporte real del colegio (2026-10-09): todas las maestras veían en
-- Mensajes las conversaciones de TODAS las familias. La policy de la
-- migración 20260823020000 abría la categoría 'regular' a cualquier
-- 'teacher' del colegio; solo 'ingles'/'deporte' filtraban por aula.
--
-- Ahora la maestra ve una conversación (de cualquier categoría) solo si la
-- familia tiene un hijo en un curso que ella tiene asignado en
-- teacher_assignments para esa categoría, o si tiene la fila "todo el
-- colegio" (grade_level null). Es la misma función
-- staff_can_see_family_category() que ya usaban Inglés/Deporte.
--
-- Sin cambios: dirección/administración ven todo; recepción (secretaría)
-- sigue viendo toda la categoría 'regular'; las policies de los tutores
-- no se tocan. Se puede correr más de una vez sin problema.
-- =========================================================================

drop policy if exists "direct_conversations_staff_read" on direct_conversations;
create policy "direct_conversations_staff_read" on direct_conversations
for select using (
    -- Dirección y administración: todas las conversaciones del colegio.
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
    -- Recepción (secretaría): toda la categoría Regular, como antes.
    or (
        category = 'regular'
        and school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role = 'reception'
        )
    )
    -- Maestra: solo familias con un hijo en un curso asignado a ella.
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and staff_can_see_family_category(school_id, family_id, category)
    )
);

drop policy if exists "direct_messages_staff_read" on direct_messages;
create policy "direct_messages_staff_read" on direct_messages
for select using (
    conversation_id in (
        select dc.id from direct_conversations dc
        where dc.school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
        )
        or (
            dc.category = 'regular'
            and dc.school_id in (
                select school_id from users_profiles
                where auth_id = auth.uid() and role = 'reception'
            )
        )
        or (
            dc.school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
            and staff_can_see_family_category(dc.school_id, dc.family_id, dc.category)
        )
    )
);
