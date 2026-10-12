import { useState } from 'react'
import { ErrorNote, OutcomeMark, PickTag, Sheet, TeamLogo } from '../components'
import { LOCK_AT } from '../config'
import { TEAMS, TEAM_BY_ID, type Conference } from '../data/winTotals'
import type { Player } from '../lib/data'
import {
  MAX_OU,
  MAX_STANDINGS,
  closenessPoints,
  ouOutcome,
  projectedWins,
  scorePrediction,
  seasonStarted,
  type Prediction,
  type Standings,
} from '../lib/scoring'

type Props = {
  meUid: string
  players: Player[]
  preds: Record<string, Prediction>
  predsError: string | null
  locked: boolean
  standings: Standings | null
  standingsError: string | null
  updatedAt: Date | null
}

export function Leaderboard(props: Props) {
  const { locked, standings, standingsError, updatedAt } = props
  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="font-display text-4xl font-extrabold leading-none sm:text-5xl">Leaderboard</h1>
        <p className="mt-2 max-w-prose text-ink-soft">
          {locked
            ? 'Scores update with the live standings. Over/unders count by current pace until they’re clinched.'
            : `Everyone’s picks are revealed at tip-off, ${LOCK_AT.toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}.`}
        </p>
      </header>

      {locked ? <Rankings {...props} /> : <WhosIn players={props.players} />}

      <ErrorNote message={standingsError && `Couldn’t load live standings from ESPN (${standingsError}). Retrying every minute.`} />
      {standings && <LiveTables standings={standings} updatedAt={updatedAt} />}
    </div>
  )
}

function Avatar({ player, size = 36 }: { player: Player; size?: number }) {
  return player.photoURL ? (
    <img
      src={player.photoURL}
      alt=""
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-ink font-display font-extrabold text-sheet"
      style={{ width: size, height: size }}
    >
      {player.name.slice(0, 1)}
    </span>
  )
}

