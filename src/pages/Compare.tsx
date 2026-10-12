import type { User } from 'firebase/auth'
import { useState, type ReactNode } from 'react'
import { Avatar, ErrorNote, OutcomeMark, PickTag, Sheet, TeamLogo } from '../components'
import { LOCK_AT } from '../config'
import { TEAM_BY_ID, type Conference } from '../data/winTotals'
import {
  acceptInvite,
  cancelInvite,
  createInvite,
  inviteUrl,
  pairId,
  partnerOf,
  stopComparing,
  useInvite,
  useMyInvites,
  usePairExists,
  usePairs,
  usePrediction,
  type Invite,
  type Pair,
} from '../lib/compare'
import type { Player } from '../lib/data'
import {
  closenessPoints,
  comparePredictions,
  ouOutcome,
  savedOrder,
  scorePrediction,
  seasonStarted,
  type Match,
  type Pick,
  type Prediction,
  type Standings,
} from '../lib/scoring'

type Person = { uid: string; name: string; photoURL: string | null }

type Props = {
  user: User
  pred: Prediction
  players: Player[]
  locked: boolean
  standings: Standings | null
  invite?: string
  matchup?: string
}

const personFor = (players: Player[], uid: string): Person =>
  players.find((p) => p.uid === uid) ?? { uid, name: 'Your friend', photoURL: null }

const firstName = (p: Person) => p.name.split(' ')[0]

const tipOff = () =>
  LOCK_AT.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// Live scores only mean something once games are final.
const liveScores = (locked: boolean, standings: Standings | null, a: Prediction, b: Prediction) =>
  locked && standings && seasonStarted(standings)
    ? ([scorePrediction(a, standings).total, scorePrediction(b, standings).total] as const)
    : null

const linkCls = 'underline decoration-ink/30 underline-offset-2 hover:decoration-ink'
const primaryCls = 'rounded-lg bg-ink px-5 py-3 font-semibold text-sheet hover:bg-ink/85 disabled:opacity-60'

export function Compare(props: Props) {
  if (props.invite) return <InviteLanding {...props} token={props.invite} />
  if (props.matchup) return <HeadToHead {...props} id={props.matchup} />
  return <CompareIndex {...props} />
}

function CompareIndex({ user, pred, players, locked, standings }: Props) {
  const { invites, error: invitesError } = useMyInvites(user.uid)
  const { pairs, error: pairsError } = usePairs(user.uid)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = () => {
    setCreating(true)
    createInvite(user)
      .then(() => setError(null))
      .catch((e: Error) => setError(`Couldn’t create a link (${e.message}). Try again.`))
      .finally(() => setCreating(false))
  }

  const partners = (pairs ?? [])
    .map((pair) => ({ pair, partner: personFor(players, partnerOf(pair, user.uid)) }))
    .sort((a, b) => a.partner.name.localeCompare(b.partner.name))

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="px-1">
        <h1 className="font-display text-4xl font-extrabold leading-none sm:text-5xl">Compare picks</h1>
        <p className="mt-2 max-w-prose text-ink-soft">
          {locked
            ? 'Send a friend a link. Once they accept, you’ll see your match, every team you split on, and who’s ahead.'
            : 'Send a friend a link. Once they accept, you’ll both see how closely your picks match. Which teams you split on stays hidden until tip-off.'}
        </p>
      </header>

      <Sheet className="overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-display text-2xl font-extrabold">Invite a friend</h2>
        <div className="space-y-3 px-4 py-4">
          <ErrorNote message={invitesError && `Couldn’t load your invite links (${invitesError}).`} />
          {invites && invites.length > 0 && (
            <ul className="space-y-3">
              {invites.map((invite) => (
                <InviteLink key={invite.token} invite={invite} />
              ))}
            </ul>
          )}
          <p className="text-sm text-ink-soft">
            Each link works for one person. When they accept, they show up in your matchups.
          </p>
          <ErrorNote message={error} />
          {invites && (
            <button type="button" disabled={creating} onClick={create} className={primaryCls}>
              {invites.length ? 'Create another link' : 'Create invite link'}
            </button>
          )}
        </div>
      </Sheet>

      <Sheet className="overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-display text-2xl font-extrabold">
          Your matchups {pairs && <span className="tabular text-ink-soft">({pairs.length})</span>}
        </h2>
        <ErrorNote message={pairsError && `Couldn’t load your matchups (${pairsError}).`} />
        {!pairs ? (
          <p className="px-4 py-6 text-ink-soft">Loading matchups…</p>
        ) : partners.length === 0 ? (
          <p className="px-4 py-6 text-ink-soft">No matchups yet. Create a link above and send it to a friend.</p>
        ) : (
          <ul>
            {partners.map(({ pair, partner }) => (
              <MatchupRow key={pair.id} pair={pair} partner={partner} mine={pred} locked={locked} standings={standings} />
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  )
}

function InviteLink({ invite }: { invite: Invite }) {
  const url = inviteUrl(invite.token)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canShare = typeof navigator.share === 'function'

  const copy = () =>
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => setError('Couldn’t copy. Select the link and copy it yourself.'))

  // Dismissing the share sheet rejects too, which isn't an error worth showing.
  const share = () => navigator.share({ title: 'Compare NBA picks', text: 'Let’s see how close our NBA picks are.', url }).catch(() => {})

  const cancel = () => cancelInvite(invite.token).catch((e: Error) => setError(`Couldn’t cancel (${e.message}).`))

  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 basis-60 rounded-md border-2 border-ink/15 bg-white/50 px-3 text-sm text-ink-soft"
        />
        <button
          type="button"
          onClick={copy}
          className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-sheet hover:bg-ink/85"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="h-10 rounded-md border-2 border-ink/20 px-4 text-sm font-semibold hover:border-ink/50"
          >
            Share
          </button>
        )}
        <button type="button" onClick={cancel} className={`px-1 text-sm ${linkCls}`}>
          Cancel invite
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
      <ErrorNote message={error} />
    </li>
  )
}

