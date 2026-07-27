-- =========================================================================
-- SCHOOLOS — Migración 017: corrige la llamada a pg_net del trigger de leads
--
-- net.http_post() espera su parámetro `body` como jsonb -- la migración
-- 013 lo convertía a texto (`::text`) sin necesidad, lo que hacía que
-- Postgres no encontrara ninguna función con esa combinación exacta de
-- tipos ("function net.http_post(url => unknown, headers => jsonb,
-- body => text) does not exist"). El insert en `leads` sí funcionaba
-- -- el error saltaba en el trigger que manda el correo de confirmación.
-- =========================================================================

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
        )
        -- (sin ::text -- pg_net espera jsonb en `body`, no texto)
    );

    return new;
end;
$$;

revoke execute on function handle_new_lead() from public, anon, authenticated;
