-- =========================================================================
-- Academia — el video deja de ser obligatorio al crear una lección/tarea
--
-- POR QUÉ: los profesores se quejaron de que no pueden dejar una tarea
-- manual (instrucciones + cuestionario) sin tener que inventar o pegar un
-- link de video que no viene al caso. `lessons.video_url` era `not null`,
-- así que hoy es imposible guardar una lección sin video aunque el
-- formulario lo permitiera.
--
-- QUÉ SE TOCA: se relaja `video_url`/`video_provider` a nullable. El
-- cuestionario sigue siendo obligatorio (ya lo era en NewLessonForm, con al
-- menos 1 pregunta) -- es lo que le da a la lección un final (pantalla de
-- resultado / puntos), así que una tarea sin video sigue siendo completable.
-- =========================================================================

alter table lessons alter column video_url drop not null;
alter table lessons alter column video_provider drop not null;

-- Evita el estado a medias (video_url con dato pero sin proveedor, o
-- viceversa), que dejaría a LessonPlayer sin poder armar el embed.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'lessons'::regclass and conname = 'lessons_video_consistente_check'
    ) then
        alter table lessons add constraint lessons_video_consistente_check
            check ((video_url is null) = (video_provider is null));
    end if;
end $$;
