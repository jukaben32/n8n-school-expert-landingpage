-- =========================================================================
-- Cuestionarios de Academia: las OPCIONES de respuesta pueden ser imágenes.
--
-- POR QUÉ (no es cosmético): en 1ro de Primaria el estudiante todavía no
-- lee -- aprender a leer es justamente lo que hace durante el año. Hoy
-- `LessonPlayer.tsx` pinta cada opción como `opt.label`, texto y nada más,
-- así que un niño de 6 años no puede contestar ningún cuestionario sin que
-- un adulto se lo lea. La pregunta sí acepta imagen desde la migración
-- 20260826010000 (`quiz_questions.image_path`); las opciones nunca la
-- tuvieron.
--
-- QUÉ SE TOCA Y QUÉ NO (protocolo de menor radio de impacto):
--   * Se AGREGA una columna nullable. Nada más.
--   * NO se tocan las policies de `quiz_options` -- quién ve una opción no
--     cambia, sigue decidiéndolo `quiz_options_student_read` /
--     `quiz_options_staff_manage` a través de su lección.
--   * NO se crea un bucket nuevo: la imagen vive en `academia-imagenes`,
--     el mismo privado que ya usan las imágenes de pregunta (migración
--     20260826010000), leído siempre por signed URL de corta duración
--     desde el servidor. Sin políticas de `storage.objects`, igual que
--     `comprobantes-pago` y `fichas-inscripcion`.
--   * Las lecciones de 6to que ya están en producción no cambian en nada:
--     con `image_path` nulo, la opción se sigue pintando como texto.
--
-- Idempotente: se puede volver a aplicar sin efecto.
-- =========================================================================

alter table quiz_options add column if not exists image_path text;

comment on column quiz_options.image_path is
    'Ruta en el bucket privado academia-imagenes. Cuando está presente, la opción se muestra como dibujo (necesario en 1ro, que todavía no lee); `label` sigue siendo obligatorio y se usa como texto alternativo, para el lector de pantalla y como respaldo si la imagen no carga.';
