import { GAMES } from '../config'
import { TEAMS, TEAM_BY_ID, type Conference, type Team } from '../data/winTotals'

export type Pick = 'O' | 'U'
export type OverUnderPicks = Record<string, Pick>

export type Prediction = {
  overUnder?: OverUnderPicks
  east?: string[]
  west?: string[]
}

export type TeamRecord = { wins: number; losses: number; seed: number; conf: Conference }
export type Standings = Record<string, TeamRecord>

// How far an over/under pick moves a team when building the default standings order.
export const PICK_NUDGE = 3

export const MAX_OU = TEAMS.length
export const MAX_STANDINGS = TEAMS.length * 3
export const MAX_TOTAL = MAX_OU + MAX_STANDINGS

export function autoOrder(teams: Team[], picks: OverUnderPicks): string[] {
  const nudged = (t: Team) =>
    t.line + (picks[t.id] === 'O' ? PICK_NUDGE : picks[t.id] === 'U' ? -PICK_NUDGE : 0)
  return [...teams]
    .sort((a, b) => nudged(b) - nudged(a) || b.line - a.line || a.name.localeCompare(b.name))
    .map((t) => t.id)
}

// A conference order counts only once it's saved with all 15 of that conference's teams.
export function savedOrder(pred: Prediction, conf: Conference): string[] | null {
  const ids = conf === 'East' ? pred.east : pred.west
  const valid = ids?.length === 15 && ids.every((id) => TEAM_BY_ID[id]?.conf === conf)
  return valid ? ids : null
}

export const gamesPlayed = (r: TeamRecord) => r.wins + r.losses

export function projectedWins(r: TeamRecord): number | null {
  const gp = gamesPlayed(r)
  return gp === 0 ? null : (r.wins / gp) * GAMES
}

export type OuOutcome = { side: Pick; final: boolean }

// Which side of the line a team is on: clinched once it can't flip, otherwise by pace.
export function ouOutcome(line: number, r: TeamRecord | undefined): OuOutcome | null {
  if (!r || gamesPlayed(r) === 0) return null
  if (r.wins > line) return { side: 'O', final: true }
  if (GAMES - r.losses < line) return { side: 'U', final: true }
  return { side: projectedWins(r)! > line ? 'O' : 'U', final: false }
}

export function closenessPoints(predicted: number, actual: number): number {
  return Math.max(0, 3 - Math.abs(predicted - actual))
}

export const seasonStarted = (s: Standings) => Object.values(s).some((r) => gamesPlayed(r) > 0)

export type Score = {
  ou: number // correct over/under picks (clinched or on pace)
  ouClinched: number // of those, how many can no longer flip
  standings: number
  total: number
}

export function scorePrediction(pred: Prediction, standings: Standings): Score {
  let ou = 0
  let ouClinched = 0
  for (const [id, pick] of Object.entries(pred.overUnder ?? {})) {
    const team = TEAM_BY_ID[id]
    const outcome = team && ouOutcome(team.line, standings[id])
    if (outcome?.side === pick) {
      ou++
      if (outcome.final) ouClinched++
    }
  }

  let standingsPts = 0
  for (const order of [pred.east, pred.west]) {
    order?.forEach((id, i) => {
      const r = standings[id]
      if (r && gamesPlayed(r) > 0) standingsPts += closenessPoints(i + 1, r.seed)
    })
  }

  return { ou, ouClinched, standings: standingsPts, total: ou + standingsPts }
}
