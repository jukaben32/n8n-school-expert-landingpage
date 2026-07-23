-- =========================================================================
-- SCHOOLOS — Migración 005: Endurecimiento de RLS (tablas núcleo)
--
-- Las migraciones anteriores dejaron sin RLS a: schools, families,
-- enrollments, staff, users_profiles, student_guardians, roles,
-- permissions y audit_logs. Sin RLS, PostgREST expone esas tablas
-- completas a cualquier rol autenticado (fuga multi-tenant).
-- =========================================================================

alter table schools            enable row level security;
alter table families           enable row level security;
alter table enrollments        enable row level security;
alter table staff              enable row level security;
alter table users_profiles     enable row level security;
alter table student_guardians  enable row level security;
alter table roles              enable row level security;
alter table permissions        enable row level security;
alter table audit_logs         enable row level security;

-- ── users_profiles ───────────────────────────────────────────────────────
-- Cada usuario puede leer (y actualizar sus preferencias en) su propio perfil.
drop policy if exists "users_profiles_own_read" on users_profiles;
create policy "users_profiles_own_read" on users_profiles
for select using (
    auth_id = auth.uid()
);

drop policy if exists "users_profiles_own_update" on users_profiles;
create policy "users_profiles_own_update" on users_profiles
for update using (
    auth_id = auth.uid()
);

-- El staff administrativo puede ver los perfiles de su mismo colegio
-- (necesario para pantallas de gestión de usuarios/roles).
drop policy if exists "users_profiles_staff_read" on users_profiles;
create policy "users_profiles_staff_read" on users_profiles
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director')
    )
);

-- ── schools ───────────────────────────────────────────────────────────────
-- Cualquier usuario del colegio puede leer los datos básicos de SU colegio.
drop policy if exists "schools_read" on schools;
create policy "schools_read" on schools
for select using (
    id in (select school_id from users_profiles where auth_id = auth.uid())
);

drop policy if exists "schools_staff_manage" on schools;
create policy "schools_staff_manage" on schools
for update using (
    id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin')
    )
);

-- ── families ──────────────────────────────────────────────────────────────
drop policy if exists "families_staff_all" on families;
create policy "families_staff_all" on families
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','finance','reception')
    )
);

drop policy if exists "families_guardian_read" on families;
create policy "families_guardian_read" on families
for select using (
    id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

-- ── staff ─────────────────────────────────────────────────────────────────
drop policy if exists "staff_read" on staff;
create policy "staff_read" on staff
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','finance','reception')
    )
);

drop policy if exists "staff_admin_manage" on staff;
create policy "staff_admin_manage" on staff
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);

-- ── student_guardians ─────────────────────────────────────────────────────
drop policy if exists "student_guardians_staff_all" on student_guardians;
create policy "student_guardians_staff_all" on student_guardians
for all using (
    student_id in (
        select id from students
        where school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid()
            and role in ('super_admin','school_admin','director','teacher','finance','reception')
        )
    )
);

drop policy if exists "student_guardians_guardian_read" on student_guardians;
create policy "student_guardians_guardian_read" on student_guardians
for select using (
    guardian_id in (
        select guardian_id from users_profiles
        where auth_id = auth.uid() and role = 'guardian'
    )
);

-- ── enrollments ───────────────────────────────────────────────────────────
drop policy if exists "enrollments_staff_all" on enrollments;
create policy "enrollments_staff_all" on enrollments
for all using (
    student_id in (
        select id from students
        where school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid()
            and role in ('super_admin','school_admin','director','teacher','finance','reception')
        )
    )
);

drop policy if exists "enrollments_guardian_read" on enrollments;
create policy "enrollments_guardian_read" on enrollments
for select using (
    student_id in (
        select sg.student_id
        from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

-- ── roles / permissions ──────────────────────────────────────────────────
-- Tablas de referencia (no multi-tenant): lectura para cualquier usuario
-- autenticado, sin escritura vía API pública.
drop policy if exists "roles_read_authenticated" on roles;
create policy "roles_read_authenticated" on roles
for select using (auth.uid() is not null);

drop policy if exists "permissions_read_authenticated" on permissions;
create policy "permissions_read_authenticated" on permissions
for select using (auth.uid() is not null);

-- ── audit_logs ────────────────────────────────────────────────────────────
-- Solo el staff directivo de cada colegio puede leer su propio log de
-- auditoría. Las escrituras se hacen desde Edge Functions con service_role
-- (que ignora RLS), así que no se agrega policy de insert para clientes.
drop policy if exists "audit_logs_admin_read" on audit_logs;
create policy "audit_logs_admin_read" on audit_logs
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);
