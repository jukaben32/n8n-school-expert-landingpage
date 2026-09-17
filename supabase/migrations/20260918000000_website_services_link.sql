-- Permite que una tarjeta de "Programas y servicios" del sitio público sea
-- clicable (ej. acceso directo a una plataforma externa como Amco, o al
-- Portal Familiar) -- pedido real del colegio piloto para su campaña de
-- Admisiones 2026-2027. Columna opcional: una tarjeta sin link_url se
-- comporta exactamente igual que antes.
alter table website_services add column if not exists link_url text;
