-- =========================================================================
-- SCHOOLOS — Migración 009: arregla recursión infinita de RLS en
-- users_profiles (bug crítico: rompía el login para TODOS los roles)
--
-- "users_profiles_staff_read" (migración 20260703) consulta la propia
-- tabla `users_profiles` dentro de una policy DE `users_profiles`.
-- Postgres detecta esto como recursión y aborta CUALQUIER select sobre
-- la tabla -- incluida la consulta más básica de "dame mi propio
-- perfil" -- lo que hacía que la app nunca pudiera leer el rol de
-- nadie y cayera siempre al valor por defecto ('guardian').
--
-- Fix estándar: mover la consulta a una función SECURITY DEFINER, que
-- se ejecuta con los privilegios del dueño de la función (el rol que
-- corre las migraciones) y por lo tanto no vuelve a aplicar RLS sobre
-- sí misma -- rompiendo el ciclo.
-- =========================================================================

create or replace function auth_profile_school_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
    select school_id from users_profiles where auth_id = auth.uid() limit 1
$$;

create or replace function auth_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
    select role from users_profiles where auth_id = auth.uid() limit 1
$$;

drop policy if exists "users_profiles_staff_read" on users_profiles;
create policy "users_profiles_staff_read" on users_profiles
for select using (
    school_id = auth_profile_school_id()
    and auth_profile_role() in ('super_admin','school_admin','director')
);
