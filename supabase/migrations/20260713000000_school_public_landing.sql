-- =========================================================================
-- SCHOOLOS — Migración 015: landing pública por colegio afiliado
--
-- Cada colegio afiliado necesita una página de bienvenida propia,
-- visible SIN iniciar sesión (para que las familias sepan que llegaron
-- al lugar correcto antes de loguearse). Como los visitantes no tienen
-- sesión, las policies normales de RLS de `schools` (que exigen
-- auth.uid()) no les dejan ver nada.
--
-- En vez de abrir toda la tabla `schools` a cualquiera (que también
-- tiene columnas internas como `settings` o `rnc`), se crea una VISTA
-- con solo las columnas seguras para mostrar en público.
-- =========================================================================

alter table schools add column if not exists tagline text;

create or replace view schools_public
as
select id, name, subdomain, tagline, logo_url, address, phone, email
from schools
where deleted_at is null;

grant select on schools_public to anon, authenticated;

-- Sin `security_invoker`, la vista corre con los privilegios de quien
-- la creó (el dueño de la tabla, exento de RLS) -- así que NO hace
-- falta abrir la tabla `schools` completa a usuarios anónimos. Solo
-- las columnas seleccionadas arriba quedan expuestas públicamente.

-- 'schools_staff_manage' (migración 20260703) dejaba actualizar el
-- colegio solo a school_admin/super_admin -- un descuido, ya que en
-- todo el resto del sistema 'director' tiene el mismo nivel de acceso
-- completo. Sin esto, la Configuración del colegio (esta migración)
-- fallaría en silencio para cualquier director real.
drop policy if exists "schools_staff_manage" on schools;
create policy "schools_staff_manage" on schools
for update using (
    id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);
