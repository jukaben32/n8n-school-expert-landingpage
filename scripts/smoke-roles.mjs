#!/usr/bin/env node
/**
 * Prueba de humo por rol contra PRODUCCIÓN.
 *
 * Por qué existe: el colegio reportaba, casi a diario, que algo "ya no
 * funciona" -- y casi siempre era lo mismo: un cambio rompía en silencio la
 * lectura o escritura de OTRO rol. Ejemplos reales:
 *
 *   - 2026-09-03: una sobrecarga nueva de teacher_is_assigned_to_grade()
 *     dejó ambigua la llamada de 2 argumentos que usaba la policy de
 *     `attendance`. Ningún profesor pudo pasar lista en todo el día. No
 *     salía en los logs de Vercel: la escritura la hace el navegador contra
 *     Supabase directo.
 *   - 2026-09-03: Mensajes leía `families` con el cliente del usuario, y esa
 *     tabla está cerrada para 'teacher' -- al profesor le llegaban 0
 *     familias y el selector salía vacío, sin ningún error visible.
 *
 * Los dos se detectan en segundos con esto. La idea es simple: entrar como
 * un usuario REAL de cada rol (simulando su sesión igual que lo hace
 * PostgREST) y ejecutar las mismas consultas que hacen las pantallas. Si una
 * policy quedó rota, aquí revienta -- no en el colegio a las 7:50am.
 *
 * Es seguro: todo corre dentro de una transacción con ROLLBACK, así que ni
 * las escrituras de prueba tocan datos reales.
 *
 * Uso:
 *   node scripts/smoke-roles.mjs
 *
 * Requiere `SUPABASE_ACCESS_TOKEN` en el entorno (token de la cuenta de
 * Supabase). El id del proyecto se puede pasar con SUPABASE_PROJECT_REF.
 */

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const PROJECT = process.env.SUPABASE_PROJECT_REF || 'fssjgpqisfnmnkavsyld'

if (!TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN en el entorno.')
  process.exit(1)
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (res.status !== 201) {
    let message = text
    try { message = JSON.parse(text).message ?? text } catch {}
    return { ok: false, error: String(message).replace(/\s+/g, ' ').slice(0, 200) }
  }
  return { ok: true, rows: JSON.parse(text) }
}

/** Corre una consulta COMO ese usuario (misma simulación que hace PostgREST). */
async function asUser(authId, body) {
  return sql(`
    begin;
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${authId}","role":"authenticated"}';
    ${body}
    rollback;
  `)
}

/**
 * Qué comprueba cada rol -- son las consultas que de verdad hacen las
 * pantallas. Al agregar una pantalla o cambiar una policy, agrega su lectura
 * (y su escritura, si el navegador escribe directo) aquí.
 */
