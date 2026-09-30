-- Acceso familiar por telefono + codigo temporal.
--
-- Esta tabla no sustituye Supabase Auth. Solo guarda el reto corto que se
-- envia por WhatsApp para que, al validarlo, podamos crear una sesion normal
-- de Supabase sin pedir correo ni contrasena al padre.

create table if not exists public.family_phone_access_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  auth_id uuid not null,
  auth_email text not null,
  normalized_phone text not null,
  code_hash text not null,
  attempt_count integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  request_ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_phone_access_codes_phone_recent
  on public.family_phone_access_codes (normalized_phone, created_at desc);

create index if not exists idx_family_phone_access_codes_active
  on public.family_phone_access_codes (id, expires_at)
  where consumed_at is null;

alter table public.family_phone_access_codes enable row level security;

-- Solo el servidor con service_role debe leer/escribir estos codigos. No se
-- crean policies para anon/authenticated a proposito.
grant all privileges on public.family_phone_access_codes to service_role;