function WhosIn({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <Sheet className="overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 font-display text-2xl font-extrabold">
        Who’s in <span className="tabular text-ink-soft">({players.length})</span>
      </h2>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-ink-soft">Nobody yet. Send your friends the link.</p>
      ) : (
        <ul>
          {sorted.map((p) => (
            <li key={p.uid} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <Avatar player={p} />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <span className="tabular text-sm">
                {p.ouCount}/{MAX_OU} picks
              </span>
              <span className={`w-28 text-right text-sm ${p.standingsDone ? 'text-over' : 'text-ink-soft'}`}>
                {p.standingsDone ? 'Standings saved' : 'No standings yet'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

function Rankings({ meUid, players, preds, predsError, standings }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const live = standings ?? {}
  const started = seasonStarted(live)

  const rows = players
    .map((p) => ({ player: p, pred: preds[p.uid] ?? {}, score: scorePrediction(preds[p.uid] ?? {}, live) }))
    .sort((a, b) => b.score.total - a.score.total || a.player.name.localeCompare(b.player.name))

  return (
    <Sheet className="overflow-hidden">
      <ErrorNote message={predsError} />
      {!started && (
        <p className="border-b border-line bg-playin/10 px-4 py-2 text-sm">
          Scores start once the first games are final.
        </p>
      )}
      <div className="grid grid-cols-[2rem_1fr_auto_auto_3.5rem] items-center gap-x-3 border-b border-line px-4 py-2 text-xs text-ink-soft">
        <span />
        <span>Player</span>
        <span className="w-14 text-right">O/U</span>
        <span className="w-16 text-right">Standings</span>
        <span className="text-right">Total</span>
      </div>
      <ol>
        {rows.map((row, i) => {
          const rank = rows.findIndex((r) => r.score.total === row.score.total) + 1
          const isOpen = open === row.player.uid
          return (
            <li key={row.player.uid} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : row.player.uid)}
                className={`grid w-full grid-cols-[2rem_1fr_auto_auto_3.5rem] items-center gap-x-3 px-4 py-3 text-left hover:bg-ink/5 ${
                  row.player.uid === meUid ? 'bg-paint/5' : ''
                }`}
              >
                <span className="tabular font-display text-2xl font-extrabold text-ink-soft">
                  {i > 0 && rows[i - 1].score.total === row.score.total ? '' : rank}
                </span>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar player={row.player} size={32} />
                  <span className="truncate font-semibold">{row.player.name}</span>
                </span>
                <span className="tabular w-14 text-right text-sm">{row.score.ou}</span>
                <span className="tabular w-16 text-right text-sm">{row.score.standings}</span>
                <span className="tabular text-right font-display text-3xl font-black leading-none">{row.score.total}</span>
              </button>
              {isOpen && <PlayerPicks pred={row.pred} standings={live} started={started} />}
            </li>
          )
        })}
      </ol>
      <p className="border-t border-line px-4 py-2 text-xs text-ink-soft">
        Max {MAX_OU} for over/unders and {MAX_STANDINGS} for standings. Tap a player to see their sheet.
      </p>
    </Sheet>
  )
}

function PlayerPicks({ pred, standings, started }: { pred: Prediction; standings: Standings; started: boolean }) {
  return (
    <div className="grid gap-4 bg-ink/[0.03] px-4 py-4 sm:grid-cols-3">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Over/unders</h3>
        <ul className="space-y-1">
          {TEAMS.filter((t) => pred.overUnder?.[t.id])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <TeamLogo team={t} size={18} />
                <span className="tabular w-10">{t.abbr.toUpperCase()}</span>
                <PickTag pick={pred.overUnder![t.id]} />
                <span className="tabular text-ink-soft">{t.line}</span>
                <OutcomeMark pick={pred.overUnder![t.id]} outcome={ouOutcome(t.line, standings[t.id])} />
              </li>
            ))}
        </ul>
      </div>
      {(['East', 'West'] as Conference[]).map((conf) => {
        const order = conf === 'East' ? pred.east : pred.west
        return (
          <div key={conf}>
            <h3 className="mb-2 text-sm font-semibold">{conf}</h3>
            {!order?.length ? (
              <p className="text-sm text-ink-soft">No standings saved.</p>
            ) : (
              <ol className="space-y-1">
                {order.map((id, i) => {
                  const actual = standings[id]?.seed
                  return (
                    <li key={id} className="tabular flex items-center gap-2 text-sm">
                      <span className="w-5 text-right font-semibold">{i + 1}</span>
                      <TeamLogo team={TEAM_BY_ID[id]} size={18} />
                      <span className="flex-1">{TEAM_BY_ID[id].abbr.toUpperCase()}</span>
                      {started && actual !== undefined && (
                        <span className="text-ink-soft">
                          now {actual}, +{closenessPoints(i + 1, actual)}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LiveTables({ standings, updatedAt }: { standings: Standings; updatedAt: Date | null }) {
  // Before opening night every team is 0-0, so list them by Vegas line instead.
  const started = seasonStarted(standings)
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-3xl font-extrabold">Live standings</h2>
        {updatedAt && (
          <span className="text-xs text-ink-soft">
            ESPN, updated {updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {(['East', 'West'] as Conference[]).map((conf) => {
          const rows = Object.entries(standings)
            .filter(([id, r]) => r.conf === conf && TEAM_BY_ID[id])
            .sort(([ia, a], [ib, b]) => (started ? a.seed - b.seed : TEAM_BY_ID[ib].line - TEAM_BY_ID[ia].line))
          return (
            <Sheet key={conf} className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <caption className="px-4 pt-3 text-left font-display text-2xl font-extrabold">{conf}</caption>
                <thead className="text-xs text-ink-soft">
                  <tr className="border-b border-line">
                    <th className="w-10 py-2 pl-4 text-left font-medium">#</th>
                    <th className="py-2 text-left font-medium">Team</th>
                    <th className="py-2 text-right font-medium">W–L</th>
                    <th className="py-2 text-right font-medium">Pace</th>
                    <th className="py-2 pr-4 text-right font-medium">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([id, r]) => {
                    const team = TEAM_BY_ID[id]
                    const pace = projectedWins(r)
                    return (
                      <tr key={id} className="border-b border-line last:border-b-0">
                        <td className="py-2 pl-4 font-semibold">{started ? r.seed : '–'}</td>
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <TeamLogo team={team} size={20} />
                            {team.name}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {r.wins}–{r.losses}
                        </td>
                        <td
                          className={`py-2 text-right font-semibold ${
                            pace === null ? 'text-ink-soft' : pace > team.line ? 'text-over' : 'text-under'
                          }`}
                        >
                          {pace === null ? '–' : pace.toFixed(1)}
                        </td>
                        <td className="py-2 pr-4 text-right">{team.line}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Sheet>
          )
        })}
      </div>
    </div>
  )
}
