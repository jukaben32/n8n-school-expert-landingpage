-- =========================================================================
-- MentorIApp — "Mi nómina": comprobantes de pago visibles para cada empleado
-- (2026-10-15)
--
-- Contexto: la nómina se calcula y se cierra en Excel (fuente de verdad). Esta
-- migración solo agrega un lugar para PUBLICAR el resultado ya cerrado, de modo
-- que cada empleado vea ÚNICAMENTE sus propios comprobantes, y Dirección los
-- publique y avise por correo.
--
-- Principios (ver docs/PLAN_MODULO_NOMINA.md):
--   * Los datos de sueldo NO se agregan a `staff`: van en tablas nuevas con su
--     propia RLS, así un permiso de "Personal" nunca da acceso a sueldos.
--   * Un comprobante publicado no se edita (trigger). Se corrige en el período
--     siguiente.
--   * Borrador (published_at null): solo lo ve Dirección. Publicado: lo ve
--     Dirección y la persona dueña, nadie más -- ni tutores, ni estudiantes, ni
--     otros docentes, ni recepción/finanzas.
--   * No se guarda la cédula ni la cuenta bancaria: el comprobante no las
--     necesita.
--   * Esta migración NO toca ninguna tabla ni policy existente.
-- =========================================================================

create table if not exists payslips (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    staff_id uuid not null references staff(id),
    period_key integer not null check (period_key between 200001 and 209912),  -- AAAAMM
    run text not null check (run in ('M', 'Q1', 'Q2')),                          -- mensual / 1ª / 2ª quincena
    employee_name text not null,
    payment_method text not null default 'Banco',
    base_salary numeric(12,2) not null default 0,
    other_income numeric(12,2) not null default 0,
    gross numeric(12,2) not null default 0,
    afp numeric(12,2) not null default 0,
    ars numeric(12,2) not null default 0,
    isr numeric(12,2) not null default 0,
    private_insurance numeric(12,2) not null default 0,
    tuition_discount numeric(12,2) not null default 0,
    savings_deposit numeric(12,2) not null default 0,
    advances numeric(12,2) not null default 0,
    loan_installment numeric(12,2) not null default 0,
    cafeteria numeric(12,2) not null default 0,
    uniforms numeric(12,2) not null default 0,
    other_deductions numeric(12,2) not null default 0,
    total_deductions numeric(12,2) not null default 0,
    savings_withdrawal numeric(12,2) not null default 0,
    net numeric(12,2) not null default 0,
    published_at timestamptz,
    published_by uuid references users_profiles(id),
    notified_at timestamptz,
    created_by uuid references users_profiles(id),
    created_at timestamptz not null default now(),
    unique (school_id, staff_id, period_key, run),
    -- La cuenta tiene que cuadrar: si Excel y la plataforma discrepan, no entra.
    constraint payslips_net_matches check (abs(net - (gross - total_deductions + savings_withdrawal)) <= 0.02)
);
create index if not exists idx_payslips_staff on payslips(staff_id, period_key desc);
create index if not exists idx_payslips_period on payslips(school_id, period_key, run);

alter table payslips enable row level security;

-- Cada empleado ve SOLO sus comprobantes ya PUBLICADOS. El vínculo es el
-- real: users_profiles.staff_id de su propia sesión.
drop policy if exists "payslips_own_read" on payslips;
create policy "payslips_own_read" on payslips
for select using (
    published_at is not null
    and exists (
        select 1 from users_profiles up
        where up.auth_id = auth.uid()
          and up.staff_id = payslips.staff_id
          and up.school_id = payslips.school_id
          and up.role in ('super_admin', 'school_admin', 'director', 'teacher', 'finance', 'reception')
    )
);

-- Dirección de ESE colegio ve todo (incluidos borradores) y publica.
drop policy if exists "payslips_manager_read" on payslips;
create policy "payslips_manager_read" on payslips
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "payslips_manager_insert" on payslips;
create policy "payslips_manager_insert" on payslips
for insert with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "payslips_manager_update" on payslips;
create policy "payslips_manager_update" on payslips
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "payslips_super_admin" on payslips;
create policy "payslips_super_admin" on payslips
for all using (is_super_admin()) with check (is_super_admin());

-- No hay policy de DELETE: un comprobante no se borra.

