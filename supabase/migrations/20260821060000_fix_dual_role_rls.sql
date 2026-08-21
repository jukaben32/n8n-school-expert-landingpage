-- =========================================================================
-- MentorIApp — Corrige el bug sistémico de doble rol en RLS
--
-- Al construir "Vista de Familia" (doble rol staff+tutor) se corrigió
-- resolveGuardianIdentity() para autorizar por `guardian_id` en vez de
-- `role = 'guardian'` estricto -- pero esa misma restricción estricta
-- existía en 24 políticas RLS de 21 tablas, desde la migración inicial
-- (init.sql) hasta hoy. Un perfil de personal (role='teacher', etc.) que
-- también tiene guardian_id vinculado NUNCA pasaba estas políticas,
-- aunque la aplicación ya lo dejara entrar a Portal Familiar -- las
-- consultas simplemente devolvían vacío en silencio.
--
-- La corrección es la misma en las 24: el JOIN contra guardians/
-- users_profiles.guardian_id YA prueba el vínculo real con ese tutor
-- específico -- el filtro `and role = 'guardian'` era una restricción
-- extra innecesaria (y, para doble rol, incorrecta). Se quita en todas.
-- Donde no hay JOIN que lo prueme (ej. guardians_read_own,
-- billing_concepts_guardian_read), se reemplaza por
-- `guardian_id is not null` explícito.
-- =========================================================================

alter policy "ai_conversations_guardian_read" on ai_conversations
using (
    family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "attendance_guardian_read" on attendance
using (
    student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "authorization_requests_guardian_read" on authorization_requests
using (
    grade_level is null
    or grade_level in (
        select s.grade_level from students s
        join student_guardians sg on sg.student_id = s.id
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "authorization_responses_guardian_own" on authorization_responses
using (
    guardian_id in (select guardian_id from users_profiles where auth_id = auth.uid())
    and student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
)
with check (
    guardian_id in (select guardian_id from users_profiles where auth_id = auth.uid())
    and student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "azul_transactions_guardian_read" on azul_transactions
using (
    invoice_id in (
        select i.id from invoices i
        join families f on f.id = i.family_id
        join guardians g on g.family_id = f.id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "billing_concepts_guardian_read" on billing_concepts
using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and guardian_id is not null)
    and is_active = true
    and deleted_at is null
);

alter policy "calendar_events_guardian_read" on calendar_events
using (
    deleted_at is null
    and (
        grade_level is null
        or grade_level in (
            select s.grade_level from students s
            join student_guardians sg on sg.student_id = s.id
            join guardians g on g.id = sg.guardian_id
            join users_profiles up on up.guardian_id = g.id
            where up.auth_id = auth.uid()
        )
    )
);

alter policy "class_schedules_guardian_read" on class_schedules
using (
    grade_level in (
        select s.grade_level from students s
        join student_guardians sg on sg.student_id = s.id
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "class_updates_guardian_read" on class_updates
using (
    deleted_at is null
    and (
        student_id in (
            select sg.student_id from student_guardians sg
            join guardians g on g.id = sg.guardian_id
            join users_profiles up on up.guardian_id = g.id
            where up.auth_id = auth.uid()
        )
        or (
            grade_level is not null
            and grade_level in (
                select s.grade_level from students s
                join student_guardians sg on sg.student_id = s.id
                join guardians g on g.id = sg.guardian_id
                join users_profiles up on up.guardian_id = g.id
                where up.auth_id = auth.uid()
            )
        )
    )
);

alter policy "direct_conversations_guardian_read" on direct_conversations
using (
    family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "direct_messages_guardian_read" on direct_messages
using (
    conversation_id in (
        select dc.id from direct_conversations dc
        join guardians g on g.family_id = dc.family_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "enrollments_guardian_read" on enrollments
using (
    student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "families_guardian_read_own" on families
using (
    id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "families_guardian_read" on families
using (
    id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "grades_guardian_read" on grades
using (
    student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "guardians_read_own" on guardians
using (
    id in (select guardian_id from users_profiles where auth_id = auth.uid() and guardian_id is not null)
);

alter policy "invoices_guardian_read" on invoices
using (
    family_id in (
        select f.id from families f
        join guardians g on g.family_id = f.id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
    and deleted_at is null
);

alter policy "messages_guardian_read" on messages
using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and guardian_id is not null)
    and published_at is not null
    and deleted_at is null
    and (
        audience_type = 'all'
        or (
            audience_type = 'family'
            and exists (
                select 1 from guardians g
                join users_profiles up on up.guardian_id = g.id
                where up.auth_id = auth.uid() and g.family_id = any (messages.audience_ids)
            )
        )
    )
);

alter policy "payment_receipts_guardian_read" on payment_receipts
using (
    family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "payments_guardian_read" on payments
using (
    invoice_id in (
        select i.id from invoices i
        join families f on f.id = i.family_id
        join guardians g on g.family_id = f.id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

alter policy "student_guardians_guardian_read" on student_guardians
using (
    guardian_id in (select guardian_id from users_profiles where auth_id = auth.uid() and guardian_id is not null)
);

alter policy "student_guardians_guardian_read_own" on student_guardians
using (
    guardian_id in (select guardian_id from users_profiles where auth_id = auth.uid() and guardian_id is not null)
);

alter policy "students_read" on students
using (
    school_id in (
        select users_profiles.school_id from users_profiles
        where users_profiles.auth_id = auth.uid()
          and users_profiles.role = any (array['super_admin', 'school_admin', 'director', 'finance', 'reception'])
    )
    or id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
    or (
        grade_level is not null
        and school_id in (select users_profiles.school_id from users_profiles where users_profiles.auth_id = auth.uid() and users_profiles.role = 'teacher')
        -- 3 argumentos explicitos: existe una sobrecarga mas nueva
        -- teacher_is_assigned_to_grade(uuid, text, text default 'regular')
        -- que hace ambigua la llamada de 2 argumentos que este policy
        -- usaba desde antes de que esa sobrecarga existiera.
        and teacher_is_assigned_to_grade(school_id, grade_level, 'regular')
    )
);
