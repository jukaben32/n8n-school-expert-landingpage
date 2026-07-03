-- =========================================================================
-- SCHOOLOS — Migración 004: Módulo de Pagos y Tesorería
-- Incluye: conceptos de cobro, facturas, pagos y NCF para DGII (RD)
-- =========================================================================

-- ── Conceptos de Cobro (Mensualidad, Matrícula, Uniforme, etc.) ──────────
create table billing_concepts (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    name text not null,                          -- "Mensualidad", "Matrícula", etc.
    amount numeric(12,2) not null,               -- Monto en DOP
    currency text not null default 'DOP',
    applies_to text not null default 'all'       -- 'all' | 'grade' | 'student'
        check (applies_to in ('all','grade','student')),
    recurrence text not null default 'monthly'   -- 'monthly' | 'annual' | 'one_time'
        check (recurrence in ('monthly','annual','one_time')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index idx_billing_concepts_school on billing_concepts(school_id) where deleted_at is null;

-- ── Facturas (Estado de Cuenta) ──────────────────────────────────────────
create table invoices (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    family_id uuid not null references families(id),
    student_id uuid references students(id),
    concept_id uuid references billing_concepts(id),
    description text not null,
    amount numeric(12,2) not null,               -- Monto total en DOP
    tax_amount numeric(12,2) not null default 0, -- ITBIS (18% si aplica)
    total_amount numeric(12,2) not null,         -- amount + tax_amount
    currency text not null default 'DOP',
    due_date date not null,
    status text not null default 'pendiente'
        check (status in ('pendiente','pagado','vencido','anulado')),
    -- Comprobante Fiscal (NCF para DGII)
    ncf text unique,                             -- Ej: B0100000001
    ncf_type text default '02'                  -- '01'=crédito fiscal, '02'=consumidor final
        check (ncf_type in ('01','02','14','15')),
    -- Trazabilidad
    issued_at timestamptz not null default now(),
    paid_at timestamptz,
    created_by uuid references users_profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index idx_invoices_school_status on invoices(school_id, status) where deleted_at is null;
create index idx_invoices_family on invoices(family_id) where deleted_at is null;
create index idx_invoices_due_date on invoices(school_id, due_date) where deleted_at is null;

-- ── Pagos (Transacciones) ────────────────────────────────────────────────
create table payments (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    invoice_id uuid not null references invoices(id),
    amount_paid numeric(12,2) not null,
    currency text not null default 'DOP',
    payment_method text not null default 'efectivo'
        check (payment_method in ('efectivo','transferencia','tarjeta','azul','cheque')),
    -- Datos de tarjeta (Azul/CardNet)
    gateway_reference text,                      -- ID de transacción del gateway
    gateway_response jsonb,                      -- Respuesta completa del gateway
    -- Quien recibió el pago
    received_by uuid references users_profiles(id),
    paid_at timestamptz not null default now(),
    notes text,
    created_at timestamptz not null default now()
);
create index idx_payments_invoice on payments(invoice_id);
create index idx_payments_school on payments(school_id);

-- ── Secuencia NCF (Comprobantes Fiscales DGII) ───────────────────────────
-- Genera NCFs únicos con bloqueo de transacción para evitar duplicados
create sequence if not exists ncf_sequence_02 start 1 increment 1;
create sequence if not exists ncf_sequence_01 start 1 increment 1;

-- Función para generar el próximo NCF de forma segura (sin duplicados)
create or replace function generate_ncf(
    p_school_id uuid,
    p_ncf_type text default '02'
)
returns text
language plpgsql
security definer
as $$
declare
    v_sequence bigint;
    v_ncf text;
    v_prefix text;
begin
    -- Bloqueo exclusivo a nivel de transacción para evitar NCF duplicados
    perform pg_advisory_xact_lock(hashtext(p_school_id::text || p_ncf_type));

    if p_ncf_type = '02' then
        v_sequence := nextval('ncf_sequence_02');
        v_prefix := 'B02';
    elsif p_ncf_type = '01' then
        v_sequence := nextval('ncf_sequence_01');
        v_prefix := 'B01';
    else
        v_sequence := nextval('ncf_sequence_02');
        v_prefix := 'B' || p_ncf_type;
    end if;

    -- Formato: B0200000001 (11 caracteres)
    v_ncf := v_prefix || lpad(v_sequence::text, 8, '0');
    return v_ncf;
end;
$$;

-- ── RLS para Pagos ────────────────────────────────────────────────────────
alter table billing_concepts enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;

-- Conceptos: staff los gestiona, guardians los ven
create policy "billing_concepts_staff" on billing_concepts
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance','reception')
    )
);
create policy "billing_concepts_guardian_read" on billing_concepts
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role = 'guardian'
    )
    and is_active = true
    and deleted_at is null
);

-- Facturas: staff las gestiona; guardians ven las de su familia
create policy "invoices_staff" on invoices
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance','reception')
    )
);
create policy "invoices_guardian_read" on invoices
for select using (
    family_id in (
        select f.id from families f
        join guardians g on g.family_id = f.id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
    and deleted_at is null
);

-- Pagos: staff los gestiona; guardians ven los de sus facturas
create policy "payments_staff" on payments
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance','reception')
    )
);
create policy "payments_guardian_read" on payments
for select using (
    invoice_id in (
        select i.id from invoices i
        join families f on f.id = i.family_id
        join guardians g on g.family_id = f.id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);
