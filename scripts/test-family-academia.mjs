import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from '../web/node_modules/typescript/lib/typescript.js'

// Use the project's compiler so the tests also work on Node versions
// without native TypeScript support, without adding runtime dependencies.
const source = await readFile(new URL('../web/src/lib/academia/familyData.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } })
const { listFamilyStudents, loadFamilyAcademia, latestCompletedAttempts } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

const profile = { guardian_id: 'guardian-a', school_id: 'school-a' }
const child = { id: 'child-a', school_id: 'school-a', first_name: 'Ana', last_name: 'Pérez', grade_level: '6to', enrollment_status: 'inscrito' }
function clientWith(results) {
  const calls = []
  return {
    calls,
    from(table) {
      const call = { table, filters: [], select: null }
      calls.push(call)
      const query = {
        select(value) { call.select = value; return query },
        eq(...args) { call.filters.push(['eq', ...args]); return query },
        is(...args) { call.filters.push(['is', ...args]); return query },
        not(...args) { call.filters.push(['not', ...args]); return query },
        order(...args) { call.filters.push(['order', ...args]); return query },
        then(resolve, reject) { return Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject) },
      }
      return query
    },
  }
}
const familyClient = () => clientWith({ student_guardians: { data: [{ students: child }], error: null } })

test('unlinked or foreign student never creates an administrative client', async () => {
  let called = false
  const result = await loadFamilyAcademia(familyClient(), profile, 'foreign-child', () => { called = true; throw Error('unauthorized') })
  assert.equal(result, null)
  assert.equal(called, false)
})

test('missing guardian or school fails closed without querying', async () => {
  for (const incomplete of [{ guardian_id: null, school_id: 'school-a' }, { guardian_id: 'guardian-a', school_id: null }]) {
    const client = familyClient()
    assert.deepEqual(await listFamilyStudents(client, incomplete), [])
    assert.equal(client.calls.length, 0)
  }
})

test('authorization uses guardian, same school and undeleted child before reading progress', async () => {
  const client = familyClient()
  const admin = clientWith({ lessons: { data: [{ id: 'lesson-a' }], error: null }, quiz_attempts: { data: [], error: null } })
  const result = await loadFamilyAcademia(client, profile, child.id, () => admin)
  assert.equal(result.student.id, child.id)
  assert.deepEqual(client.calls[0].filters, [
    ['eq', 'guardian_id', profile.guardian_id], ['eq', 'students.school_id', profile.school_id], ['is', 'students.deleted_at', null],
  ])
  assert.ok(admin.calls[0].filters.some(f => f[1] === 'school_id' && f[2] === child.school_id))
  assert.ok(admin.calls[0].filters.some(f => f[1] === 'grade_level' && f[2] === child.grade_level))
  assert.ok(admin.calls[0].filters.some(f => f[1] === 'is_published' && f[2] === true))
  assert.ok(admin.calls[0].filters.some(f => f[0] === 'is' && f[1] === 'deleted_at' && f[2] === null))
  assert.ok(admin.calls[1].filters.some(f => f[1] === 'student_id' && f[2] === child.id))
  assert.ok(admin.calls[1].filters.some(f => f[1] === 'school_id' && f[2] === child.school_id))
})

test('staff with a guardian link gets family scope, never their whole staff directory', async () => {
  const result = await loadFamilyAcademia(familyClient(), { ...profile, role: 'director' }, 'foreign-child', () => { throw Error('must not execute') })
  assert.equal(result, null)
})

test('relationship query failure cannot be mistaken for an empty family', async () => {
  const client = clientWith({ student_guardians: { data: null, error: { message: 'RLS failure' } } })
  await assert.rejects(loadFamilyAcademia(client, profile, child.id, () => { throw Error('must not execute') }), /verificar/)
})

test('missing grade does not read unrestricted lessons', async () => {
  const client = clientWith({ student_guardians: { data: [{ students: { ...child, grade_level: null } }], error: null } })
  const result = await loadFamilyAcademia(client, profile, child.id, () => { throw Error('must not execute') })
  assert.deepEqual(result.lessons, [])
})

test('progress failure is explicit; lesson failure does not claim there are no tasks', async () => {
  const admin = clientWith({ quiz_attempts: { data: null, error: { message: 'unavailable' } } })
  assert.equal((await loadFamilyAcademia(familyClient(), profile, child.id, () => admin)).progressError, true)
  const failed = clientWith({ lessons: { data: null, error: { message: 'unavailable' } } })
  await assert.rejects(loadFamilyAcademia(familyClient(), profile, child.id, () => failed), /cargar las tareas/)
})

test('latest completed attempt wins without allowing unfinished attempts to mark a task complete', () => {
  const result = latestCompletedAttempts([
    { lesson_id: 'lesson-a', completed_at: '2026-09-30T10:00:00Z', score: 8, max_score: 10 },
    { lesson_id: 'lesson-a', completed_at: '2026-09-29T10:00:00Z', score: 3, max_score: 10 },
    { lesson_id: 'lesson-b', completed_at: null, score: 0, max_score: 10 },
    { lesson_id: 'lesson-a', completed_at: '2026-10-01T10:00:00Z', score: 10, max_score: 10 },
  ])
  assert.equal(result.get('lesson-a').score, 10)
  assert.equal(result.has('lesson-b'), false)
})
