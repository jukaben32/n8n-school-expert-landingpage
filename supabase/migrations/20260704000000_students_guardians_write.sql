-- =========================================================================
-- SCHOOLOS — Migración 006: Permisos de escritura para students y guardians
--
-- Hallazgos:
-- 1) `students` solo tenía policy de SELECT ("students_read"). Sin policy
--    de INSERT/UPDATE/DELETE, el staff no puede crear ni editar estudiantes
--    vía la API (RLS deniega por defecto los comandos sin policy).
-- 2) `guardians` tiene RLS habilitado desde la migración 001 pero NUNCA
--    tuvo ninguna policy creada -> la tabla es 100% inaccesible por API
--    (ni lectura ni escritura), lo que rompe cualquier join a guardians
--    (ej. Tesorería mostrando "Familia N/A" siempre).
-- =========================================================================

-- ── students: alta/edición para staff del mismo colegio ─────────────────
create policy "students_staff_write" on students
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','finance','reception')
    )
);

-- ── guardians: lectura y gestión para staff del colegio ──────────────────
create policy "guardians_staff_all" on guardians
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','finance','reception')
    )
);

-- ── guardians: cada tutor puede leer y actualizar su propio registro ─────
create policy "guardians_own_read" on guardians
for select using (
    id in (
        select guardian_id from users_profiles
        where auth_id = auth.uid() and guardian_id is not null
    )
);

create policy "guardians_own_update" on guardians
for update using (
    id in (
        select guardian_id from users_profiles
        where auth_id = auth.uid() and guardian_id is not null
    )
);
