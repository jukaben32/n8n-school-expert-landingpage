-- =========================================================================
-- MentorIApp — Migración 030: comunicados dirigidos a un grado/sección
--
-- `messages.audience_type`/`audience_ids` existían desde la migración 002
-- ('all', 'grade', 'section', 'family', 'student' -- ver el comentario
-- original de esa columna) pero el formulario de Comunicados siempre
-- mandaba 'all', sin ninguna forma de dirigir un aviso a un grupo
-- específico. Un profesor de un grado no podía avisar solo a sus propias
-- familias sin que le llegara también al resto del colegio.
--
-- Se resuelve por `students.grade_level` (texto libre ya existente desde
-- la migración de OCR) en vez del sistema formal grade_levels/enrollments
-- -- ese sistema nunca llegó a usarse en ningún flujo de alta de
-- estudiante (ni manual ni por OCR), así que hoy no tiene datos reales
-- para ningún estudiante. grade_level sí es el campo que efectivamente se
-- llena. Al momento de enviar, se resuelven los grados/secciones
-- elegidos a las family_id correspondientes y se guardan como
-- audience_type='family' -- audience_label queda como el texto legible
-- ("Kinder A, 1er Grado") para mostrarlo en la tarjeta del comunicado,
-- congelado en el momento del envío (no cambia si luego se reasigna a un
-- estudiante de grado).
-- =========================================================================

alter table messages add column if not exists audience_label text;

drop policy if exists "messages_guardian_read" on messages;
create policy "messages_guardian_read" on messages
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role = 'guardian'
    )
    and published_at is not null
    and deleted_at is null
    and (
        audience_type = 'all'
        or (
            audience_type = 'family'
            and exists (
                select 1 from guardians g
                join users_profiles up on up.guardian_id = g.id
                where up.auth_id = auth.uid() and g.family_id = any(messages.audience_ids)
            )
        )
    )
);
