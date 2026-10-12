import type { Pick } from './scoring'

// How many players have each side of a team's line, stored in the public tallies collection.
export type Tally = { O: number; U: number }

// Counts round down to these steps, so the board shows which way the crowd leans without exact
// numbers. Under the first step nothing shows.
export const CROWD_STEPS = [3, 5, 10, 15, 20]

export type Lean = { side: Pick; atLeast: number }

// The side most players took, or null when it's tied or too few players took it.
export function crowdLean(t: Tally | undefined): Lean | null {
  if (!t || t.O === t.U) return null
  const side: Pick = t.O > t.U ? 'O' : 'U'
  const atLeast = CROWD_STEPS.findLast((step) => step <= t[side])
  return atLeast ? { side, atLeast } : null
}

// How changing a pick moves a team's counts: the old side loses one and the new side gains one.
export function tallyDelta(before: Pick | undefined, after: Pick | null): Tally {
  const delta = (side: Pick) => (after === side ? 1 : 0) - (before === side ? 1 : 0)
  return { O: delta('O'), U: delta('U') }
}
