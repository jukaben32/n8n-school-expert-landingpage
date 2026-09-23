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
    ['Políticas: ver las de su colegio', `select count(*) from staff_policies;`],
    ['Políticas: FIRMAR la suya (insert)', 'POLITICA_FIRMAR_PROPIA'],
    ['Políticas: NO puede firmar por otro empleado', 'POLITICA_NO_FIRMAR_AJENA'],
    ['Incidencias: ver las de sus cursos', `select count(*) from student_incidents;`],
    ['Incidencias: REGISTRAR en su curso (insert)', 'INCIDENCIA_REGISTRAR'],
  ],
  guardian: [
    ['Portal: sus hijos', `select count(*) from students where deleted_at is null;`],
    ['Portal: asistencia de sus hijos', `select count(*) from attendance;`],
    ['Portal: fotos del día', `select count(*) from class_updates where deleted_at is null;`],
    ['Portal: sus conversaciones', `select count(*) from direct_conversations;`],
    ['Portal: sus facturas', `select count(*) from invoices;`],
    ['Portal: comunicados', `select count(*) from messages;`],
    ['Portal: justificaciones de ausencia de sus hijos', `select count(*) from attendance_justifications;`],
    ['Horario: solo el curso de sus hijos', 'GUARDIAN_HORARIO_SOLO_SUS_HIJOS'],
    ['Políticas internas: NO las ve (son solo del personal)', 'POLITICAS_INVISIBLES'],
    ['Incidencias: NO las ve (expediente interno)', 'INCIDENCIAS_INVISIBLES'],
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
    ['Políticas: ver firmas de todo el personal', `select count(*) from staff_policy_signatures;`],
    ['Incidencias: ver todos los casos', `select count(*) from student_incidents;`],
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
    ['Horario: solo el de su propio curso', 'STUDENT_HORARIO_SOLO_SU_CURSO'],
    ['Políticas internas: NO las ve (son solo del personal)', 'POLITICAS_INVISIBLES'],
    ['Incidencias: NO las ve (expediente interno)', 'INCIDENCIAS_INVISIBLES'],
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

/**
 * 2026-09-18 (Horario para familias/estudiantes): comprobación negativa de
 * aislamiento, mismo espíritu que `academiaNoCrearEnAjenoSql` -- no depende
 * de que exista una fila concreta (si `class_schedules` está vacío para este
 * tutor, `bool_and` da NULL y no revienta), pero si CUALQUIER fila visible
 * pertenece a un curso que no es el de ninguno de sus hijos, es un hueco de
 * seguridad real y se relanza como excepción.
 */
function guardianHorarioSoloSusHijosSql() {
  return `
    do $$
    declare v_ok boolean;
    begin
      select bool_and(cs.grade_level in (
        select s.grade_level from students s
        join student_guardians sg on sg.student_id = s.id
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
      )) into v_ok
      from class_schedules cs;
      if v_ok is false then
        raise exception 'RIESGO: el tutor ve el horario de un curso que no es de ninguno de sus hijos';
      end if;
    end $$;
  `
}

/** Mismo principio que la de arriba, para el estudiante y su propio curso. */
function studentHorarioSoloSuCursoSql() {
  return `
    do $$
    declare v_ok boolean;
    begin
      select bool_and(cs.grade_level = (select grade_level from students where id = current_student_id()))
      into v_ok
      from class_schedules cs;
      if v_ok is false then
        raise exception 'RIESGO: el estudiante ve el horario de un curso que no es el suyo';
      end if;
    end $$;
  `
}

/**
 * Políticas internas (2026-09-23): el empleado firma SU propia política
 * vigente (misma escritura que signStaffPolicyAction, con el cliente de
 * sesión). Si no hay ninguna vigente, o ya la firmó, se omite sin fallar.
 */
function politicaFirmarPropiaSql() {
  return `
    do $$
    declare v_prof record; v_pol record;
    begin
      select id, school_id, staff_id into v_prof from users_profiles where auth_id = auth.uid();
      if v_prof.staff_id is null then return; end if;
      select id, title, body into v_pol from staff_policies
      where school_id = v_prof.school_id and is_active
        and id not in (select policy_id from staff_policy_signatures where staff_id = v_prof.staff_id)
      limit 1;
      if v_pol.id is null then return; end if;
      insert into staff_policy_signatures (policy_id, school_id, staff_id, profile_id, signer_full_name,
        signer_national_id, signer_position, policy_title_snapshot, policy_body_snapshot)
      values (v_pol.id, v_prof.school_id, v_prof.staff_id, v_prof.id, 'SMOKE', '000-0000000-0', 'SMOKE', v_pol.title, v_pol.body);
    end $$;
  `
}

/** Prueba negativa: firmar con la ficha de OTRO empleado tiene que fallar. */
function politicaNoFirmarAjenaSql() {
  return `
    do $$
    declare v_prof record; v_pol uuid; v_otro uuid;
    begin
      select id, school_id, staff_id into v_prof from users_profiles where auth_id = auth.uid();
      select id into v_pol from staff_policies where school_id = v_prof.school_id and is_active limit 1;
      if v_pol is null then return; end if;
      -- security definer no hace falta: staff se lee con esta sesión o no;
      -- si no se ve ningún otro empleado, no hay nada que probar.
      select id into v_otro from staff where school_id = v_prof.school_id and id <> coalesce(v_prof.staff_id, gen_random_uuid()) limit 1;
      if v_otro is null then return; end if;
      begin
        insert into staff_policy_signatures (policy_id, school_id, staff_id, profile_id, signer_full_name,
          signer_national_id, signer_position, policy_title_snapshot, policy_body_snapshot)
        values (v_pol, v_prof.school_id, v_otro, v_prof.id, 'SMOKE', '0', 'SMOKE', 'x', 'x');
      exception when insufficient_privilege then
        return; -- bloqueado por RLS: es lo esperado
      end;
      raise exception 'HUECO: pudo firmar la política en nombre de otro empleado';
    end $$;
  `
}

/** Tutores y estudiantes no deben ver ni una política interna del personal. */
function politicasInvisiblesSql() {
  return `
    do $$
    begin
      if (select count(*) from staff_policies) > 0 or (select count(*) from staff_policy_signatures) > 0 then
        raise exception 'HUECO: un rol que no es personal puede leer políticas internas';
      end if;
    end $$;
  `
}

/**
 * Incidencias (2026-09-23): el docente registra una incidencia de un
 * estudiante de SU curso, igual que createIncidentAction (cliente de sesión).
 * Si no tiene ningún estudiante a su alcance, se omite sin fallar.
 */
function incidenciaRegistrarSql() {
  return `
    do $$
    declare v_prof record; v_st record;
    begin
      select id, school_id into v_prof from users_profiles where auth_id = auth.uid();
      select s.id, s.grade_level into v_st from students s
      where s.school_id = v_prof.school_id and s.deleted_at is null and s.grade_level is not null
        and teacher_is_assigned_to_grade(v_prof.school_id, s.grade_level, 'regular')
      limit 1;
      if v_st.id is null then return; end if;
      insert into student_incidents (school_id, student_id, grade_level, incident_date, location, severity,
        description, reported_by, reporter_name)
      values (v_prof.school_id, v_st.id, v_st.grade_level, current_date, 'aula', 'leve', 'SMOKE', v_prof.id, 'SMOKE');
    end $$;
  `
}

/** Tutores y estudiantes no ven ninguna incidencia. */
function incidenciasInvisiblesSql() {
  return `
    do $$
    begin
      if (select count(*) from student_incidents) > 0 then
        raise exception 'HUECO: un rol que no es personal puede leer incidencias';
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
        : consulta === 'GUARDIAN_HORARIO_SOLO_SUS_HIJOS' ? guardianHorarioSoloSusHijosSql()
        : consulta === 'STUDENT_HORARIO_SOLO_SU_CURSO' ? studentHorarioSoloSuCursoSql()
        : consulta === 'POLITICA_FIRMAR_PROPIA' ? politicaFirmarPropiaSql()
        : consulta === 'POLITICA_NO_FIRMAR_AJENA' ? politicaNoFirmarAjenaSql()
        : consulta === 'POLITICAS_INVISIBLES' ? politicasInvisiblesSql()
        : consulta === 'INCIDENCIA_REGISTRAR' ? incidenciaRegistrarSql()
        : consulta === 'INCIDENCIAS_INVISIBLES' ? incidenciasInvisiblesSql()
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

  // Psicóloga (2026-09-23): entra con rol 'teacher', pero por su PUESTO en
  // Personal (staff.role = 'psychologist') registra el seguimiento de las
  // incidencias junto con Dirección. Se prueba de verdad: registra un caso de
  // prueba y le escribe el seguimiento, todo revertido. Si el colegio no
  // tiene a nadie con ese puesto y acceso, se omite sin fallar.
  const psico = await sql(`
    select up.auth_id, st.first_name || ' ' || st.last_name as quien
    from users_profiles up
    join staff st on st.id = up.staff_id
    join auth.users au on au.id = up.auth_id
    where st.role = 'psychologist' and st.deleted_at is null
    order by au.last_sign_in_at desc nulls last
    limit 1;
  `)
  console.log(`\nPSICÓLOGA (puesto)${psico.ok && psico.rows[0] ? ` — ${psico.rows[0].quien}` : ''}`)
  if (!psico.ok) {
    total++
    fallos++
    console.log(`  FALLA No se pudo buscar\n        → ${psico.error}`)
  } else if (!psico.rows[0]) {
    console.log('  (omitido: nadie tiene el puesto Psicóloga con acceso al sistema)')
  } else {
    total++
    const r = await asUser(psico.rows[0].auth_id, `
      do $$
      declare v_prof record; v_st record; v_id uuid; v_n int;
      begin
        select id, school_id into v_prof from users_profiles where auth_id = auth.uid();
        if not incident_is_counselor(v_prof.school_id) then
          raise exception 'incident_is_counselor devolvió false para la psicóloga';
        end if;
        select s.id, s.grade_level into v_st from students s
        where s.school_id = v_prof.school_id and s.deleted_at is null and s.grade_level is not null
        limit 1;
        -- Caso creado por otra vía (como si lo hubiera reportado un maestro).
        insert into student_incidents (school_id, student_id, grade_level, incident_date, location, severity,
          description, reported_by, reporter_name)
        values (v_prof.school_id, v_st.id, v_st.grade_level, current_date, 'aula', 'leve', 'SMOKE', v_prof.id, 'SMOKE')
        returning id into v_id;
        update student_incidents set status = 'en_seguimiento', follow_up_notes = 'SMOKE',
          reviewed_by = v_prof.id, reviewed_at = now()
        where id = v_id;
        get diagnostics v_n = row_count;
        if v_n <> 1 then raise exception 'la psicóloga no pudo registrar el seguimiento'; end if;
      end $$;
    `)
    if (r.ok) console.log('  OK    Incidencias: registrar seguimiento')
    else {
      fallos++
      console.log(`  FALLA Incidencias: registrar seguimiento\n        → ${r.error}`)
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
