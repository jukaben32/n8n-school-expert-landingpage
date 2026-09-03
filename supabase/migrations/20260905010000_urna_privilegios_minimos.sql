-- =========================================================================
-- La urna, cerrada también a nivel de permisos (no solo de RLS)
--
-- Al revisar la migración anterior salió esto: `anon` (cualquier visitante
-- sin sesión) y `authenticated` tenían SELECT/INSERT/UPDATE/DELETE sobre
-- TODAS las tablas de encuestas. No viene de este módulo -- es el
-- `grant all on all tables in schema public to anon, authenticated` que
-- Supabase aplica por defecto al esquema public.
--
-- En la práctica nada de eso era explotable: la RLS está activa en las seis
-- tablas y no existe ninguna policy que le permita a `anon` hacer nada, ni
-- a nadie leer, modificar o borrar un voto. Pero que el secreto del voto
-- dependa ÚNICAMENTE de que no exista una policy es más frágil de lo que
-- merece una votación: si alguien agregara mañana una policy de lectura
-- sobre `poll_ballots` sin darse cuenta, el permiso ya estaría concedido.
--
-- Aquí se recorta cada rol a lo mínimo. Sobre la urna, `authenticated` se
-- queda literalmente sin ningún privilegio: los votos solo entran por
-- cast_student_vote / cast_urna_vote / submit_poll_response, que son
-- SECURITY DEFINER y por tanto no necesitan que el votante tenga permisos.
-- =========================================================================

-- Nadie sin sesión toca nada de las encuestas.
revoke all on polls, poll_positions, poll_candidates, poll_questions,
                poll_voters, poll_ballots from anon;

-- La urna: cero privilegios. Ni leer, ni escribir, ni borrar.
revoke all on poll_ballots from authenticated;

-- El padrón: solo lectura (para saber a quién le falta votar, y para que
-- cada quien vea su propia fila). Lo escriben las funciones de voto.
revoke all on poll_voters from authenticated;
grant select on poll_voters to authenticated;

-- El resto se gestiona desde la aplicación con las policies ya existentes
-- (dirección administra, el profesor carga candidatos de su curso).
revoke all on polls, poll_positions, poll_candidates, poll_questions from authenticated;
grant select, insert, update, delete
    on polls, poll_positions, poll_candidates, poll_questions to authenticated;

-- service_role (las funciones administrativas del servidor) no cambia.
grant all privileges on polls, poll_positions, poll_candidates, poll_questions,
                        poll_voters, poll_ballots to service_role;
