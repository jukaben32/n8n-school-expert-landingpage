-- =========================================================================
-- SCHOOLOS - Seguridad Supabase Cloud 2026
-- =========================================================================
-- Supabase ya no expone tablas nuevas del schema public automaticamente.
-- Por eso combinamos:
-- 1. GRANT: permite que la Data API vea las tablas.
-- 2. RLS: decide que filas puede ver/modificar cada usuario autenticado.
-- =========================================================================

-- Permitir que usuarios autenticados usen el schema publico por la Data API.
grant usage on schema public to authenticated, service_role;

-- Exponer las tablas necesarias a la API para usuarios autenticados.
grant select, insert, update, delete on
  public.schools,
  public.families,
  public.students,
  public.guardians,
  public.student_guardians,
  public.enrollments,
  public.staff,
  public.users_profiles,
  public.roles,
  public.permissions,
  public.audit_logs,
  public.messages,
  public.message_reads,
  public.attendance,
  public.billing_concepts,
  public.invoices,
  public.payments
to authenticated;

-- El service_role se usa solo en servidor/n8n/Edge Functions. Nunca en frontend.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- =========================================================================
-- RLS en todas las tablas publicas creadas por el proyecto
-- =========================================================================

alter table public.schools enable row level security;
alter table public.families enable row level security;
alter table public.student_guardians enable row level security;
alter table public.enrollments enable row level security;
alter table public.staff enable row level security;
alter table public.users_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.audit_logs enable row level security;

-- =========================================================================
-- Politicas base multi-tenant
-- =========================================================================

-- Cada usuario puede leer su propio perfil. Las demas politicas consultan
-- esta tabla para saber a que colegio y rol pertenece el usuario.
create policy "users_profiles_read_own"
on public.users_profiles
for select
to authenticated
using ((select auth.uid()) = auth_id);

-- El usuario autenticado ve solo su colegio.
create policy "schools_read_same_school"
on public.schools
for select
to authenticated
using (
  id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
  )
);

-- Staff administrativo puede gestionar datos de su colegio.
create policy "schools_admin_update_same_school"
on public.schools
for update
to authenticated
using (
  id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director')
  )
)
with check (
  id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director')
  )
);

-- Familias: staff gestiona; tutores ven su propia familia.
create policy "families_staff_all"
on public.families
for all
to authenticated
using (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director','finance','reception')
  )
)
with check (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director','finance','reception')
  )
);

create policy "families_guardian_read_own"
on public.families
for select
to authenticated
using (
  id in (
    select g.family_id
    from public.guardians g
    join public.users_profiles up on up.guardian_id = g.id
    where up.auth_id = (select auth.uid())
    and up.role = 'guardian'
  )
);

-- Tutores: staff gestiona; cada tutor ve su propio registro.
create policy "guardians_staff_all"
on public.guardians
for all
to authenticated
using (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director','finance','reception')
  )
)
with check (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director','finance','reception')
  )
);

create policy "guardians_read_own"
on public.guardians
for select
to authenticated
using (
  id in (
    select guardian_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role = 'guardian'
  )
);

-- Relaciones estudiante-tutor: staff gestiona; tutores leen sus relaciones.
create policy "student_guardians_staff_all"
on public.student_guardians
for all
to authenticated
using (
  exists (
    select 1
    from public.guardians g
    join public.users_profiles up on up.school_id = g.school_id
    where g.id = guardian_id
    and up.auth_id = (select auth.uid())
    and up.role in ('super_admin','school_admin','director','teacher','finance','reception')
  )
)
with check (
  exists (
    select 1
    from public.guardians g
    join public.users_profiles up on up.school_id = g.school_id
    where g.id = guardian_id
    and up.auth_id = (select auth.uid())
    and up.role in ('super_admin','school_admin','director','teacher','finance','reception')
  )
);

create policy "student_guardians_guardian_read_own"
on public.student_guardians
for select
to authenticated
using (
  guardian_id in (
    select guardian_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role = 'guardian'
  )
);

-- Staff y matriculas: visibles/gestionables por administracion del colegio.
create policy "staff_admin_all"
on public.staff
for all
to authenticated
using (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director')
  )
)
with check (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director')
  )
);

create policy "enrollments_staff_read"
on public.enrollments
for select
to authenticated
using (
  student_id in (
    select s.id
    from public.students s
    join public.users_profiles up on up.school_id = s.school_id
    where up.auth_id = (select auth.uid())
    and up.role in ('super_admin','school_admin','director','teacher','finance','reception')
  )
);

-- Roles y permisos: lectura para usuarios autenticados.
create policy "roles_authenticated_read"
on public.roles
for select
to authenticated
using (true);

create policy "permissions_authenticated_read"
on public.permissions
for select
to authenticated
using (true);

-- Auditoria: staff administrativo puede consultar; usuarios autenticados pueden insertar.
create policy "audit_logs_admin_read"
on public.audit_logs
for select
to authenticated
using (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
    and role in ('super_admin','school_admin','director')
  )
);

create policy "audit_logs_authenticated_insert"
on public.audit_logs
for insert
to authenticated
with check (
  school_id in (
    select school_id
    from public.users_profiles
    where auth_id = (select auth.uid())
  )
);

-- Las funciones SECURITY DEFINER no deben quedar ejecutables por PUBLIC.
revoke execute on function public.notify_attendance_webhook() from public;
revoke execute on function public.generate_ncf(uuid, text) from public;
grant execute on function public.generate_ncf(uuid, text) to authenticated, service_role;
