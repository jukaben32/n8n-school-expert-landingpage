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
    ['Academia familiar: vínculos y curso de sus hijos', `select s.id, s.school_id, s.grade_level from student_guardians sg join students s on s.id = sg.student_id join users_profiles up on up.guardian_id = sg.guardian_id where up.auth_id = auth.uid() and s.school_id = up.school_id and s.deleted_at is null;`],
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
 * Revisar una justificación de ausencia es una escritursistema SIN rol.
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
