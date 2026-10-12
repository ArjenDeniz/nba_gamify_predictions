// Rebuilds the public over/under pick counts (tallies/{teamId}) from everyone's predictions.
// Run once after deploying the tallies feature, and again any time counts look off.
// Usage: npm run recount   (requires `gcloud auth login` with access to the project; bypasses the rules)
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PROJECT = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
const DOCS = `projects/${PROJECT}/databases/(default)/documents`
const API = `https://firestore.googleapis.com/v1/${DOCS}`
const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT }

async function call(url, init) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } })
  const body = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(body, null, 2))
  return body
}

async function listAll(collection, fieldPaths) {
  const docs = []
  let pageToken = ''
  do {
    const params = new URLSearchParams({ pageSize: '300' })
    for (const f of fieldPaths) params.append('mask.fieldPaths', f)
    if (pageToken) params.set('pageToken', pageToken)
    const page = await call(`${API}/${collection}?${params}`)
    docs.push(...(page.documents ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return docs
}

const idOf = (d) => d.name.split('/').at(-1)

const predictions = await listAll('predictions', ['overUnder'])
const existing = await listAll('tallies', ['O'])

// Every team with a tally or a pick gets rewritten, so stale counts drop back to zero.
const counts = Object.fromEntries(existing.map((d) => [idOf(d), { O: 0, U: 0 }]))
for (const d of predictions) {
  for (const [teamId, v] of Object.entries(d.fields?.overUnder?.mapValue?.fields ?? {})) {
    const pick = v.stringValue
    if (pick !== 'O' && pick !== 'U') continue
    counts[teamId] ??= { O: 0, U: 0 }
    counts[teamId][pick]++
  }
}

const writes = Object.entries(counts).map(([teamId, { O, U }]) => ({
  update: {
    name: `${DOCS}/tallies/${teamId}`,
    fields: { O: { integerValue: String(O) }, U: { integerValue: String(U) } },
  },
}))
if (writes.length) {
  await call(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
}

// Exact counts stay out of the output; the board only shows them rounded.
console.log(`Recounted ${predictions.length} predictions into ${writes.length} team tallies.`)
