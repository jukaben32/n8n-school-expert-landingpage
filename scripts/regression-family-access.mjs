// Runs the actual TypeScript actions with an in-memory Supabase adapter.
// No credentials, network requests, production writes, or child processes.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'web/package.json'))
const ts = require('typescript')
let db, quota, operator, failLink, failClaim, failQuota, failNetwork, linkCalls, logs
let states, stateIndex, browserError, navigation, rejectedAction
let authUsers, failCreateUser, failProfile, createdUsers
const guardian = { id: 'guardian', school_id: 'school', family_id: 'family', first_name: 'Tutor', last_name: 'Prueba', phone: '8091234567' }

function reset() {
  db = { guardians: [guardian], users_profiles: [{ auth_id: 'auth', guardian_id: 'guardian', role: 'guardian' }], student_guardians: [{ student_id: 'student', guardian_id: 'guardian' }], schools: [{ id: 'school', name: 'Colegio' }], family_phone_access_codes: [] }
  quota = 0; operator = 'reception'; failLink = false; failClaim = false; failQuota = false; failNetwork = false; linkCalls = 0; logs = []
  states = []; stateIndex = 0; browserError = false; navigation = []; rejectedAction = false
  authUsers = []; failCreateUser = false; failProfile = false; createdUsers = 0
}

function query(table) {
  let operation = 'read', payload, single = false, count = false, limit = Infinity
  const filters = [], orders = []
  const q = {
    select(_columns, options) { count = !!options?.count; return q },
    eq(key, value) { filters.push(row => row[key] === value); return q },
    is(key, value) { filters.push(row => (row[key] ?? null) === value); return q },
    gt(key, value) { filters.push(row => row[key] > value); return q },
    gte(key, value) { filters.push(row => row[key] >= value); return q },
    order(key, options) { orders.push([key, options]); return q },
    limit(value) { limit = value; return q },
    insert(value) { operation = 'insert'; payload = value; return q },
    update(value) { operation = 'update'; payload = value; return q },
    single() { single = true; return q },
    maybeSingle() { single = true; return q },
    then(done, rejected) {
      return Promise.resolve().then(() => {
        if (failNetwork) throw new Error('network failed')
        if (count && table === 'family_phone_access_codes') return { count: failQuota ? null : quota, error: failQuota ? { code: 'db_unavailable' } : null }
        if (operation === 'update' && payload.consumed_at && failClaim) return { data: null, error: { code: 'claim_failed' } }
        if (operation === 'insert') {
          if (table === 'users_profiles' && failProfile) return { data: null, error: { code: 'profile_failed' } }
          const row = { attempt_count: 0, consumed_at: null, created_at: new Date().toISOString(), ...payload }
          db[table].push(row)
          if (table === 'family_phone_access_codes') quota++
          return { data: single ? { ...row } : [{ ...row }], error: null }
        }
        let rows = db[table].filter(row => filters.every(filter => filter(row)))
        for (const [key, options] of orders) rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (options?.ascending === false ? -1 : 1))
        rows = rows.slice(0, limit)
        if (operation === 'update') rows.forEach(row => Object.assign(row, payload))
        return { data: single ? (rows[0] ? { ...rows[0] } : null) : rows.map(row => ({ ...row })), count: rows.length, error: null }
      }).then(done, rejected)
    },
  }
  return q
}

const admin = { from: query, auth: { admin: {
  async listUsers() { return { data: { users: authUsers }, error: null } },
  async createUser(options) {
    if (failCreateUser) return { data: { user: null }, error: { code: 'auth_create_failed' } }
    const user = { id: 'new-auth', email: options.email }; authUsers.push(user); createdUsers++
    return { data: { user }, error: null }
  },
  async getUserById() { return { data: { user: { email: 'test@example.invalid' } }, error: null } },
  async generateLink() { linkCalls++; if (failLink === 'throw') throw new Error('auth network'); return failLink ? { data: null, error: { code: 'auth_unavailable' } } : { data: { properties: { hashed_token: 'test-token' } }, error: null } },
} } }
const server = {
  auth: { async getUser() { return { data: { user: operator ? { id: 'operator' } : null } } } },
  from() { const q = { select() { return q }, eq() { return q }, async single() { return { data: { role: operator, school_id: 'school' } } } }; return q },
}

