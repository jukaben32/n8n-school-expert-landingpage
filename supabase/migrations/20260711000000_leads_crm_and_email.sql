-- =========================================================================
-- SCHOOLOS — Migración 013: CRM de leads (notas, conversión a colegio,
-- correo de confirmación automático vía Resend)
--
-- El correo se envía directo desde la base de datos con pg_net (ya
-- habilitado desde la migración del webhook de asistencia), sin pasar
-- por una Edge Function -- evita depender de Docker, que no está
-- disponible en el entorno de desarrollo local.
--
-- La API key de Resend NUNCA va en este archivo (se commitea a git).
-- Se guarda aparte en private.app_settings -- ver instrucciones al
-- final de este archivo para insertarla manualmente.
-- =========================================================================

-- ── Notas de seguimiento (bitácora por lead) ────────────────────────────
create table lead_notes (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references leads(id) on delete cascade,
    author_id uuid references users_profiles(id),
    note text not null,
    created_at timestamptz not null default now()
);

alter table lead_notes enable row level security;

drop policy if exists "lead_notes_super_admin_manage" on lead_notes;
create policy "lead_notes_super_admin_manage" on lead_notes
for all using (is_super_admin());

-- ── Trazabilidad: a qué colegio se convirtió este lead ──────────────────
alter table leads add column converted_school_id uuid references schools(id);

-- ── Correo de confirmación automático ────────────────────────────────────
create or replace function handle_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private, pg_temp
as $$
declare
    api_key text;
    from_address text;
begin
    api_key := private.get_app_setting('resend_api_key');
    from_address := coalesce(private.get_app_setting('resend_from_address'), 'onboarding@resend.dev');

    if api_key is null or api_key = '' then
        raise warning 'resend_api_key no configurado. Saltando correo de confirmación.';
        return new;
    end if;

    perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || api_key
        ),
        body := jsonb_build_object(
            'from', 'SchoolOS <' || from_address || '>',
            'to', jsonb_build_array(new.email),
            'subject', 'Recibimos tu solicitud de demo — SchoolOS',
            'html',
                '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">' ||
                '<h2 style="color:#1a5f7a;">¡Gracias, ' || split_part(new.contact_name, ' ', 1) || '!</h2>' ||
                '<p>Recibimos la solicitud de demo para <strong>' || new.school_name || '</strong>.</p>' ||
                '<p>Nuestro equipo te va a escribir a este correo en las próximas 24 horas para coordinar.</p>' ||
                '<p style="color:#64748b;font-size:13px;margin-top:32px;">— El equipo de SchoolOS</p>' ||
                '</div>'
        )::text
    );

    return new;
end;
$$;

drop trigger if exists trigger_new_lead on leads;
create trigger trigger_new_lead
    after insert on leads
    for each row
    execute function handle_new_lead();

revoke execute on function handle_new_lead() from public, anon, authenticated;

-- =========================================================================
-- PASO MANUAL (no lo hace esta migración, es información sensible):
-- entra al SQL Editor de Supabase y corre esto una sola vez, reemplazando
-- los valores por los tuyos:
--
--   insert into private.app_settings (key, value) values
--     ('resend_api_key', 'TU_API_KEY_DE_RESEND'),
--     ('resend_from_address', 'demo@tudominio.com')
--   on conflict (key) do update set value = excluded.value;
--
-- Sin dominio verificado en Resend, 'resend_from_address' debe quedar
-- como 'onboarding@resend.dev' (o simplemente no insertar esa fila) --
-- con ese remitente, Resend SOLO entrega al correo con el que creaste
-- la cuenta, no a leads reales.
-- =========================================================================