const CHECKS = {
  teacher: [
    ['Asistencia: ver registros', `select count(*) from attendance;`],
    ['Asistencia: PASAR LISTA (insert)', 'INSERT_ATTENDANCE'],
    ['Estudiantes de sus grados', `select count(*) from students where deleted_at is null;`],
    ['Actualizaciones: ver fotos', `select count(*) from class_updates where deleted_at is null;`],
    ['Mensajes: ver conversaciones', `select count(*) from direct_conversations where category = 'regular';`],
    ['Mensajes: leer mensajes', `select count(*) from direct_messages;`],
    ['Comunicados', `select count(*) from messages;`],
    ['Agenda', `select count(*) from calendar_events;`],
    ['Notas', `select count(*) from grades;`],
    ['Justificaciones: ver las de sus grados', `select count(*) from attendance_justifications;`],
    ['Justificaciones: REVISAR (update)', 'REVIEW_JUSTIFICATION'],
    ['Academia: crear lección en SU curso asignado', 'ACADEMIA_CREAR_EN_CURSO'],
    ['Academia: NO puede crear en curso ajeno', 'ACADEMIA_NO_CREAR_EN_AJENO'],
  ],
  guardian: [
    ['Portal: sus hijos', `select count(*) from students where deleted_at is null;`],
    ['Portal: asistencia de sus hijos', `select count(*) from attendance;`],
    ['Portal: fotos del día', `select count(*) from class_updates where deleted_at is null;`],
    ['Portal: sus conversaciones', `select count(*) from direct_conversations;`],
    ['Portal: sus facturas', `select count(*) from invoices;`],
    ['Portal: comunicados', `select count(*) from messages;`],
    ['Portal: justificaciones de ausencia de sus hijos', `select count(*) from attendance_justifications;`],
  ],
  reception: [
    ['Familias', `select count(*) from families where deleted_at is null;`],
    ['Estudiantes', `select count(*) from students where deleted_at is null;`],
    ['Asistencia', `select count(*) from attendance;`],
    ['Mensajes', `select count(*) from direct_conversations where category = 'regular';`],
    ['Facturas', `select count(*) from invoices;`],
    ['Justificaciones de ausencia', `select count(*) from attendance_justifications;`],
    ['Justificaciones: REVISAR (update)', 'REVIEW_JUSTIFICATION'],
  ],
  director: [
    ['Familias', `select count(*) from families where deleted_at is null;`],
    ['Estudiantes', `select count(*) from students where deleted_at is null;`],
    ['Asistencia', `select count(*) from attendance;`],
    ['Mensajes (todas las categorías)', `select count(*) from direct_conversations;`],
    ['Facturas', `select count(*) from invoices;`],
    ['Personal', `select count(*) from staff;`],
    ['Justificaciones de ausencia', `select count(*) from attendance_justifications;`],
    ['Buscador: personal por nombre completo', 'BUSCADOR_PERSONAL'],
    ['Buscador: tutores por nombre completo', 'BUSCADOR_TUTORES'],
  ],
  school_admin: [
    ['Familias', `select count(*) from families where deleted_at is null;`],
    ['Asistencia', `select count(*) from attendance;`],
    ['Facturas', `select count(*) from invoices;`],
  ],
  finance: [
    ['Facturas', `select count(*) from invoices;`],
    ['Familias', `select count(*) from families where deleted_at is null;`],
  ],
  student: [
    ['Academia: sus lecciones', `select count(*) from lessons;`],
    ['Encuestas: las de su curso', `select count(*) from polls;`],
  ],
}

/**
 * El guardado de asistencia es el caso especial: es la escritura que el
 * navegador hace directo contra Supabase (AttendanceForm), la que se rompió
 * el 2026-09-03 sin que apareciera en ningún log. Se prueba de verdad, con
 * un alumno que ese profesor sí tenga a su alcance, y se revierte.
 *
 * IMPORTANTE: tiene que replicar el `upsert` EXACTO del formulario, con su
 * ON CONFLICT y con subject_id null ("Todas (General)", la opción por
 * defecto). Antes esto era un insert simple, y por eso no detectó el fallo
 * del 2026-09-04: el ON CONFLICT apuntaba a un índice parcial inalcanzable
 * y toda lista guardada como "General" moría con "Error al guardar", pero
 * un insert pelado pasaba sin problema. Si cambias AttendanceForm, cambia
 * esto igual.
 */
function insertAttendanceSql() {
  return `
    insert into attendance (school_id, student_id, recorded_by, date, subject_id, status)
    select up.school_id, s.id, up.id, current_date, null, 'presente'
    from users_profiles up
    join students s on s.school_id = up.school_id and s.deleted_at is null
    where up.auth_id = auth.uid()
    limit 1
    on conflict (student_id, date, subject_id) do update set status = excluded.status;
  `
}

/**
 * Revisar una justificación de ausencia es una escritura que hace el
 * personal con SU PROPIA sesión (no con service_role, a diferencia de las
 * otras bandejas de revisión del proyecto), así que depende directamente de
 * la policy attendance_justifications_staff_update.
 *
 * No hace falta que existan filas para que sirva: si la policy quedara con
 * una llamada ambigua a teacher_is_assigned_to_grade (el fallo que dejó al
 * colegio un día sin pasar lista), Postgres revienta al PLANIFICAR la
 * consulta, aunque no toque ninguna fila.
 */
function reviewJustificationSql() {
  return `
    update attendance_justifications
    set review_note = review_note
    where status = 'pendiente';
  `
}

