// Checks firestore.rules with the Firebase Rules test API (no emulator or Java needed).
// Usage: npm run test:rules   (requires `gcloud auth login` with access to the project)
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PROJECT = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default
const rules = readFileSync('firestore.rules', 'utf8')
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()

const BEFORE = '2026-10-12T12:00:00Z'
const AFTER = '2026-10-21T12:00:00Z'
const doc = (path) => `/databases/(default)/documents/${path}`
const order = Array.from({ length: 15 }, (_, i) => String(i + 1))
const player = { name: 'Alice', photoURL: null, ouCount: 3, standingsDone: false }

const cases = [
  ['own prediction readable before lock', 'ALLOW', { uid: 'alice', method: 'get', path: 'predictions/alice', time: BEFORE }],
  ["others' predictions hidden before lock", 'DENY', { uid: 'alice', method: 'get', path: 'predictions/bob', time: BEFORE }],
  ["others' predictions visible after lock", 'ALLOW', { uid: 'alice', method: 'get', path: 'predictions/bob', time: AFTER }],
  ['signed-out users see nothing after lock', 'DENY', { method: 'get', path: 'predictions/bob', time: AFTER }],
  ['players list readable before lock', 'ALLOW', { uid: 'alice', method: 'get', path: 'players/bob', time: BEFORE }],
  ['save own picks before lock', 'ALLOW', { uid: 'alice', method: 'create', path: 'predictions/alice', time: BEFORE, data: { overUnder: { 1: 'O' }, east: order } }],
  ["can't write someone else's picks", 'DENY', { uid: 'alice', method: 'update', path: 'predictions/bob', time: BEFORE, data: { overUnder: { 1: 'O' } } }],
  ["can't change picks after lock", 'DENY', { uid: 'alice', method: 'update', path: 'predictions/alice', time: AFTER, data: { overUnder: { 1: 'U' } } }],
  ['standings must list 15 teams', 'DENY', { uid: 'alice', method: 'update', path: 'predictions/alice', time: BEFORE, data: { east: ['1', '2'] } }],
  ['no extra fields on predictions', 'DENY', { uid: 'alice', method: 'update', path: 'predictions/alice', time: BEFORE, data: { score: 120 } }],
  ['register in players before lock', 'ALLOW', { uid: 'alice', method: 'create', path: 'players/alice', time: BEFORE, data: player }],
  ["can't update players after lock", 'DENY', { uid: 'alice', method: 'update', path: 'players/alice', time: AFTER, data: player }],
]

const testCases = cases.map(([, expectation, c]) => ({
  expectation,
  request: {
    ...(c.uid && { auth: { uid: c.uid } }),
    path: doc(c.path),
    method: c.method,
    time: c.time,
    ...(c.data && { resource: { data: c.data } }),
  },
}))

const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': PROJECT,
  },
  body: JSON.stringify({
    source: { files: [{ name: 'firestore.rules', content: rules }] },
    testSuite: { testCases },
  }),
})
const body = await res.json()
if (!res.ok) {
  console.error(JSON.stringify(body, null, 2))
  process.exit(1)
}

let failed = 0
body.testResults.forEach((r, i) => {
  const ok = r.state === 'SUCCESS'
  if (!ok) failed++
  console.log(`${ok ? 'pass' : 'FAIL'}  ${cases[i][0]}`)
  if (!ok) console.log('      ', JSON.stringify(r.debugMessages ?? r.errorPosition ?? r))
})
console.log(`\n${cases.length - failed}/${cases.length} rules checks passed`)
process.exit(failed ? 1 : 0)
