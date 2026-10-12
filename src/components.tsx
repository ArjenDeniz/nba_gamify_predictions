import type { ReactNode } from 'react'
import { logoUrl, type Team } from './data/winTotals'
import type { OuOutcome, Pick } from './lib/scoring'

export function TeamLogo({ team, size = 32 }: { team: Team; size?: number }) {
  return (
    <img
      src={logoUrl(team)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  )
}

export function Sheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl bg-sheet shadow-[0_1px_0_rgb(110_64_24/0.25),0_10px_30px_-18px_rgb(60_30_5/0.6)] ${className}`}
    >
      {children}
    </section>
  )
}

const pickWord = (p: Pick) => (p === 'O' ? 'Over' : 'Under')

export function PickTag({ pick }: { pick: Pick }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white ${
        pick === 'O' ? 'bg-over' : 'bg-under'
      }`}
    >
      {pickWord(pick)}
    </span>
  )
}

// How a pick is doing against live results.
export function OutcomeMark({ pick, outcome }: { pick?: Pick; outcome: OuOutcome | null }) {
  if (!pick || !outcome) return null
  const right = pick === outcome.side
  const label = outcome.final ? (right ? 'Hit' : 'Missed') : right ? 'On pace' : 'Off pace'
  return (
    <span
      className={`text-xs font-semibold ${right ? 'text-over' : 'text-under'} ${outcome.final ? '' : 'opacity-75'}`}
    >
      {label}
    </span>
  )
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-under/10 px-3 py-2 text-sm text-under">
      {message}
    </p>
  )
}
