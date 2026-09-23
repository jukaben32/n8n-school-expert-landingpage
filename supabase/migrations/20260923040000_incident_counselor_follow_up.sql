-- =========================================================================
-- Incidencias: el seguimiento lo registra también la psicóloga (2026-09-23)
--
-- Decisión del colegio: el maestro completa la incidencia en el momento; el
-- seguimiento lo hace la psicóloga (Génesis) en coordinación con Dirección.
-- Hasta ahora solo super_admin/school_admin/director podían escribirlo.
--
-- La psicóloga entra con rol de acceso 'teacher', así que NO se le da el rol
-- de Dirección ni se toca permissions.ts: se la reconoce por su PUESTO en la
-- ficha de Personal (staff.role = 'psychologist'). Así ningún otro docente
-- gana permisos, y si el colegio cambia de psicóloga basta con el puesto.
--
-- Función con nombre NUEVO (no sobrecarga). Solo AGREGA dos policies
-- permisivas (se combinan con OR); las existentes no cambian. Idempotente.
-- =========================================================================

create or replace function incident_is_counselor(p_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
        from users_profiles up
        join staff s on s.id = up.staff_id
        where up.auth_id = auth.uid()
          and up.school_id = p_school_id
          and s.school_id = p_school_id
          and s.role = 'psychologist'
          and s.deleted_at is null
    )
$$;
revoke execute on function incident_is_counselor(uuid) from public;
revoke execute on function incident_is_counselor(uuid) from anon;
grant execute on function incident_is_counselor(uuid) to authenticated, service_role;

-- Ve todos los casos del colegio aunque no tenga asignación de cursos.
drop policy if exists "student_incidents_counselor_read" on student_incidents;
create policy "student_incidents_counselor_read" on student_incidents
for select using (incident_is_counselor(school_id));

-- Registra el seguimiento (estado + notas), igual que Dirección.
drop policy if exists "student_incidents_counselor_update" on student_incidents;
create policy "student_incidents_counselor_update" on student_incidents
for update using (incident_is_counselor(school_id))
with check (incident_is_counselor(school_id));
