-- =========================================================================
-- SCHOOLOS — Migración 010: Super administrador multi-colegio
--
-- Hasta ahora 'super_admin' era solo una palabra permitida en el check
-- constraint de users_profiles.role -- las policies de RLS seguían
-- filtrando TODO por school_id, así que un super_admin veía exactamente
-- lo mismo que un director de un solo colegio.
--
-- Esta migración agrega una policy adicional PERMISIVA por tabla que
-- deja pasar todo cuando el usuario es super_admin. Las policies
-- permisivas se combinan con OR, así que esto no toca ni una sola
-- policy existente -- solo añade el bypass.
-- =========================================================================

create or replace function is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from users_profiles
        where auth_id = auth.uid() and role = 'super_admin'
    )
$$;

do $$
declare
    t text;
    tables text[] := array[
        'students','guardians','messages','message_reads','attendance',
        'billing_concepts','invoices','payments','schools','families',
        'student_guardians','enrollments','staff','users_profiles','roles',
        'permissions','audit_logs','school_years','grade_levels','subjects',
        'lessons','quiz_questions','quiz_options','quiz_attempts',
        'quiz_answers','student_points','badges','student_badges'
    ];
begin
    foreach t in array tables loop
        execute format('drop policy if exists "%s_super_admin_all" on %I;', t, t);
        execute format('create policy "%s_super_admin_all" on %I for all using (is_super_admin());', t, t);
    end loop;
end $$;
