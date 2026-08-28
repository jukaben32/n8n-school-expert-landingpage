-- =========================================================================
-- Cuentas por Cobrar — list_school_receivables como SECURITY DEFINER
-- (corrige "canceling statement due to statement timeout" en producción)
--
-- Encontrado al verificar el PR ya fusionado contra producción real: la
-- pantalla funcionaba con la service_role key (que se salta RLS por
-- completo) pero daba timeout con la sesión real de un usuario `finance`.
-- Causa: list_school_receivables es SECURITY INVOKER y llama a
-- calculate_receivable_status una vez POR CADA estudiante inscrito (101 en
-- el colegio piloto) vía cross join lateral; cada una de esas llamadas, al
-- ejecutar bajo los privilegios del usuario real, dispara las políticas
-- RLS de students/invoices/schools/school_years/billing_concepts -- y cada
-- una de esas políticas hace su propia subconsulta a users_profiles. El
-- resultado son cientos de subconsultas repetidas por una sola carga de
-- pantalla, suficiente para chocar contra el statement_timeout con datos
-- reales (no se notó antes porque el dataset de prueba nunca se consultó
-- con la sesión de un usuario real, solo con la service_role key).
--
-- Se convierte a SECURITY DEFINER (mismo patrón que ya usan
-- calculate_sibling_discount, get_school_payment_credentials, etc. en este
-- proyecto) para que el permiso se verifique UNA sola vez al entrar a la
-- función, en vez de repetirse en cada subconsulta de RLS. La llamada
-- anidada a calculate_receivable_status (que sigue siendo SECURITY
-- INVOKER) hereda el contexto de privilegios de esta función mientras
-- corre adentro de ella, así que no hace falta tocarla aparte.
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
set search_path = public, pg_temp
as $$
begin
    -- Mismo criterio que las políticas RLS que reemplaza (students_read /
    -- invoices_staff / billing_concepts_staff): solo staff del propio
    -- colegio, con rol de tesorería o superior.
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