const cache = new Map()
function load(path) {
  const absolute = resolve(root, path)
  if (cache.has(absolute)) return cache.get(absolute)
  const exports = {}
  cache.set(absolute, exports)
  const source = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  function mockedRequire(name) {
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => admin }
    if (name === '@/lib/supabase/server') return { createClient: async () => server }
    if (name === '@/lib/supabase/client') return { createClient: () => ({ auth: { async verifyOtp() { return { error: browserError ? {} : null } } } }) }
    if (name === '@/lib/activeSchool') return { getActiveSchool: async () => ({ schoolId: 'school' }) }
    if (name === '@/lib/familyAccessLog') return { logFamilyAccessFailure: (stage) => logs.push(stage) }
    if (name === '@/lib/whatsapp/connection') return { getWhatsappConnection: async () => null, sendWhatsappMessage: async () => { throw new Error('manual must not send') } }
    if (name === 'next/navigation') return { useRouter: () => ({ push: value => navigation.push(value), refresh() {} }) }
    if (name === 'react') return { useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value }] } }
    if (name === './actions' && /tsx$/.test(absolute)) return {
      generateManualFamilyAccessCode: async (...args) => { if (rejectedAction) throw new Error('network'); return manual.generateManualFamilyAccessCode(...args) },
      requestFamilyAccessCode: async (...args) => { if (rejectedAction) throw new Error('network'); return access.requestFamilyAccessCode(...args) },
      verifyFamilyAccessCode: async (...args) => { if (rejectedAction) throw new Error('network'); return access.verifyFamilyAccessCode(...args) },
      verifyFamilyAccessCodeByPhone: async (...args) => { if (rejectedAction) throw new Error('network'); return access.verifyFamilyAccessCodeByPhone(...args) },
    }
    if (name.startsWith('@/')) return load('web/src/' + name.slice(2) + '.ts')
    if (name.startsWith('.')) return load(resolve(dirname(absolute), name + '.ts'))
    return require(name)
  }
  new Function('require', 'exports', 'module', source)(mockedRequire, exports, { exports })
  return exports
}

const core = load('web/src/lib/familyAccessCodes.ts')
const manual = load('web/src/app/dashboard/secretaria/acceso-familiar/actions.ts')
const access = load('web/src/app/acceso-familiar/actions.ts')
const Form = load('web/src/app/acceso-familiar/FamilyPhoneAccessForm.tsx').default
const Panel = load('web/src/app/dashboard/secretaria/acceso-familiar/ManualFamilyAccessPanel.tsx').default
const event = { preventDefault() {} }
function seed(overrides = {}) {
  const row = { id: 'challenge', normalized_phone: guardian.phone, auth_email: 'test@example.invalid', code_hash: core.hashFamilyAccessCode('challenge', '123456'), attempt_count: 0, expires_at: new Date(Date.now() + 60000).toISOString(), consumed_at: null, created_at: new Date().toISOString(), ...overrides }
  db.family_phone_access_codes.push(row); return row
}

