-- =========================================================================
-- Sincroniza el repo con lo que ya está en producción: en algún momento
-- después de la migración 20260827000000, `list_school_receivables()` se
-- modificó directo en la base (no vía migración) para ser `security
-- definer` con una comprobación explícita de autorización, en vez de
-- depender solo de RLS sobre `students` (como quedó originalmente,
-- `security invoker`). Esta migración solo documenta esa versión en el
-- repo -- no cambia nada en producción, ya está así.
--
-- Nota para revisar más adelante (no resuelta aquí): la comprobación exige
-- `users_profiles.school_id = p_school_id` -- eso excluye al caso de un
-- `super_admin` viendo "Entrar como director" un colegio que NO es el suyo
-- propio (ver `getActiveSchool()`), ya que su `school_id` real nunca
-- cambia. Con un solo colegio afiliado hoy no se manifiesta, pero hay que
-- revisarlo antes de afiliar un segundo colegio.
-- =========================================================================

create or replace function list_school_receivables(p_school_id uuid, p_as_of date default current_date)
returns table(
    student_id uuid,
    first_name text,
    last_name text,
    grade_level text,
    family_id uuid,
    school_level text,
    monthly_amount numeric,
    expected_to_date numeric,
    collected_amount numeric,
    overdue_amount numeric,
    oldest_overdue_due_date date,
    oldest_overdue_reference text,
    days_overdue int,
    aging_bucket text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
    if not exists (
        select 1 from users_profiles
        where auth_id = auth.uid()
        and school_id = p_school_id
        and role in ('super_admin','school_admin','director','finance','reception')
    ) then
        raise exception 'No autorizado para ver las cuentas por cobrar de este colegio';
    end if;

    return query
    select s.id, s.first_name, s.last_name, s.grade_level, s.family_id, r.school_level, r.monthly_amount,
           r.expected_to_date, r.collected_amount, r.overdue_amount, r.oldest_overdue_due_date,
           r.oldest_overdue_reference, r.days_overdue, r.aging_bucket
    from students s
    cross join lateral calculate_receivable_status(s.id, p_as_of) r
    where s.school_id = p_school_id
    and s.enrollment_status = 'inscrito'
    and s.deleted_at is null;
end;
$$;

revoke execute on function list_school_receivables(uuid, date) from public;
grant execute on function list_school_receivables(uuid, date) to authenticated, service_role;
