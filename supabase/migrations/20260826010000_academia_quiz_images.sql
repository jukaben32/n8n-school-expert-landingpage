-- =========================================================================
-- Academia -- imagen de apoyo por pregunta + extracción OCR de cuestionarios
-- (ver AGENTS.md). El profesor pidió poder cargar cuestionarios largos
-- directo desde la foto del libro de texto en vez de reescribirlos.
--
-- Dos piezas, combinadas:
--   1. quiz_questions.image_path -- imagen de apoyo opcional por pregunta
--      (ej. un diagrama o gráfico que la pregunta necesita). Las opciones
--      de respuesta se siguen escribiendo como texto -- el estudiante sigue
--      respondiendo con los mismos botones de siempre, nunca con imágenes.
--   2. Extracción con Claude (visión) de una foto/PDF del cuestionario del
--      libro -> arma el borrador de preguntas+opciones en el formulario de
--      Nueva Lección para que el profesor lo revise/corrija antes de
--      guardar. Nunca se persiste nada solo por escanear (mismo principio
--      que fichas de inscripción/facturas de proveedores) -- no hace falta
--      una bandeja de revisión propia porque la lección completa ya es un
--      único formulario que no persiste nada hasta "Guardar lección".
-- =========================================================================

alter table quiz_questions add column if not exists image_path text;

-- Bucket privado, mismo principio de defensa en profundidad que
-- 'class-updates'/'comunicados-imagenes': el acceso pasa por Server Actions
-- con el cliente service_role (subida) y signed URLs de corta duración
-- (lectura) -- nunca políticas de storage.objects para anon/authenticated.
insert into storage.buckets (id, name, public)
values ('academia-imagenes', 'academia-imagenes', false)
on conflict (id) do nothing;