-- Un comprobante publicado no cambia de cifras. (Se puede retirar la
-- publicación, corregir y volver a publicar, pero nunca editar "en vivo".)
create or replace function payslips_block_published_edit()
returns trigger
language plpgsql
as $$
begin
    if old.published_at is not null and new.published_at is not null and (
        new.staff_id is distinct from old.staff_id
        or new.period_key is distinct from old.period_key
        or new.run is distinct from old.run
        or new.employee_name is distinct from old.employee_name
        or new.payment_method is distinct from old.payment_method
        or new.base_salary is distinct from old.base_salary
        or new.other_income is distinct from old.other_income
        or new.gross is distinct from old.gross
        or new.afp is distinct from old.afp
        or new.ars is distinct from old.ars
        or new.isr is distinct from old.isr
        or new.private_insurance is distinct from old.private_insurance
        or new.tuition_discount is distinct from old.tuition_discount
        or new.savings_deposit is distinct from old.savings_deposit
        or new.advances is distinct from old.advances
        or new.loan_installment is distinct from old.loan_installment
        or new.cafeteria is distinct from old.cafeteria
        or new.uniforms is distinct from old.uniforms
        or new.other_deductions is distinct from old.other_deductions
        or new.total_deductions is distinct from old.total_deductions
        or new.savings_withdrawal is distinct from old.savings_withdrawal
        or new.net is distinct from old.net
    ) then
        raise exception 'Un comprobante publicado no se puede modificar. Retire la publicación primero.'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_payslips_block_published_edit on payslips;
create trigger trg_payslips_block_published_edit
before update on payslips
for each row execute function payslips_block_published_edit();

grant select, insert, update on payslips to authenticated;
grant all privileges on payslips to service_role;

-- -------------------------------------------------------------------------
-- Vínculo "ID de la hoja de Excel" -> ficha de personal. Se confirma una sola
-- vez por persona (los nombres de Excel no coinciden con los de la ficha).
-- Solo Dirección lo ve y lo edita.
-- -------------------------------------------------------------------------
create table if not exists payslip_staff_map (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    excel_id text not null check (length(trim(excel_id)) > 0),
    staff_id uuid not null references staff(id),
    created_by uuid references users_profiles(id),
    created_at timestamptz not null default now(),
    unique (school_id, excel_id)
);

alter table payslip_staff_map enable row level security;

drop policy if exists "payslip_staff_map_manager" on payslip_staff_map;
create policy "payslip_staff_map_manager" on payslip_staff_map
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

drop policy if exists "payslip_staff_map_super_admin" on payslip_staff_map;
create policy "payslip_staff_map_super_admin" on payslip_staff_map
for all using (is_super_admin()) with check (is_super_admin());

grant select, insert, update on payslip_staff_map to authenticated;
grant all privileges on payslip_staff_map to service_role;

-- -------------------------------------------------------------------------
-- Constancia de quién abrió cada comprobante (Ley 172-13: datos salariales).
-- Se guarda solo la PRIMERA vez que la persona lo abre.
-- -------------------------------------------------------------------------
create table if not exists payslip_views (
    id uuid primary key default gen_random_uuid(),
    payslip_id uuid not null references payslips(id) on delete cascade,
    profile_id uuid not null references users_profiles(id),
    first_viewed_at timestamptz not null default now(),
    unique (payslip_id, profile_id)
);

alter table payslip_views enable row level security;

-- Uno solo puede registrar SU propia vista de SU propio comprobante.
drop policy if exists "payslip_views_own_insert" on payslip_views;
create policy "payslip_views_own_insert" on payslip_views
for insert with check (
    exists (
        select 1
        from users_profiles up
        join payslips p on p.id = payslip_views.payslip_id
        where up.auth_id = auth.uid()
          and up.id = payslip_views.profile_id
          and up.staff_id = p.staff_id
          and p.published_at is not null
    )
);

drop policy if exists "payslip_views_own_read" on payslip_views;
create policy "payslip_views_own_read" on payslip_views
for select using (
    profile_id in (select id from users_profiles where auth_id = auth.uid())
);

drop policy if exists "payslip_views_manager_read" on payslip_views;
create policy "payslip_views_manager_read" on payslip_views
for select using (
    payslip_id in (
        select p.id from payslips p
        where p.school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
        )
    )
);

grant select, insert on payslip_views to authenticated;
grant all privileges on payslip_views to service_role;
