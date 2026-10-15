-- Tarjeta "Excellent" en Programas y servicios del sitio público, aclarando que
-- es para ESTUDIANTES (pedido del colegio, 2026-10-15). Reejecutable: no
-- duplica si ya existe una tarjeta con ese enlace.
insert into website_services (school_id, icon, name, description, duration, link_url, sort_order)
select s.id, 'languages', 'Excellent · Exámenes de inglés (para estudiantes)',
       'Plataforma de Amco donde los estudiantes realizan sus exámenes de inglés. Se entra con el correo de Amco de cada estudiante; los padres reciben ese correo y las instrucciones por correo electrónico.',
       'Solo estudiantes',
       'https://app.eecertification.com/',
       coalesce((select max(sort_order) from website_services w where w.school_id = s.id), 0) + 1
from schools s
where s.name = 'Centro Educativo Gran Manantial de Sabiduría'
  and not exists (select 1 from website_services w where w.school_id = s.id and w.link_url = 'https://app.eecertification.com/');