await test('manual quota permits 20th code and refuses 21st', async () => {
  reset(); quota = 19
  const response = await manual.generateManualFamilyAccessCode(guardian.phone)
  assert.equal(response.ok, true); assert.equal(response.remainingCodes, 0)
  assert.match(response.message, /acceso-familiar\?modo=manual/)
  assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false)
  assert.equal(db.family_phone_access_codes.length, 1)
})
await test('a third parent is not blocked by the former limit of five', async () => {
  reset(); quota = 5
  assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, true)
})
await test('new challenge is inserted once with its final hash and 24h expiry', async () => {
  reset(); const response = await manual.generateManualFamilyAccessCode(guardian.phone)
  const row = db.family_phone_access_codes[0]
  assert.equal(row.code_hash, core.hashFamilyAccessCode(row.id, response.code))
  assert.notEqual(row.code_hash, 'pending'); assert.match(response.code, /^\d{6}$/)
  assert.ok(Date.parse(row.expires_at) - Date.now() > 86300000)
})
await test('unauthorized operator and anonymous cannot generate', async () => {
  for (const role of ['guardian', 'teacher', null]) { reset(); operator = role; assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false); assert.equal(quota, 0) }
})
await test('wrong school, duplicates and missing children remain denied', async () => {
  reset(); db.guardians[0] = { ...guardian, school_id: 'other' }; assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false)
  reset(); db.guardians.push({ ...guardian, id: 'duplicate' }); assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false)
  reset(); db.student_guardians = []; assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false)
})
await test('quota database errors fail closed', async () => {
  reset(); failQuota = true; assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false); assert.equal(quota, 0); assert.ok(logs.includes('manual-quota'))
})
await test('server network failures become a retryable result', async () => {
  reset(); failNetwork = true; assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false); assert.equal((await access.verifyFamilyAccessCodeByPhone(guardian.phone, '123456')).ok, false)
})
await test('manual phone verification works without automatic WhatsApp connection', async () => {
  reset(); seed(); const result = await access.verifyFamilyAccessCodeByPhone('+1 809-123-4567', '123456'); assert.equal(result.ok, true); assert.equal(result.tokenHash, 'test-token')
})
await test('successful code cannot be reused', async () => {
  reset(); seed(); assert.equal((await access.verifyFamilyAccessCode('challenge', '123456')).ok, true); assert.equal((await access.verifyFamilyAccessCode('challenge', '123456')).ok, false); assert.equal(linkCalls, 1)
})
await test('concurrent valid requests prepare only one session', async () => {
  reset(); seed(); const results = await Promise.all([access.verifyFamilyAccessCode('challenge', '123456'), access.verifyFamilyAccessCode('challenge', '123456')]); assert.equal(results.filter(r => r.ok).length, 1); assert.equal(linkCalls, 1)
})
await test('Auth provider failure or exception releases code for retry', async () => {
  for (const failure of [true, 'throw']) {
    reset(); const row = seed(); failLink = failure
    assert.equal((await access.verifyFamilyAccessCode('challenge', '123456')).ok, false); assert.equal(row.consumed_at, null)
    failLink = false; assert.equal((await access.verifyFamilyAccessCode('challenge', '123456')).ok, true)
  }
})
await test('claim write error never returns an auth token', async () => {
  reset(); seed(); failClaim = true; assert.equal((await access.verifyFamilyAccessCode('challenge', '123456')).ok, false); assert.equal(linkCalls, 0)
})
await test('expired, used, invalid and locked codes never mint tokens', async () => {
  for (const overrides of [{ expires_at: new Date(Date.now() - 1).toISOString() }, { consumed_at: new Date().toISOString() }, { attempt_count: 5 }]) {
    reset(); seed(overrides); assert.equal((await access.verifyFamilyAccessCode('challenge', '123456')).ok, false); assert.equal(linkCalls, 0)
  }
  reset(); seed(); assert.equal((await access.verifyFamilyAccessCode('challenge', '12')).ok, false); assert.equal(linkCalls, 0)
})
await test('five wrong attempts prevent a later correct code', async () => {
  reset(); const row = seed(); for (let i = 0; i < 5; i++) assert.equal((await access.verifyFamilyAccessCode('challenge', '000000')).ok, false)
  assert.equal(row.attempt_count, 5); assert.equal((await access.verifyFamilyAccessCode('challenge', '123456')).ok, false); assert.equal(linkCalls, 0)
})
await test('manual form starts in code mode and resets loading after rejected action', async () => {
  reset(); rejectedAction = true; const form = Form({ initialManualMode: true }); assert.equal(states[3], true)
  await form.props.onSubmit(event); assert.equal(states[6], false); assert.match(states[5], /conexion/)
})
await test('automatic form remains available and resets after rejected action', async () => {
  reset(); rejectedAction = true; const form = Form({}); assert.equal(states[3], false)
  await form.props.onSubmit(event); assert.equal(states[6], false); assert.match(states[5], /conexion/)
})
await test('browser Auth failure stops loading and does not navigate', async () => {
  reset(); seed(); browserError = true; states = [guardian.phone, '123456', null, true, null, null, false]
  await Form({ initialManualMode: true }).props.onSubmit(event); assert.equal(states[6], false); assert.equal(navigation.length, 0); assert.match(states[5], /secretaria/)
})
await test('browser success reaches family portal', async () => {
  reset(); seed(); states = [guardian.phone, '123456', null, true, null, null, false]
  await Form({ initialManualMode: true }).props.onSubmit(event); assert.deepEqual(navigation, ['/dashboard/portal-familiar'])
})
await test('secretary panel releases loading after rejected action', async () => {
  reset(); rejectedAction = true; const panel = Panel(); const form = panel.props.children[0]
  await form.props.onSubmit(event); assert.equal(states[4], false); assert.match(states[2], /conexion/)
})
await test('a tutor without an account gets a confirmed synthetic account and guardian profile', async () => {
  reset(); db.users_profiles = []
  assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, true)
  assert.equal(createdUsers, 1); assert.equal(db.users_profiles[0].role, 'guardian')
  assert.equal(db.users_profiles[0].school_id, guardian.school_id)
  assert.equal(db.family_phone_access_codes[0].auth_id, 'new-auth')
})
await test('account creation errors do not consume quota and report their stage', async () => {
  reset(); db.users_profiles = []; failCreateUser = true
  assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false)
  assert.equal(quota, 0); assert.ok(logs.includes('guardian-create-account'))
})
await test('retry after failed profile insertion reuses the existing Auth account', async () => {
  reset(); db.users_profiles = []; failProfile = true
  assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, false)
  assert.equal(quota, 0); assert.equal(createdUsers, 1)
  failProfile = false
  assert.equal((await manual.generateManualFamilyAccessCode(guardian.phone)).ok, true)
  assert.equal(createdUsers, 1); assert.equal(db.users_profiles.length, 1)
})
