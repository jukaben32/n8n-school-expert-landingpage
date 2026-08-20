-- =========================================================================
-- MentorIApp — Migración 035: Mensajes directos por categoría (Inglés/Deporte/Regular)
--
-- Hasta ahora direct_conversations era una sola fila por familia
-- (unique(family_id)), visible a cualquier staff con el módulo
-- mensajes_directos, sin distinguir de qué trata el mensaje. El pedido del
-- usuario: un padre debe poder elegir la categoría al escribir (Inglés /
-- Educación regular / Deporte), y esa conversación debe llegarle SOLO al
-- equipo correspondiente -- el docente de Inglés de su ciclo (o quien
-- tenga la fila "todo el colegio" para esa categoría, ver migración 034),
-- no a cualquier profesor/recepción.
--
-- Se modela como una conversación separada por (familia, categoría) -- así
-- lo confirmó el usuario explícitamente (AskUserQuestion, opción "una
-- conversación por categoría") en vez de un tag por mensaje dentro de un
-- solo hilo.
--
-- Comportamiento por categoría (para no restringir lo que ya funciona
-- hoy):
--   - super_admin/school_admin/director: las 3 categorías, sin cambios.
--   - 'regular': igual que siempre -- cualquier teacher/reception ve todas
--     las familias, sin filtrar por grado (ver comentario original de la
--     migración 031: una familia puede tener hijos en más de un grado).
--     No se introduce ninguna restricción nueva acá.
--   - 'ingles'/'deporte': solo 'teacher' con una fila en teacher_assignments
--     (categoría + grado, o "todo el colegio") que calce con algún hijo de
--     esa familia. 'reception' NO ve estas dos categorías -- su rol es la
--     vía administrativa/regular, no una materia específica.
--
-- IMPORTANTE: las Server Actions de Mensajes directos (portal-familiar y
-- dashboard/mensajes) usan el cliente admin (service_role) para casi todas
-- las lecturas/escrituras -- bajo service_role `auth.uid()` es null, así
-- que estas policies de RLS NO alcanzan a esos caminos (protegen la lista
-- de staff que sí usa el cliente de sesión, y protegen a guardians). La
-- autorización real de "esta persona puede ver la conversación de esta
-- familia en esta categoría" para los caminos con cliente admin se
-- replica en TypeScript (ver web/src/lib/messaging/categoryAccess.ts) --
-- documentado ahí también para que quede claro por qué existe dos veces.
-- =========================================================================

alter table direct_conversations add column if not exists category text not null default 'regular'
    check (category in ('regular', 'ingles', 'deporte'));

do $$
declare
    c record;
begin
    for c in
        select conname from pg_constraint
        where conrelid = 'direct_conversations'::regclass
          and contype = 'u'
    loop
        execute format('alter table direct_conversations drop constraint %I', c.conname);
    end loop;
end $$;

drop index if exists idx_direct_conversations_family_category;
create unique index idx_direct_conversations_family_category
    on direct_conversations (family_id, category);

drop policy if exists "direct_conversations_staff_read" on direct_conversations;
create policy "direct_conversations_staff_read" on direct_conversations
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
    or (
        category = 'regular'
        and school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('teacher', 'reception')
        )
    )
    or (
        category in ('ingles', 'deporte')
        and school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
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
                where auth_id = auth.uid() and role in ('teacher', 'reception')
            )
        )
        or (
            dc.category in ('ingles', 'deporte')
            and dc.school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
            and staff_can_see_family_category(dc.school_id, dc.family_id, dc.category)
        )
    )
);

-- Las policies de guardian (direct_conversations_guardian_read /
-- direct_messages_guardian_read, migración 031) no cambian -- un tutor ve
-- las 3 categorías de su propia familia sin restricción, la categoría es
-- solo para enrutar del lado del colegio.
