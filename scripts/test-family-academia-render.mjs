// Render the actual production Next routes against a local Supabase fixture.
// No production credentials or data are used. Run after `npm run build`.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import next from '../web/node_modules/next/dist/server/next.js'

const child = { id: '11111111-1111-4111-8111-111111111111', school_id: 'school-a', first_name: 'Ana', last_name: 'Pérez', grade_level: '6to', enrollment_status: 'inscrito' }
const sibling = { ...child, id: '22222222-2222-4222-8222-222222222222', first_name: 'Luis', grade_level: '5to' }
const lessons = [
  { id: 'pending-a', school_id: child.school_id, grade_level: child.grade_level, is_published: true, deleted_at: null, title: 'Tarea pendiente de Ana', description: 'Revisar página 36.', video_url: null, subjects: { name: 'Lengua' } },
  { id: 'done-a', school_id: child.school_id, grade_level: child.grade_level, is_published: true, deleted_at: null, title: 'Tarea completada de Ana', description: null, video_url: null, subjects: { name: 'Lengua' } },
  { id: 'sibling-task', school_id: child.school_id, grade_level: sibling.grade_level, is_published: true, deleted_at: null, title: 'Tarea de Luis', description: null, video_url: null, subjects: { name: 'Lengua' } },
  { id: 'draft-task', school_id: child.school_id, grade_level: child.grade_level, is_published: false, deleted_at: null, title: 'BORRADOR PRIVADO', subjects: null },
]
let role = 'guardian'
let progressFailure = false
let blocked = false
const requests = []
const dataWrites = []
const mock = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  requests.push(url.pathname)
  if (url.pathname.startsWith('/rest/v1/') && req.method !== 'GET' && req.method !== 'HEAD' && !url.pathname.includes('/rpc/')) dataWrites.push(url.pathname)
  let body = []
  if (url.pathname === '/auth/v1/user') body = { id: '33333333-3333-4333-8333-333333333333', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: { full_name: 'Tutor de prueba' }, created_at: '2026-01-01T00:00:00Z' }
  const table = url.pathname.split('/').at(-1)
  if (table === 'users_profiles') body = { id: 'profile-a', role, school_id: child.school_id, guardian_id: role === 'student' ? null : 'guardian-a', student_id: role === 'student' ? child.id : null }
  if (table === 'schools' || table === 'schools_public') body = { name: 'Colegio de prueba', whatsapp_active: false }
  if (table === 'guardians') body = { id: 'guardian-a', school_id: child.school_id, family_id: blocked ? 'family-a' : null }
  if (table === 'student_guardians') body = [child, sibling].map(student => ({ student_id: student.id, relationship: 'padre', students: student }))
  if (table === 'students') body = url.searchParams.has('family_id') ? [child] : child
  if (table === 'calculate_receivable_status') body = { aging_bucket: blocked ? '61+' : 'corriente' }
  if (table === 'lessons') body = lessons.filter(lesson => ['school_id', 'grade_level', 'is_published', 'id'].every(key => {
    const filter = url.searchParams.get(key)
    return !filter || filter === `eq.${lesson[key]}`
  }))
  if (table === 'quiz_attempts') {
    if (progressFailure) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'Fixture progress unavailable' })); return }
    body = url.searchParams.get('student_id') === `eq.${child.id}`
      ? [{ lesson_id: 'done-a', score: 8, max_score: 10, completed_at: '2026-10-01T10:00:00Z' }] : []
  }
  if (table === 'quiz_questions') body = [{ id: 'question-a', prompt: '¿Qué aprendiste?', image_path: 'school-a/question.png', quiz_options: [{ id: 'option-a', label: 'Una respuesta', sort_order: 0 }] }]
  if (url.pathname.startsWith('/storage/v1/object/sign/')) body = { signedURL: '/object/sign/academia-imagenes/school-a/question.png?token=fixture' }
  if (table === 'student_points') body = null
  res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' })
  res.end(JSON.stringify(body))
})
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve))
const backend = `http://127.0.0.1:${mock.address().port}`
process.env.NEXT_PUBLIC_SUPABASE_URL = backend
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-admin-key'
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost'
const tokenPart = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const access_token = `${tokenPart({ alg: 'HS256', typ: 'JWT' })}.${tokenPart({ sub: '33333333-3333-4333-8333-333333333333', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.fixture`
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify({ access_token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600 })).toString('base64url')}`
const app = next({ dev: false, dir: fileURLToPath(new URL('../web', import.meta.url)) })
let server
try {
  await app.prepare()
  server = createServer(app.getRequestHandler())
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const site = `http://127.0.0.1:${server.address().port}`
  const get = async (path, signedIn = true) => {
    const response = await fetch(`${site}${path}`, { headers: signedIn ? { Cookie: cookie } : {}, redirect: 'manual' })
    return { response, html: await response.text() }
  }
  const home = await get('/dashboard/portal-familiar')
  assert.ok(home.html.includes('summary-badge-academia'))
  assert.ok(home.html.includes(`student-card-${child.id}`))
  assert.ok(home.html.includes(`/dashboard/portal-familiar/hijos/${child.id}`))
  assert.ok(!home.html.includes(`/dashboard/estudiantes/${child.id}`))
  console.log('PASS: portal home exposes Academia and child card points to the family route')
  const index = await get('/dashboard/portal-familiar/academia')
  assert.equal(index.response.status, 200)
  assert.ok(index.html.includes(`/dashboard/portal-familiar/hijos/${child.id}`))
  assert.ok(index.html.includes(`/dashboard/portal-familiar/hijos/${sibling.id}`))
  console.log('PASS: family Academia lists both linked children')
  const detail = await get(`/dashboard/portal-familiar/hijos/${child.id}`)
  assert.ok(detail.html.includes('Tareas pendientes'))
  assert.ok(detail.html.includes('Tareas completadas'))
  assert.ok(detail.html.includes('8/10'))
  assert.ok(!detail.html.includes('Tarea de Luis'))
  assert.ok(!detail.html.includes('BORRADOR PRIVADO'))
  console.log('PASS: child detail separates pending/completed, excludes sibling course and drafts')
  const task = await get(`/dashboard/portal-familiar/hijos/${child.id}/lecciones/pending-a`)
  assert.ok(task.html.includes('¿Qué aprendiste?'))
  assert.ok(task.html.includes('Una respuesta'))
  assert.ok(!task.html.includes('is_correct'))
  assert.ok(task.html.includes('question.png?token=fixture'))
  console.log('PASS: parent can read questions and signed images without correct-answer flags')
  const before = requests.filter(path => path.endsWith('/lessons')).length
  const forbidden = await get('/dashboard/portal-familiar/hijos/foreign-child')
  assert.ok(forbidden.response.status === 404 || forbidden.html.includes('NEXT_HTTP_ERROR_FALLBACK;404'))
  assert.equal(requests.filter(path => path.endsWith('/lessons')).length, before)
  const wrongTask = await get(`/dashboard/portal-familiar/hijos/${child.id}/lecciones/sibling-task`)
  assert.ok(wrongTask.response.status === 404 || wrongTask.html.includes('NEXT_HTTP_ERROR_FALLBACK;404'))
  console.log('PASS: foreign child and wrong-course lesson are rejected')
  progressFailure = true
  const failed = await get(`/dashboard/portal-familiar/hijos/${child.id}`)
  assert.ok(failed.html.includes('No se pudo cargar el progreso'))
  assert.ok(!failed.html.includes('Tareas pendientes'))
  progressFailure = false
  console.log('PASS: progress error does not falsely mark tasks pending')
  role = 'teacher'
  const dual = await get(`/dashboard/portal-familiar/hijos/${child.id}`)
  assert.ok(dual.html.includes('Tareas pendientes'))
  console.log('PASS: staff with guardian link can consult own child')
  const teacherAcademia = await get('/dashboard/academia')
  assert.ok(
    (teacherAcademia.response.status === 307 && teacherAcademia.response.headers.get('location')?.includes('/dashboard/academia/progreso')) ||
    teacherAcademia.html.includes('NEXT_REDIRECT;replace;/dashboard/academia/progreso;307;'),
  )
  console.log('PASS: existing teacher Academia still redirects to management')
  role = 'student'
  const studentAcademia = await get('/dashboard/academia')
  assert.equal(studentAcademia.response.status, 200)
  assert.ok(studentAcademia.html.includes('Hola, Ana'))
  assert.ok(studentAcademia.html.includes('/dashboard/academia/pending-a'))
  console.log('PASS: existing student Academia still renders their lessons')
  role = 'guardian'
  blocked = true
  const overdue = await get(`/dashboard/portal-familiar/hijos/${child.id}`)
  assert.equal(overdue.response.status, 307)
  assert.ok(overdue.response.headers.get('location').includes('/dashboard/pagos'))
  blocked = false
  console.log('PASS: existing overdue-payment restriction is preserved')
  const guest = await get('/dashboard/portal-familiar/academia', false)
  assert.equal(guest.response.status, 307)
  assert.ok(guest.response.headers.get('location').includes('/login'))
  console.log('PASS: anonymous request redirects to login')
  assert.ok(requests.every(path => !path.includes('/auth/v1/token')))
  assert.deepEqual(dataWrites, [])
  console.log('PASS: family consultation performs no data writes')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  mock.closeAllConnections()
  await new Promise(resolve => mock.close(resolve))
  await app.close()
}
