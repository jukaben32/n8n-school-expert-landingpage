-- =========================================================================
-- MentorIApp — Migración 028: número de WhatsApp expuesto de forma segura
--
-- El botón flotante de WhatsApp (sitio público + Portal Familiar) necesita
-- saber, sin sesión de Supabase en el caso del sitio público, si el canal
-- está activo y a qué número enlazar. `whatsapp_connections` NUNCA se
-- expone directo a anon/guardian (tiene columnas sensibles como
-- instance_token) -- en vez de eso, se agregan solo los dos campos que
-- hacen falta a `schools_public`, la misma vista ya usada para el resto
-- del contenido público del colegio.
--
-- whatsapp_phone_number solo se rellena si el canal está realmente activo
-- (conectado Y habilitado) -- si está desconectado o deshabilitado, ambos
-- campos quedan en null/false, y el botón simplemente no se muestra.
-- =========================================================================

create or replace view schools_public
as
select
    s.id,
    s.name,
    s.subdomain,
    s.tagline,
    s.logo_url,
    s.address,
    s.phone,
    s.email,
    coalesce(s.settings -> 'website', '{}'::jsonb) as website_settings,
    (wc.status = 'connected' and wc.is_enabled) as whatsapp_active,
    case when wc.status = 'connected' and wc.is_enabled then wc.phone_number else null end as whatsapp_phone_number
from schools s
left join whatsapp_connections wc on wc.school_id = s.id
where s.deleted_at is null;

grant select on schools_public to anon, authenticated;