function MatchupRow({
  pair,
  partner,
  mine,
  locked,
  standings,
}: {
  pair: Pair
  partner: Person
  mine: Prediction
  locked: boolean
  standings: Standings | null
}) {
  const { pred: theirs } = usePrediction(partner.uid)
  const match = theirs && comparePredictions(mine, theirs)
  const scores = theirs && liveScores(locked, standings, mine, theirs)

  return (
    <li className="border-b border-line last:border-b-0">
      <a href={`#/compare/${pair.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5">
        <Avatar player={partner} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{partner.name}</span>
          {scores && (
            <span className="tabular block text-sm text-ink-soft">
              You {scores[0]}, {firstName(partner)} {scores[1]}
            </span>
          )}
        </span>
        <span className="text-right">
          <span className="block font-display text-3xl font-black leading-none">
            {match?.pct ?? '–'}
            {match?.pct != null && <span className="text-xl">%</span>}
          </span>
          <span className="block text-xs text-ink-soft">match</span>
        </span>
      </a>
    </li>
  )
}

function Card({ person, title, children }: { person?: Person; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl">
      <Sheet className="px-5 py-6 sm:px-8 sm:py-8">
        {person && <Avatar player={person} size={64} />}
        <h1 className="mt-4 font-display text-4xl font-black leading-[0.95] sm:text-5xl">{title}</h1>
        <div className="mt-3 space-y-5 text-ink-soft">{children}</div>
      </Sheet>
    </div>
  )
}

function InviteLanding({ user, players, locked, token }: Props & { token: string }) {
  const { invite, error } = useInvite(token)
  const fromSomeoneElse = invite && invite.from !== user.uid ? invite.from : null
  const alreadyPaired = usePairExists(fromSomeoneElse && pairId(user.uid, fromSomeoneElse))
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  if (error)
    return (
      <Card title="This invite didn’t open">
        <p>Couldn’t load it ({error}). Check your connection and reload the page.</p>
      </Card>
    )
  if (invite === undefined || alreadyPaired === undefined) return <p className="px-1 text-ink-soft">Loading invite…</p>

  const back = (
    <a href="#/compare" className={linkCls}>
      Go to Compare
    </a>
  )
  if (invite === null)
    return (
      <Card title="This link doesn’t work">
        <p>It may have been cancelled, or copied only partly. Ask your friend for a new one.</p>
        {back}
      </Card>
    )
  if (invite.from === user.uid)
    return (
      <Card title="This is your own invite link">
        <p>Send it to a friend. When they open it, they can accept and you’ll both see your match.</p>
        {back}
      </Card>
    )

  const sender = personFor(players, invite.from)
  const id = pairId(user.uid, invite.from)
  const openMatchup = (
    <a href={`#/compare/${id}`} className={`inline-block ${primaryCls}`}>
      Open matchup
    </a>
  )

  if (!accepting && (invite.acceptedBy === user.uid || alreadyPaired))
    return (
      <Card person={sender} title={`You’re comparing picks with ${firstName(sender)}`}>
        {openMatchup}
      </Card>
    )
  if (!accepting && invite.acceptedBy)
    return (
      <Card person={sender} title="This link was already used">
        <p>Each invite link works for one person. Ask {firstName(sender)} for a new one.</p>
        {back}
      </Card>
    )

  const accept = () => {
    setAccepting(true)
    acceptInvite(user, invite)
      .then((pair) => {
        window.location.hash = `#/compare/${pair}`
      })
      .catch((e: Error) => {
        setAcceptError(`Couldn’t accept (${e.message}). Reload the page and try again.`)
        setAccepting(false)
      })
  }

  return (
    <Card person={sender} title={`${sender.name} wants to compare picks with you`}>
      <p>
        {locked
          ? 'Accept to see your match, every team you split on, and who’s ahead.'
          : `Accept and you’ll both see how closely your picks match, starting now. Which teams you split on stays hidden until tip-off, ${tipOff()}.`}
      </p>
      <ErrorNote message={acceptError} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={accepting} onClick={accept} className={primaryCls}>
          {accepting ? 'Accepting…' : 'Accept'}
        </button>
        <a href="#/compare" className={linkCls}>
          No thanks
        </a>
      </div>
    </Card>
  )
}

function HeadToHead({ user, players, id, ...rest }: Props & { id: string }) {
  const members = id.split('_')
  const partner = members.find((m) => m !== user.uid)
  if (members.length !== 2 || !members.includes(user.uid) || !partner)
    return (
      <Card title="This matchup doesn’t exist">
        <a href="#/compare" className={linkCls}>
          See your matchups
        </a>
      </Card>
    )
  return <LiveMatchup {...rest} id={id} me={personFor(players, user.uid)} them={personFor(players, partner)} />
}

function LiveMatchup({
  id,
  me,
  them,
  pred,
  locked,
  standings,
}: {
  id: string
  me: Person
  them: Person
  pred: Prediction
  locked: boolean
  standings: Standings | null
}) {
  const exists = usePairExists(id)
  const { pred: theirs, error } = usePrediction(them.uid)

  if (exists === false)
    return (
      <Card person={them} title={`You’re not comparing with ${firstName(them)} anymore`}>
        <p>One of you stopped comparing. Send a new invite to start again.</p>
        <a href="#/compare" className={linkCls}>
          Go to Compare
        </a>
      </Card>
    )
  if (error) return <ErrorNote message={`Couldn’t load ${firstName(them)}’s picks (${error}). Reload to try again.`} />
  if (exists === undefined || !theirs) return <p className="px-1 text-ink-soft">Loading matchup…</p>

  return (
    <div className="space-y-5">
      <a href="#/compare" className={`inline-block px-1 text-sm ${linkCls}`}>
        All matchups
      </a>
      <MatchupView me={me} them={them} mine={pred} theirs={theirs} locked={locked} standings={standings} />
      <StopComparing id={id} them={them} />
    </div>
  )
}

// Everything below is plain props, no Firestore, so it renders the same for any two sheets.
export function MatchupView({
  me,
  them,
  mine,
  theirs,
  locked,
  standings,
}: {
  me: Person
  them: Person
  mine: Prediction
  theirs: Prediction
  locked: boolean
  standings: Standings | null
}) {
  const match = comparePredictions(mine, theirs)
  const scores = liveScores(locked, standings, mine, theirs)

  return (
    <div className="space-y-5">
      <h1 className="sr-only">
        You and {them.name}: {match.pct === null ? 'no match yet' : `${match.pct}% match`}
      </h1>
      <Sheet className="overflow-hidden">
        <JumpBall me={me} them={them} pct={match.pct} scores={scores} />
        <Summary match={match} them={them} mine={mine} theirs={theirs} locked={locked} />
      </Sheet>

      {locked && (
        <>
          <Splits match={match} mine={mine} theirs={theirs} them={them} standings={standings} />
          <SameCalls match={match} mine={mine} />
          <div className="grid gap-5 lg:grid-cols-2">
            {(['East', 'West'] as Conference[]).map((conf) => (
              <StandingsLines key={conf} conf={conf} mine={mine} theirs={theirs} them={them} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Two players facing each other across the half-court line, the match in the center circle.
function JumpBall({
  me,
  them,
  pct,
  scores,
}: {
  me: Person
  them: Person
  pct: number | null
  scores: readonly [number, number] | null
}) {
  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div aria-hidden className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-paint/25" />
      <Side person={me} label="You" score={scores?.[0]} side="left" />
      <div className="relative grid size-28 shrink-0 place-items-center rounded-full border-[3px] border-paint bg-sheet sm:size-40">
        <div aria-hidden className="absolute inset-3 rounded-full border-2 border-paint/20 sm:inset-5" />
        <div className="relative text-center">
          <div className="font-display text-5xl font-black leading-none sm:text-7xl">
            {pct ?? '–'}
            {pct !== null && <span className="text-2xl sm:text-4xl">%</span>}
          </div>
          <div className="text-xs font-semibold text-ink-soft sm:text-sm">match</div>
        </div>
      </div>
      <Side person={them} label={them.name} score={scores?.[1]} side="right" />
    </div>
  )
}

function Side({
  person,
  label,
  score,
  side,
}: {
  person: Person
  label: string
  score?: number
  side: 'left' | 'right'
}) {
  // Each player faces the circle: the left one lines up on its right edge, and the other way round.
  const facing = side === 'left' ? 'items-end text-right animate-tip-left' : 'items-start text-left animate-tip-right'
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${facing}`}>
      <Avatar player={person} size={64} />
      <div className="line-clamp-2 w-full font-semibold break-words">{label}</div>
      {score !== undefined && (
        <div>
          <div className="font-display text-5xl font-black leading-none">{score}</div>
          <div className="text-xs text-ink-soft">points</div>
        </div>
      )}
    </div>
  )
}

function Summary({
  match,
  them,
  mine,
  theirs,
  locked,
}: {
  match: Match
  them: Person
  mine: Prediction
  theirs: Prediction
  locked: boolean
}) {
  const name = firstName(them)
  const picked = (p: Prediction) => Object.keys(p.overUnder ?? {}).length > 0 || Boolean(p.east || p.west)
  const ouBoth = match.same.length + match.splits.length

  if (match.pct === null)
    return (
      <p className="border-t border-line px-4 py-4 text-ink-soft sm:px-8">
        {!picked(theirs)
          ? `${name} hasn’t made any picks yet. Your match shows up once they do.`
          : !picked(mine)
            ? 'Make some picks and your match shows up here.'
            : `Your match shows up once you and ${name} have picked some of the same teams.`}
      </p>
    )

  return (
    <div className="border-t border-line px-4 py-4 sm:px-8">
      <p className="max-w-prose">
        If {name}’s sheet were the final result, you’d score{' '}
        <span className="tabular font-semibold">
          {match.points} of {match.max}
        </span>
        .
      </p>
      <dl className="tabular mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-ink-soft">Over/unders</dt>
        <dd>{ouBoth ? `Same call on ${match.same.length} of ${ouBoth}` : 'No teams you’ve both picked yet'}</dd>
        <dt className="text-ink-soft">Standings</dt>
        <dd>
          {match.standingsMax
            ? `${match.standingsPts} of ${match.standingsMax} points for closeness`
            : 'Counts once you’ve both saved a conference'}
        </dd>
      </dl>
      {!locked && match.splits.length > 0 && (
        <p className="mt-3 text-sm text-ink-soft">
          You split on {match.splits.length} {match.splits.length === 1 ? 'team' : 'teams'}. Which ones shows at tip-off,{' '}
          {tipOff()}.
        </p>
      )}
    </div>
  )
}

function PickCell({ pick, standing, align }: { pick: Pick; standing: ReturnType<typeof ouOutcome>; align: 'left' | 'right' }) {
  return (
    <span className={`inline-flex flex-col gap-0.5 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <PickTag pick={pick} />
      <OutcomeMark pick={pick} outcome={standing} />
    </span>
  )
}

function Splits({
  match,
  mine,
  theirs,
  them,
  standings,
}: {
  match: Match
  mine: Prediction
  theirs: Prediction
  them: Person
  standings: Standings | null
}) {
  const teams = match.splits.map((id) => TEAM_BY_ID[id]).sort((a, b) => b.line - a.line)
  // The half-court line again: your call on the left of it, theirs on the right.
  const halfCourt = 'border-l-[3px] border-paint/25'

  return (
    <Sheet className="overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-2xl font-extrabold">
          Where you split <span className="tabular text-ink-soft">({teams.length})</span>
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Same calls score the same for both of you, so these decide the over/under race.
        </p>
      </div>
      {teams.length === 0 ? (
        <p className="px-4 py-6 text-ink-soft">You made the same call on every team you both picked.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-soft">
            <tr className="border-b border-line">
              <th className="py-2 pl-4 text-left font-medium">Team</th>
              <th className="w-24 py-2 pr-3 text-right font-medium sm:w-32">You</th>
              <th className={`w-24 py-2 pl-3 pr-4 text-left font-medium sm:w-32 ${halfCourt}`}>{firstName(them)}</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const standing = ouOutcome(team.line, standings?.[team.id])
              return (
                <tr key={team.id} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 pl-4">
                    <span className="flex min-w-0 items-center gap-2">
                      <TeamLogo team={team} size={24} />
                      <span className="font-semibold sm:hidden">{team.abbr.toUpperCase()}</span>
                      <span className="truncate font-semibold max-sm:hidden">{team.name}</span>
                      <span className="tabular text-ink-soft">{team.line}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <PickCell pick={mine.overUnder![team.id]} standing={standing} align="right" />
                  </td>
                  <td className={`py-2.5 pl-3 pr-4 ${halfCourt}`}>
                    <PickCell pick={theirs.overUnder![team.id]} standing={standing} align="left" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Sheet>
  )
}

function SameCalls({ match, mine }: { match: Match; mine: Prediction }) {
  if (match.same.length === 0) return null
  const teams = match.same.map((id) => TEAM_BY_ID[id]).sort((a, b) => b.line - a.line)
  return (
    <Sheet className="overflow-hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="font-display text-2xl font-extrabold">
            Same call <span className="tabular text-ink-soft">({teams.length})</span>
          </span>
          <svg width="14" height="9" viewBox="0 0 14 9" aria-hidden className="text-ink-soft transition-transform group-open:rotate-180">
            <path d="M1.5 1.5l5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </summary>
        <ul className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center gap-1.5 rounded-md bg-ink/5 py-1 pl-1.5 pr-1 text-sm">
              <TeamLogo team={team} size={18} />
              <span className="tabular font-semibold">{team.abbr.toUpperCase()}</span>
              <PickTag pick={mine.overUnder![team.id]} />
            </li>
          ))}
        </ul>
      </details>
    </Sheet>
  )
}

const ROW = 32 // px per seed row
const GAP_STYLES = [
  { label: 'Same spot', opacity: 0.22, test: (gap: number) => gap === 0 },
  { label: '1–2 spots apart', opacity: 0.5, test: (gap: number) => gap > 0 && gap < 3 },
  { label: '3+ apart, no points', opacity: 1, test: (gap: number) => gap >= 3 },
]
const gapOpacity = (gap: number) => GAP_STYLES.find((s) => s.test(gap))!.opacity

// Your conference order on the left, theirs on the right, one line per team. Flat lines agree; steep ones don't.
function StandingsLines({
  conf,
  mine,
  theirs,
  them,
}: {
  conf: Conference
  mine: Prediction
  theirs: Prediction
  them: Person
}) {
  const [active, setActive] = useState<string | null>(null)
  const a = savedOrder(mine, conf)
  const b = savedOrder(theirs, conf)
  const name = firstName(them)

  if (!a || !b)
    return (
      <Sheet className="overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-display text-2xl font-extrabold">{conf}</h2>
        <p className="px-4 py-6 text-ink-soft">
          {!a ? 'You' : name} didn’t save {!a && !b ? 'either' : 'an'} {conf} order, so there’s nothing to line up.
        </p>
      </Sheet>
    )

  const rows = a.map((id, i) => ({ id, mine: i + 1, theirs: b.indexOf(id) + 1 }))
  const pts = rows.reduce((sum, r) => sum + closenessPoints(r.mine, r.theirs), 0)
  // Steep lines draw last so they sit on top; the hovered team above everything.
  const drawOrder = [...rows].sort(
    (x, y) =>
      Number(x.id === active) - Number(y.id === active) ||
      Math.abs(x.mine - x.theirs) - Math.abs(y.mine - y.theirs),
  )
  const cols = 'grid grid-cols-[auto_minmax(2.5rem,1fr)_auto]'

  // The dot sits on the inner edge, where the team's line starts.
  const label = (id: string, seed: number, dot: 'left' | 'right') => {
    const team = TEAM_BY_ID[id]
    const lit = active === id
    const marker = (
      <span
        className={`relative z-10 size-2 shrink-0 rounded-full ring-2 ring-sheet ${lit ? 'bg-paint' : 'bg-ink'} ${
          dot === 'right' ? '-mr-1' : '-ml-1'
        }`}
      />
    )
    return (
      <span className="flex h-8 items-center gap-1.5 sm:gap-2">
        {dot === 'left' && marker}
        <span className="tabular w-5 text-right font-semibold">{seed}</span>
        <TeamLogo team={team} size={20} />
        <span className={`w-10 ${lit ? 'font-bold' : ''}`}>{team.abbr.toUpperCase()}</span>
        {dot === 'right' && marker}
      </span>
    )
  }

  return (
    <Sheet className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line px-4 py-3">
        <h2 className="font-display text-2xl font-extrabold">{conf}</h2>
        <span className="tabular text-sm text-ink-soft">{pts} of 45 points for closeness</span>
      </div>
      <div className={`${cols} px-4 pt-2 text-xs text-ink-soft`}>
        <span>You</span>
        <span />
        <span className="pl-3">{name}</span>
      </div>
      <div className={`${cols} px-4 pb-3 text-sm`} onMouseLeave={() => setActive(null)}>
        <ol>
          {rows.map((r) => (
            <li
              key={r.id}
              tabIndex={0}
              onMouseEnter={() => setActive(r.id)}
              onFocus={() => setActive(r.id)}
              onBlur={() => setActive(null)}
              className="rounded focus-visible:outline-offset-0"
            >
              <span aria-hidden>{label(r.id, r.mine, 'right')}</span>
              <span className="sr-only">
                {TEAM_BY_ID[r.id].name}: you have them {r.mine}, {name} has them {r.theirs}.
              </span>
            </li>
          ))}
        </ol>
        <svg
          aria-hidden
          viewBox={`0 0 100 ${rows.length * ROW}`}
          preserveAspectRatio="none"
          className="w-full text-ink"
          style={{ height: rows.length * ROW }}
        >
          {drawOrder.map((r) => {
            const lit = active === r.id
            return (
              <line
                key={r.id}
                x1={0}
                y1={(r.mine - 0.5) * ROW}
                x2={100}
                y2={(r.theirs - 0.5) * ROW}
                stroke={lit ? 'var(--color-paint)' : 'currentColor'}
                strokeOpacity={lit ? 1 : active ? 0.12 : gapOpacity(Math.abs(r.mine - r.theirs))}
                strokeWidth={lit ? 3 : 2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
        <ol aria-hidden>
          {b.map((id, i) => (
            <li key={id} onMouseEnter={() => setActive(id)}>
              {label(id, i + 1, 'left')}
            </li>
          ))}
        </ol>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-soft" aria-label="Line key">
        {GAP_STYLES.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden className="text-ink">
              <line x1="1" y1="2" x2="15" y2="2" stroke="currentColor" strokeOpacity={s.opacity} strokeWidth="2" strokeLinecap="round" />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

function StopComparing({ id, them }: { id: string; them: Person }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stop = () =>
    stopComparing(id)
      .then(() => {
        window.location.hash = '#/compare'
      })
      .catch((e: Error) => setError(`Couldn’t stop comparing (${e.message}). Try again.`))

  return (
    <div className="space-y-2 px-1 text-sm">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span>Stop comparing with {firstName(them)}? The matchup goes away for both of you.</span>
          <button type="button" onClick={stop} className="rounded-md bg-under px-3 py-1.5 font-semibold text-white hover:bg-under/85">
            Stop comparing
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={linkCls}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={linkCls}>
          Stop comparing
        </button>
      )}
      <ErrorNote message={error} />
    </div>
  )
}
