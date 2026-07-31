-- =========================================================================
-- SCHOOLOS → MENTORIAPP — Migración 024: renombrar la marca en el correo
-- de confirmación de leads
--
-- Cambio de marca decidido con el usuario: "SchoolOS" -> "MentorIApp"
-- (juego de palabras: Mentoría + IA + App). Esta migración solo actualiza
-- el texto del correo de handle_new_lead() -- no se edita la migración
-- original (20260711000000/20260715000000) porque ya está aplicada; se
-- re-declara la función con create or replace, mismo patrón ya usado
-- cada vez que se corrige esta función.
-- =========================================================================

create or replace function public.handle_new_lead()
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
            'from', 'MentorIApp <' || from_address || '>',
            'to', jsonb_build_array(new.email),
            'subject', 'Recibimos tu solicitud de demo — MentorIApp',
            'html',
                '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">' ||
                '<h2 style="color:#1a5f7a;">¡Gracias, ' || split_part(new.contact_name, ' ', 1) || '!</h2>' ||
                '<p>Recibimos la solicitud de demo para <strong>' || new.school_name || '</strong>.</p>' ||
                '<p>Nuestro equipo te va a escribir a este correo en las próximas 24 horas para coordinar.</p>' ||
                '<p style="color:#64748b;font-size:13px;margin-top:32px;">— El equipo de MentorIApp</p>' ||
                '</div>'
        )
        -- (sin ::text -- pg_net espera jsonb en `body`, no texto)
    );

    return new;
end;
$$;

revoke execute on function public.handle_new_lead() from public, anon, authenticated;
