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
  ],
  guardian: [
    ['Portal: sus hijos', `select count(*) from students where deleted_at is null;`],
    ['Portal: asistencia de sus hijos', `select count(*) from attendance;`],
    ['Portal: fotos del día', `select count(*) from class_updates where deleted_at is null;`],
    ['Portal: sus conversaciones', `select count(*) from direct_conversations;`],
    ['Portal: sus facturas', `select count(*) from invoices;`],
    ['Portal: comunicados', `select count(*) from messages;`],
  ],
  reception: [
    ['Familias', `select count(*) from families where deleted_at is null;`],
    ['Estudiantes', `select count(*) from students where deleted_at is null;`],
    ['Asistencia', `select count(*) from attendance;`],
    ['Mensajes', `select count(*) from direct_conversations where category = 'regular';`],
    ['Facturas', `select count(*) from invoices;`],
  ],
  director: [
    ['Familias', `select count(*) from families where deleted_at is null;`],
    ['Estudiantes', `select count(*) from students where deleted_at is null;`],
    ['Asistencia', `select count(*) from attendance;`],
    ['Mensajes (todas las categorías)', `select count(*) from direct_conversations;`],
    ['Facturas', `select count(*) from invoices;`],
    ['Personal', `select count(*) from staff;`],
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
 * El insert de asistencia es el caso especial: es la escritura que el
 * navegador hace directo contra Supabase (AttendanceForm), la que se rompió
 * el 2026-09-03 sin que apareciera en ningún log. Se prueba de verdad, con
 * un alumno que ese profesor sí tenga a su alcance, y se revierte.
 */
function insertAttendanceSql() {
  return `
    insert into attendance (school_id, student_id, recorded_by, date, subject_id, status)
    select up.school_id, s.id, up.id, current_date, null, 'presente'
    from users_profiles up
    join students s on s.school_id = up.school_id and s.deleted_at is null
    where up.auth_id = auth.uid()
    limit 1;
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
      const body = consulta === 'INSERT_ATTENDANCE' ? insertAttendanceSql() : consulta
      const r = await asUser(user.auth_id, body)
      if (r.ok) {
        console.log(`  OK    ${nombre}`)
      } else {
        fallos++
        console.log(`  FALLA ${nombre}\n        → ${r.error}`)
      }
    }
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
