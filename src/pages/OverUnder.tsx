import { OutcomeMark, Sheet, TeamLogo } from '../components'
import { LINES_SOURCE, TEAMS, teamsIn, type Conference, type Team } from '../data/winTotals'
import { ouOutcome, projectedWins, type Pick, type Prediction, type Standings } from '../lib/scoring'

type Props = {
  pred: Prediction
  locked: boolean
  standings: Standings | null
  onPick: (teamId: string, pick: Pick | null) => void
}

export function OverUnder({ pred, locked, standings, onPick }: Props) {
  const picked = TEAMS.filter((t) => pred.overUnder?.[t.id]).length

  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="font-display text-4xl font-extrabold leading-none sm:text-5xl">Over or under?</h1>
        <p className="mt-2 max-w-prose text-ink-soft">
          {locked
            ? 'Picks are locked. Each correct call is worth 1 point.'
            : 'Call each team’s regular-season wins against the Vegas line. Tap a pick again to clear it.'}
        </p>
        <Progress value={picked} max={TEAMS.length} />
      </header>

      {(['East', 'West'] as Conference[]).map((conf) => (
        <Sheet key={conf} className="overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 font-display text-2xl font-extrabold">{conf}</h2>
          <ul>
            {teamsIn(conf)
              .sort((a, b) => b.line - a.line)
              .map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  pick={pred.overUnder?.[team.id]}
                  locked={locked}
                  standings={standings}
                  onPick={onPick}
                />
              ))}
          </ul>
        </Sheet>
      ))}

      <p className="px-1 text-sm text-ink-soft">
        Lines: {LINES_SOURCE.book} season win totals as of{' '}
        {new Date(LINES_SOURCE.asOf).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}
        .
      </p>
    </div>
  )
}

function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/15" aria-hidden>
        <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="tabular text-sm font-semibold">
        {value} of {max} picked
      </span>
    </div>
  )
}

function TeamRow({
  team,
  pick,
  locked,
  standings,
  onPick,
}: {
  team: Team
  pick?: Pick
  locked: boolean
  standings: Standings | null
  onPick: Props['onPick']
}) {
  const record = standings?.[team.id]
  const outcome = ouOutcome(team.line, record)
  const pace = record && projectedWins(record)

  return (
    <li
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[auto_1fr_auto_auto] ${
        pick === 'O' ? 'shadow-[inset_4px_0_0_var(--color-over)]' : pick === 'U' ? 'shadow-[inset_4px_0_0_var(--color-under)]' : ''
      }`}
    >
      <TeamLogo team={team} size={36} />
      <div className="min-w-0">
        <div className="truncate font-semibold">{team.name}</div>
        {record && pace !== null && (
          <div className="tabular flex gap-2 text-xs text-ink-soft">
            <span>
              {record.wins}–{record.losses}
            </span>
            <span>on pace for {pace?.toFixed(1)}</span>
            <OutcomeMark pick={pick} outcome={outcome} />
          </div>
        )}
      </div>
      <Line value={team.line} pick={pick} />
      <div className="col-span-3 mt-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:mt-0 sm:w-48">
        <PickButton side="O" active={pick === 'O'} disabled={locked} onClick={() => onPick(team.id, pick === 'O' ? null : 'O')} team={team} />
        <PickButton side="U" active={pick === 'U'} disabled={locked} onClick={() => onPick(team.id, pick === 'U' ? null : 'U')} team={team} />
      </div>
    </li>
  )
}

// The line is the hero of each row; it lifts or sinks with the pick.
function Line({ value, pick }: { value: number; pick?: Pick }) {
  const shift = pick === 'O' ? '-translate-y-1' : pick === 'U' ? 'translate-y-1' : ''
  const color = pick === 'O' ? 'text-over' : pick === 'U' ? 'text-under' : 'text-ink'
  return (
    <div
      className={`tabular text-right font-display text-4xl font-black leading-none transition duration-200 ${shift} ${color}`}
      aria-label={`Line ${value} wins`}
    >
      {value}
    </div>
  )
}

function PickButton({
  side,
  active,
  disabled,
  onClick,
  team,
}: {
  side: Pick
  active: boolean
  disabled: boolean
  onClick: () => void
  team: Team
}) {
  const word = side === 'O' ? 'Over' : 'Under'
  const activeCls = side === 'O' ? 'bg-over border-over text-white' : 'bg-under border-under text-white'
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${word} ${team.line} for the ${team.name}`}
      disabled={disabled}
      onClick={onClick}
      className={`h-10 rounded-md border-2 text-sm font-semibold transition-colors ${
        active ? activeCls : 'border-ink/20 bg-transparent text-ink hover:border-ink/50'
      } disabled:cursor-not-allowed ${disabled && !active ? 'opacity-40' : ''}`}
    >
      {word}
    </button>
  )
}