/**
 * El buscador global (globalSearchAction) exige cada palabra de lo que se
 * teclea contra nombre O apellido, por separado. Antes mandaba la frase
 * entera contra cada columna, así que buscar por NOMBRE COMPLETO -- que es
 * como escribe cualquiera -- nunca encontraba nada (reportado por el
 * colegio el 2026-09-15).
 *
 * No se fija en ninguna persona concreta: toma una fila real de la tabla,
 * arma la búsqueda con su nombre y su apellido, y exige que se encuentre a
 * sí misma. Si alguien vuelve a mandar la frase entera contra una sola
 * columna, esto falla.
 */
function buscadorPorNombreCompletoSql(tabla) {
  return `
    do $$
    declare v record; n int; nom text; ape text;
    begin
      select first_name, last_name into v from ${tabla}
       where deleted_at is null and first_name <> '' and last_name <> '' limit 1;
      if not found then return; end if;
      nom := split_part(btrim(v.first_name), ' ', 1);
      ape := split_part(btrim(v.last_name), ' ', 1);
      select count(*) into n from ${tabla}
       where deleted_at is null
         and (first_name ilike '%' || nom || '%' or last_name ilike '%' || nom || '%')
         and (first_name ilike '%' || ape || '%' or last_name ilike '%' || ape || '%');
      if n = 0 then
        raise exception 'El buscador no encuentra a "% %" en ${tabla} por nombre completo', nom, ape;
      end if;
    end $$;
  `
}

/**
 * 2026-09-18: Academia (lessons/quiz_questions/quiz_options) pasó de una
 * sola policy ALL sin restricción a acotar la ESCRITURA por asignación
 * docente -- mismo patrón que Asistencia/Notas/Horarios
 * (teacher_is_assigned_to_grade con 3 argumentos, categoría 'regular').
 * Antes cualquier profesor podía crear/editar lecciones de cualquier curso.
 *
 * Prueba positiva: el profesor SÍ puede crear en un curso que de verdad
 * tiene asignado (busca su propia asignación real, no asume ninguna).
 */
function academiaCrearEnCursoSql() {
  return `
    do $$
    declare v_school uuid; v_grade text; v_subject uuid; v_id uuid;
    begin
      select school_id into v_school from users_profiles where auth_id = auth.uid();
      -- OJO: no leer teacher_assignments con el cliente del profesor -- su
      -- RLS no se lo permite (devuelve vacío, no error, mismo patrón que ya
      -- costó un día con Mensajes/families). Usar la función oficial
      -- security definer, igual que la policy real.
      select distinct s.grade_level into v_grade from students s
      where s.school_id = v_school and s.deleted_at is null and s.grade_level is not null
        and teacher_is_assigned_to_grade(v_school, s.grade_level, 'regular')
      limit 1;
      if v_grade is null then
        return; -- este profesor no tiene ningún curso asignado con estudiantes reales, se omite
      end if;
      select id into v_subject from subjects where school_id = v_school limit 1;
      insert into lessons (school_id, subject_id, title, video_url, video_provider, grade_level, is_published)
      values (v_school, v_subject, 'SMOKE-academia-curso-propio', 'https://youtube.com/watch?v=smoke', 'youtube', v_grade, false)
      returning id into v_id;
      if v_id is null then
        raise exception 'No se pudo crear la lección de prueba en el curso asignado (%)', v_grade;
      end if;
    end $$;
  `
}

/**
 * Prueba negativa: el profesor NO puede crear en un curso real del colegio
 * que no tiene asignado. Si el insert tiene éxito, es un hueco de
 * seguridad real -- se relanza como excepción para que el script lo marque
 * FALLA (no "OK" invertido: un insert exitoso aquí es el fallo).
 */
function academiaNoCrearEnAjenoSql() {
  return `
    do $$
    declare v_school uuid; v_grade text; v_subject uuid; v_inserted boolean := false;
    begin
      select school_id into v_school from users_profiles where auth_id = auth.uid();
      -- misma razón que en academiaCrearEnCursoSql: usar la función oficial,
      -- no un JOIN a teacher_assignments con el cliente del profesor.
      select distinct s.grade_level into v_grade from students s
      where s.school_id = v_school and s.deleted_at is null and s.grade_level is not null
        and not teacher_is_assigned_to_grade(v_school, s.grade_level, 'regular')
      limit 1;
      if v_grade is null then
        return; -- no hay ningún curso "ajeno" disponible para este profesor, se omite
      end if;
      select id into v_subject from subjects where school_id = v_school limit 1;
      begin
        insert into lessons (school_id, subject_id, title, video_url, video_provider, grade_level, is_published)
        values (v_school, v_subject, 'SMOKE-academia-curso-ajeno', 'https://youtube.com/watch?v=smoke2', 'youtube', v_grade, false);
        v_inserted := true;
      exception when insufficient_privilege then
        v_inserted := false;
      end;
      if v_inserted then
        raise exception 'RIESGO: el profesor pudo crear una lección en un curso que NO tiene asignado (%)', v_grade;
      end if;
    end $$;
  `
}

