-- =========================================================================
-- Comunicados con imagen -- el usuario reportó que intentar pegar una
-- imagen (ej. un aviso ya diseñado como flyer) en el campo de texto no
-- funcionaba: Comunicados solo aceptaba texto. Se agrega un adjunto de
-- imagen opcional por comunicado.
-- =========================================================================

alter table messages add column if not exists image_path text;

-- Bucket privado, mismo principio de defensa en profundidad que
-- 'class-updates' (fotos de estudiantes): el acceso de lectura pasa por
-- signed URLs generadas server-side (ver comunicados/page.tsx), la subida
-- pasa por el Server Action con el cliente service_role después de validar
-- el permiso 'comunicados_nuevo' -- nunca políticas de storage.objects para
-- anon/authenticated.
insert into storage.buckets (id, name, public)
values ('comunicados-imagenes', 'comunicados-imagenes', false)
on conflict (id) do nothing;
