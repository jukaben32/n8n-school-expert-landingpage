-- =========================================================================
-- SCHOOLOS — Migración 016: RLS por rol específico (blindaje completo)
--
-- Hasta ahora, la restricción de "profesor no ve Familias", "recepción
-- no ve Tesorería", etc. vivía SOLO en la interfaz (src/lib/permissions.ts).
-- A nivel de base de datos, la mayoría de las tablas seguían agrupando
-- a todo el 'staff' junto -- cualquiera con acceso directo a la API
-- (saltándose la interfaz) podía leer o escribir fuera de lo que le
-- corresponde a su rol.
--
-- Esta migración alinea las políticas de RLS con la matriz real de
-- src/lib/permissions.ts: cada tabla separa quién puede LEER de quién
-- puede ESCRIBIR, con la lista de roles exacta que usa la interfaz.
--
-- De paso, limpia varias políticas de la migración 20260702210000 que
-- quedaron duplicadas bajo otro nombre (mismo efecto, texto distinto)
-- y que hubieran seguido dando acceso amplio por debajo aunque esta
-- migración creara reglas más estrictas -- las políticas permisivas se
-- combinan sumando (OR), no reemplazando.
-- =========================================================================

-- ── Limpieza de duplicados inofensivos (incluso antes de este ajuste,
--    ya eran redundantes con políticas del mismo alcance creadas después) ──
drop policy if exists "schools_read_same_school" on schools;
drop policy if exists "schools_admin_update_same_school" on schools;
drop policy if exists "staff_admin_all" on staff;
drop policy if exists "enrollments_staff_read" on enrollments;

-- ── Familias: teacher pierde el acceso por completo (no está en su
--    matriz de la interfaz); finance queda solo de lectura ───────────────
drop policy if exists "families_staff_all" on families;
drop policy if exists "families_read" on families;
create policy "families_read" on families
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance','reception')
    )
);
drop policy if exists "families_write" on families;
create policy "families_write" on families
for insert with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','reception')
    )
);
drop policy if exists "families_update" on families;
create policy "families_update" on families
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','reception')
    )
);
drop policy if exists "families_delete" on families;
create policy "families_delete" on families
for delete using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);

-- ── Tutores (guardians): mismo criterio que familias ─────────────────────
drop policy if exists "guardians_staff_all" on guardians;
drop policy if exists "guardians_read" on guardians;
create policy "guardians_read" on guardians
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance','reception')
    )
);
drop policy if exists "guardians_write" on guardians;
create policy "guardians_write" on guardians
for insert with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','reception')
    )
);
drop policy if exists "guardians_update" on guardians;
create policy "guardians_update" on guardians
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','reception')
    )
);
drop policy if exists "guardians_delete" on guardians;
create policy "guardians_delete" on guardians
for delete using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);

-- ── Vínculo estudiante-tutor: mismo criterio (sin teacher) ───────────────
drop policy if exists "student_guardians_staff_all" on student_guardians;
create policy "student_guardians_staff_all" on student_guardians
for all using (
    student_id in (
        select id from students where school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin','school_admin','director','reception')
        )
    )
);
drop policy if exists "student_guardians_read" on student_guardians;
create policy "student_guardians_read" on student_guardians
for select using (
    student_id in (
        select id from students where school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin','school_admin','director','finance','reception')
        )
    )
);

-- ── Tesorería (billing_concepts / invoices / payments): finance y
--    dirección únicamente -- reception ya no gestiona pagos en la
--    interfaz, así que tampoco debería poder verlos ni tocarlos aquí ──────
drop policy if exists "billing_concepts_staff" on billing_concepts;
create policy "billing_concepts_staff" on billing_concepts
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','finance')
    )
);

drop policy if exists "invoices_staff" on invoices;
create policy "invoices_staff" on invoices
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','finance')
    )
);

drop policy if exists "payments_staff" on payments;
create policy "payments_staff" on payments
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','finance')
    )
);

-- ── Comunicados: finance no publica avisos (no está en su matriz) ────────
drop policy if exists "messages_staff_all" on messages;
drop policy if exists "messages_read_staff" on messages;
create policy "messages_read_staff" on messages
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','finance','reception')
    )
);
drop policy if exists "messages_write_staff" on messages;
create policy "messages_write_staff" on messages
for insert with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','reception')
    )
);
drop policy if exists "messages_update_staff" on messages;
create policy "messages_update_staff" on messages
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','reception')
    )
);
drop policy if exists "messages_delete_staff" on messages;
create policy "messages_delete_staff" on messages
for delete using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);
