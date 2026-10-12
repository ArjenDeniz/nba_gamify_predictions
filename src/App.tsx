import type { User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { ErrorNote, TeamLogo } from './components'
import { LOCK_AT, SEASON_LABEL, isLocked } from './config'
import { TEAMS, TEAM_BY_ID } from './data/winTotals'
import { useAllPredictions, useAuthUser, useMyPrediction, useNow, usePlayers } from './lib/data'
import { useStandings } from './lib/espn'
import { logOut, signIn } from './lib/firebase'
import { savedOrder, type Prediction } from './lib/scoring'
import { Leaderboard } from './pages/Leaderboard'
import { OverUnder } from './pages/OverUnder'
import { Standings } from './pages/Standings'

export default function App() {
  const user = useAuthUser()
  if (user === undefined) return null
  return user ? <Shell user={user} /> : <SignIn />
}

function SignIn() {
  const [error, setError] = useState<string | null>(null)
  // A slice of the board, from the top line to the bottom.
  const board = ['25', '24', '18', '8', '30', '17', '23'].map((id) => TEAM_BY_ID[id])

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl content-center gap-10 px-4 py-10 md:grid-cols-[1fr_1.1fr] md:items-center">
      <ol className="order-2 rounded-xl bg-sheet/90 px-5 py-3 shadow-[0_10px_30px_-18px_rgb(60_30_5/0.6)] md:order-1">
        {board.map((t) => (
          <li key={t.id} className="flex items-center gap-4 border-b border-line py-2 last:border-b-0">
            <TeamLogo team={t} size={34} />
            <span className="flex-1 truncate font-semibold">{t.name}</span>
            <span className="tabular font-display text-5xl font-black leading-none">{t.line}</span>
          </li>
        ))}
      </ol>
      <div className="order-1 md:order-2">
        <p className="font-display text-xl font-extrabold">NBA Pick’em {SEASON_LABEL}</p>
        <h1 className="mt-3 font-display text-6xl font-black leading-[0.9] sm:text-7xl">
          Call the season before it starts.
        </h1>
        <p className="mt-5 max-w-prose text-lg text-ink-soft">
          Pick over or under on all {TEAMS.length} Vegas win totals, rank both conferences 1 to 15, and watch the
          leaderboard move with every game. Picks lock at tip-off on{' '}
          {LOCK_AT.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.
        </p>
        <button
          type="button"
          onClick={() => signIn().catch((e: Error) => setError(e.message))}
          className="mt-7 rounded-lg bg-ink px-6 py-3.5 text-base font-semibold text-sheet hover:bg-ink/85"
        >
          Sign in with Google
        </button>
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      </div>
    </main>
  )
}

const TABS = [
  { id: 'over-under', label: 'Over/Under' },
  { id: 'standings', label: 'Standings' },
  { id: 'leaderboard', label: 'Leaderboard' },
] as const
type TabId = (typeof TABS)[number]['id']

function useHashTab(fallback: TabId): TabId {
  const read = () => {
    const id = window.location.hash.replace('#/', '')
    return TABS.some((t) => t.id === id) ? (id as TabId) : fallback
  }
  const [tab, setTab] = useState(read)
  useEffect(() => {
    const onHash = () => setTab(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  })
  return tab
}

function Shell({ user }: { user: User }) {
  const locked = isLocked(useNow(15_000))
  const tab = useHashTab(locked ? 'leaderboard' : 'over-under')
  const { pred, error, setPick, setOrder } = useMyPrediction(user, !locked)
  const { standings, error: standingsError, updatedAt } = useStandings()
  const players = usePlayers()
  const { preds, error: predsError } = useAllPredictions(locked)

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-5">
        <a href="#/over-under" className="font-display text-2xl font-black leading-none">
          Pick’em <span className="text-ink-soft">{SEASON_LABEL}</span>
        </a>
        <div className="flex items-center gap-3">
          <LockClock />
          <button
            type="button"
            onClick={logOut}
            className="text-sm underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="sticky top-0 z-20 mx-auto mt-3 max-w-5xl px-4" aria-label="Sections">
        <div className="flex gap-1 rounded-xl bg-ink p-1">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`#/${t.id}`}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex-1 rounded-lg px-2 py-2 text-center text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-sheet text-ink' : 'text-sheet/80 hover:text-sheet'
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {pred && !locked && <Checklist pred={pred} />}
        <ErrorNote message={error && `Your picks didn’t save (${error}). Check your connection and try again.`} />
        {!pred ? (
          <p className="px-1 text-ink-soft">Loading your picks…</p>
        ) : tab === 'over-under' ? (
          <div className="mx-auto max-w-3xl">
            <OverUnder pred={pred} locked={locked} standings={standings} onPick={setPick} />
          </div>
        ) : tab === 'standings' ? (
          <Standings pred={pred} locked={locked} standings={standings} onOrder={setOrder} />
        ) : (
          <Leaderboard
            meUid={user.uid}
            players={players}
            preds={preds}
            predsError={predsError}
            locked={locked}
            standings={standings}
            standingsError={standingsError}
            updatedAt={updatedAt}
          />
        )}
      </main>
    </div>
  )
}

// What's still missing before tip-off; each item jumps to the tab where you fix it.
function Checklist({ pred }: { pred: Prediction }) {
  const ouCount = TEAMS.filter((t) => pred.overUnder?.[t.id]).length
  const items = [
    { href: '#/over-under', label: `Over/Under ${ouCount}/${TEAMS.length}`, done: ouCount === TEAMS.length },
    { href: '#/standings', label: 'East', done: savedOrder(pred, 'East') !== null },
    { href: '#/standings', label: 'West', done: savedOrder(pred, 'West') !== null },
  ]

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Your picks">
      {items.map((item) => (
        <li key={item.label}>
          <a
            href={item.href}
            className={`tabular flex items-center gap-1.5 rounded-lg bg-sheet px-3 py-1.5 text-sm font-semibold ${
              item.done ? 'text-ink-soft' : 'text-under ring-2 ring-under/60'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className={item.done ? 'text-over' : ''}>
              <path
                d={item.done ? 'M2 7.5l3.2 3.2L12 3.8' : 'M3.5 3.5l7 7M10.5 3.5l-7 7'}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="sr-only">{item.done ? 'Done:' : 'Not done:'}</span>
            <span>
              {item.label}
              {item.href === '#/standings' && <span className="max-sm:sr-only"> standings</span>}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function LockClock() {
  const now = useNow()
  const ms = LOCK_AT.getTime() - now.getTime()
  if (ms <= 0) return <span className="text-sm font-semibold">Picks locked</span>
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor(ms / 3_600_000) % 24
  const m = Math.floor(ms / 60_000) % 60
  const s = Math.floor(ms / 1000) % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <span className="tabular text-sm" title={LOCK_AT.toLocaleString()}>
      Locks in <span className="font-semibold">{d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`}</span>
    </span>
  )
}
