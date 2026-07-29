-- =========================================================================
-- SCHOOLOS — Migración 021: Pagos con Azul (por colegio) + Transferencia
-- bancaria con comprobante
--
-- Decisión de arquitectura (confirmada con el usuario, no cuestionada):
-- el dinero de cada colegio va directo a la cuenta bancaria de ESE colegio,
-- nunca a una cuenta centralizada de la plataforma. Cada colegio afiliado
-- tiene sus propias credenciales de Azul -- igual que en el futuro cada
-- colegio podría tener su propio remitente de Resend.
--
-- Método de integración con Azul (investigado, no asumido -- ver PDF
-- oficial "E-commerce AZUL", descargado el 2026-07-28 desde
-- dev.azul.com.do): "Página de Pago AZUL", la opción de página alojada
-- por Azul. El navegador del cliente hace un POST directo (HTML form,
-- campos hidden) a un dominio de Azul; nuestro servidor JAMÁS ve ni toca
-- datos de tarjeta -- evita por completo el alcance de cumplimiento PCI
-- de manejar esos datos directamente, tal como pidió el usuario.
-- =========================================================================

-- ── Credenciales de Azul por colegio (mismo patrón que private.app_settings,
-- pero con school_id) ─────────────────────────────────────────────────────
create table private.school_payment_settings (
    school_id uuid primary key references schools(id),
    azul_merchant_id text,
    azul_merchant_name text,
    azul_merchant_type text not null default 'ECommerce',
    azul_currency_code text not null default '$',
    azul_auth_key text,               -- secreto HMAC, jamás se expone al cliente
    azul_environment text not null default 'test'
        check (azul_environment in ('test', 'production')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

revoke all on private.school_payment_settings from public, anon, authenticated;
grant select, insert, update, delete on private.school_payment_settings to service_role;

-- Lectura completa (incluye azul_auth_key) -- SOLO se llama desde código
-- server-only al armar el formulario de pago o verificar una respuesta de
-- Azul. Nunca se serializa el resultado de vuelta al navegador.
create or replace function public.get_school_payment_credentials(p_school_id uuid)
returns table (
    azul_merchant_id text,
    azul_merchant_name text,
    azul_merchant_type text,
    azul_currency_code text,
    azul_auth_key text,
    azul_environment text
)
language sql
stable
security definer
set search_path = private, public, pg_temp
as $$
  select azul_merchant_id, azul_merchant_name, azul_merchant_type,
         azul_currency_code, azul_auth_key, azul_environment
  from private.school_payment_settings
  where school_id = p_school_id;
$$;

revoke execute on function public.get_school_payment_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_school_payment_credentials(uuid) to service_role;

-- Lectura para la UI de configuración -- NUNCA incluye azul_auth_key, solo
-- si ya está configurado (has_auth_key), para no exponer el secreto de
-- vuelta al navegador ni siquiera para "mostrar" el valor guardado.
create or replace function public.get_school_payment_display(p_school_id uuid)
returns table (
    azul_merchant_id text,
    azul_merchant_name text,
    azul_merchant_type text,
    azul_currency_code text,
    azul_environment text,
    has_auth_key boolean
)
language sql
stable
security definer
set search_path = private, public, pg_temp
as $$
  select azul_merchant_id, azul_merchant_name, azul_merchant_type,
         azul_currency_code, azul_environment,
         (azul_auth_key is not null and azul_auth_key <> '') as has_auth_key
  from private.school_payment_settings
  where school_id = p_school_id;
$$;

revoke execute on function public.get_school_payment_display(uuid) from public, anon, authenticated;
grant execute on function public.get_school_payment_display(uuid) to service_role;

-- Guarda/actualiza credenciales. p_azul_auth_key: pasar NULL o '' para
-- conservar el secreto ya guardado (así la UI nunca necesita reenviar el
-- valor actual para editar los demás campos).
create or replace function public.upsert_school_payment_credentials(
    p_school_id uuid,
    p_azul_merchant_id text,
    p_azul_merchant_name text,
    p_azul_merchant_type text,
    p_azul_currency_code text,
    p_azul_environment text,
    p_azul_auth_key text
)
returns void
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  insert into private.school_payment_settings (
    school_id, azul_merchant_id, azul_merchant_name, azul_merchant_type,
    azul_currency_code, azul_environment, azul_auth_key
  )
  values (
    p_school_id, p_azul_merchant_id, p_azul_merchant_name, p_azul_merchant_type,
    p_azul_currency_code, p_azul_environment, nullif(p_azul_auth_key, '')
  )
  on conflict (school_id) do update set
    azul_merchant_id = excluded.azul_merchant_id,
    azul_merchant_name = excluded.azul_merchant_name,
    azul_merchant_type = excluded.azul_merchant_type,
    azul_currency_code = excluded.azul_currency_code,
    azul_environment = excluded.azul_environment,
    azul_auth_key = coalesce(nullif(p_azul_auth_key, ''), private.school_payment_settings.azul_auth_key),
    updated_at = now();
end;
$$;

revoke execute on function public.upsert_school_payment_credentials(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.upsert_school_payment_credentials(uuid, text, text, text, text, text, text) to service_role;

-- ── Transacciones de Azul ─────────────────────────────────────────────────
-- Correlaciona el OrderNumber que le mandamos a Azul con la factura real,
-- y guarda la respuesta completa para trazabilidad. El estado solo lo
-- actualiza el callback server-side después de verificar el AuthHash de
-- respuesta -- nunca el navegador del cliente directamente.
create table azul_transactions (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    invoice_id uuid not null references invoices(id),
    order_number text not null unique,
    amount numeric(12,2) not null,
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'declined', 'error')),
    response_payload jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_azul_transactions_invoice on azul_transactions(invoice_id);
create index idx_azul_transactions_order_number on azul_transactions(order_number);

alter table azul_transactions enable row level security;

-- Guardian: solo lectura de las transacciones de facturas de su propia
-- familia (mismo patrón que invoices_guardian_read).
drop policy if exists "azul_transactions_guardian_read" on azul_transactions;
create policy "azul_transactions_guardian_read" on azul_transactions
for select using (
    invoice_id in (
        select i.id from invoices i
        join families f on f.id = i.family_id
        join guardians g on g.family_id = f.id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

-- Staff de tesorería del colegio: solo lectura (mismo set de roles que
-- invoices_staff/payments_staff).
drop policy if exists "azul_transactions_staff_read" on azul_transactions;
create policy "azul_transactions_staff_read" on azul_transactions
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance','reception')
    )
);

-- Sin políticas de insert/update/delete para guardian ni staff: todas las
-- escrituras las hace el core server-side con service_role, nunca el
-- cliente directo (ni el navegador del cliente ni el panel de staff
-- pueden marcar una transacción como aprobada).

-- ── Comprobantes de transferencia bancaria ───────────────────────────────
create table payment_receipts (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    family_id uuid not null references families(id),
    invoice_id uuid not null references invoices(id),
    guardian_id uuid not null references guardians(id),
    amount numeric(12,2) not null check (amount > 0),
    storage_path text not null,
    status text not null default 'pendiente'
        check (status in ('pendiente', 'confirmado', 'rechazado')),
    reviewed_by uuid references users_profiles(id),
    reviewed_at timestamptz,
    rejection_reason text,
    created_at timestamptz not null default now()
);

create index idx_payment_receipts_family on payment_receipts(family_id);
create index idx_payment_receipts_school_status on payment_receipts(school_id, status);

alter table payment_receipts enable row level security;

-- Guardian: puede ver y crear los comprobantes de su propia familia
-- (nunca los de otra). Sin policy de update/delete -- una vez subido, solo
-- el staff de tesorería puede cambiar el estado (confirmar/rechazar).
drop policy if exists "payment_receipts_guardian_read" on payment_receipts;
create policy "payment_receipts_guardian_read" on payment_receipts
for select using (
    family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

drop policy if exists "payment_receipts_guardian_insert" on payment_receipts;
create policy "payment_receipts_guardian_insert" on payment_receipts
for insert with check (
    guardian_id in (
        select g.id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
    and family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

-- Staff de tesorería (mismos roles que pueden acceder al módulo
-- 'tesoreria' en web/src/lib/permissions.ts): lectura y actualización
-- (confirmar/rechazar) de los comprobantes de SU colegio únicamente.
drop policy if exists "payment_receipts_staff_read" on payment_receipts;
create policy "payment_receipts_staff_read" on payment_receipts
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance')
    )
);

drop policy if exists "payment_receipts_staff_update" on payment_receipts;
create policy "payment_receipts_staff_update" on payment_receipts
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','finance')
    )
);

-- ── Storage: comprobantes de pago (bucket privado) ───────────────────────
-- A propósito NO se agrega ninguna política de storage.objects para
-- anon/authenticated: el bucket es privado y TODO el acceso (subida,
-- lectura vía signed URL) pasa por Server Actions que usan el cliente
-- service_role después de validar el permiso explícitamente en código
-- TypeScript -- mismo principio de defensa en profundidad que
-- answerFamilyQuestion.ts, en vez de depender de políticas de RLS sobre
-- storage.objects basadas en parseo de rutas (más frágil).
insert into storage.buckets (id, name, public)
values ('comprobantes-pago', 'comprobantes-pago', false)
on conflict (id) do nothing;