async function main() {
  console.log(`\nPrueba de humo por rol — proyecto ${PROJECT}\n${'='.repeat(60)}`)

  const users = await sql(`
    select distinct on (up.role) up.role, up.auth_id, coalesce(st.first_name || ' ' || st.last_name, au.email) as quien
    from users_profiles up
    join auth.users au on au.id = up.auth_id
    left join staff st on st.id = up.staff_id
    where up.auth_id is not null
    order by up.role, au.last_sign_in_at desc nulls last;
  `)
  if (!users.ok) {
    console.error('No se pudo listar usuarios:', users.error)
    process.exit(1)
  }

  const byRole = new Map(users.rows.map((r) => [r.role, r]))
  let fallos = 0
  let total = 0

  for (const [role, checks] of Object.entries(CHECKS)) {
    const user = byRole.get(role)
    console.log(`\n${role.toUpperCase()}${user ? ` — ${user.quien}` : ''}`)
    if (!user) {
      console.log('  (omitido: no hay ningún usuario con este rol todavía)')
      continue
    }

    for (const [nombre, consulta] of checks) {
      total++
      const body =
        consulta === 'INSERT_ATTENDANCE' ? insertAttendanceSql()
        : consulta === 'REVIEW_JUSTIFICATION' ? reviewJustificationSql()
        : consulta === 'BUSCADOR_PERSONAL' ? buscadorPorNombreCompletoSql('staff')
        : consulta === 'BUSCADOR_TUTORES' ? buscadorPorNombreCompletoSql('guardians')
        : consulta === 'ACADEMIA_CREAR_EN_CURSO' ? academiaCrearEnCursoSql()
        : consulta === 'ACADEMIA_NO_CREAR_EN_AJENO' ? academiaNoCrearEnAjenoSql()
        : consulta
      const r = await asUser(user.auth_id, body)
      if (r.ok) {
        console.log(`  OK    ${nombre}`)
      } else {
        fallos++
        console.log(`  FALLA ${nombre}\n        → ${r.error}`)
      }
    }
  }

  // Comprobación global, no por rol: una cuenta de Auth que ya inició
  // sesión pero no tiene fila en `users_profiles` entra al sistema SIN rol.
  // Hasta el 2026-09-15 eso la mandaba en silencio al Portal Familiar como
  // si fuera tutora (le pasó a dos docentes). Ahora ve una pantalla que lo
  // explica -- pero sigue sin poder trabajar, así que esto tiene que
  // saltar para que el colegio la vincule.
  console.log('\nCUENTAS SIN VINCULAR (global)')
  total++
  const huerfanas = await sql(`
    select coalesce(string_agg(u.email, ', '), '') as correos
    from auth.users u
    left join users_profiles p on p.auth_id = u.id
    where p.id is null and u.last_sign_in_at is not null;
  `)
  if (!huerfanas.ok) {
    fallos++
    console.log(`  FALLA No se pudo comprobar\n        → ${huerfanas.error}`)
  } else if (huerfanas.rows[0]?.correos) {
    fallos++
    console.log(`  FALLA Hay cuentas que ya entraron sin perfil vinculado\n        → ${huerfanas.rows[0].correos}`)
  } else {
    console.log('  OK    Ninguna cuenta usada se quedó sin perfil')
  }

  console.log(`\n${'='.repeat(60)}`)
  if (fallos === 0) {
    console.log(`${total} comprobaciones, todas OK.\n`)
  } else {
    console.log(`${fallos} de ${total} comprobaciones FALLARON. No despliegues sin resolverlas.\n`)
    process.exit(1)
  }
}

main().catch((e) => { console.error('Error inesperado:', e); process.exit(1) })
