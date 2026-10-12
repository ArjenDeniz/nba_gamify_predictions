import { describe, expect, it } from 'vitest'
import { TEAMS, teamsIn } from '../data/winTotals'
import {
  MAX_TOTAL,
  autoOrder,
  closenessPoints,
  ouOutcome,
  projectedWins,
  scorePrediction,
  type Standings,
  type TeamRecord,
} from './scoring'

const rec = (wins: number, losses: number, seed = 1): TeamRecord => ({ wins, losses, seed, conf: 'East' })

describe('autoOrder', () => {
  const east = teamsIn('East')

  it('orders by line when there are no picks', () => {
    const order = autoOrder(east, {})
    expect(order[0]).toBe('18') // Knicks 52.5
    expect(order.at(-1)).toBe('17') // Nets 24.5
    expect(order).toHaveLength(15)
  })

  it('nudges overs up and unders down', () => {
    // Celtics 51.5 + 3 jumps the Knicks 52.5; Knicks under drops to 49.5.
    const order = autoOrder(east, { '2': 'O', '18': 'U' })
    expect(order[0]).toBe('2')
    expect(order.indexOf('18')).toBeGreaterThan(order.indexOf('20')) // below 76ers 50.5
  })

  it('breaks nudged ties by the original line', () => {
    // Pistons 49.5 + 3 = 52.5 ties the Knicks; Knicks keep the higher raw line.
    const order = autoOrder(east, { '8': 'O' })
    expect(order.slice(0, 2)).toEqual(['18', '8'])
  })
})

describe('projectedWins', () => {
  it('is null before any games', () => expect(projectedWins(rec(0, 0))).toBeNull())
  it('extrapolates win pace to 82 games', () => expect(projectedWins(rec(30, 11))).toBe(60))
})

describe('ouOutcome', () => {
  it('is pending before tip-off', () => expect(ouOutcome(45.5, rec(0, 0))).toBeNull())
  it('follows pace mid-season', () => {
    expect(ouOutcome(45.5, rec(15, 5))).toEqual({ side: 'O', final: false })
    expect(ouOutcome(45.5, rec(5, 15))).toEqual({ side: 'U', final: false })
  })
  it('clinches the over once wins pass the line', () =>
    expect(ouOutcome(45.5, rec(46, 20))).toEqual({ side: 'O', final: true }))
  it('clinches the under once the line is out of reach', () =>
    expect(ouOutcome(45.5, rec(30, 37))).toEqual({ side: 'U', final: true }))
  it('is final at 82 games', () => expect(ouOutcome(45.5, rec(45, 37))?.final).toBe(true))
})

describe('closenessPoints', () => {
  it.each([
    [5, 5, 3],
    [5, 6, 2],
    [5, 3, 1],
    [5, 8, 0],
    [1, 15, 0],
  ])('predicted %i, actual %i → %i', (p, a, pts) => expect(closenessPoints(p, a)).toBe(pts))
})

describe('scorePrediction', () => {
  const lines = Object.fromEntries(TEAMS.map((t) => [t.id, t.line]))

  // Final standings where every team lands exactly on its line + 0.5 (all overs hit), seeded by line.
  const perfect: Standings = {}
  for (const conf of ['East', 'West'] as const) {
    autoOrder(teamsIn(conf), {}).forEach((id, i) => {
      const wins = lines[id] + 0.5
      perfect[id] = { wins, losses: 82 - wins, seed: i + 1, conf }
    })
  }

  it('scores a perfect sheet at the maximum', () => {
    const allOver = Object.fromEntries(TEAMS.map((t) => [t.id, 'O' as const]))
    const score = scorePrediction(
      { overUnder: allOver, east: autoOrder(teamsIn('East'), {}), west: autoOrder(teamsIn('West'), {}) },
      perfect,
    )
    expect(score).toEqual({ ou: 30, ouClinched: 30, standings: 90, total: MAX_TOTAL })
    expect(MAX_TOTAL).toBe(120)
  })

  it('scores nothing before the season starts', () => {
    const zero: Standings = Object.fromEntries(
      TEAMS.map((t, i) => [t.id, { wins: 0, losses: 0, seed: (i % 15) + 1, conf: t.conf }]),
    )
    const score = scorePrediction(
      { overUnder: { '1': 'O' }, east: autoOrder(teamsIn('East'), {}) },
      zero,
    )
    expect(score.total).toBe(0)
  })

  it('handles a partial sheet', () => {
    const score = scorePrediction({ overUnder: { '18': 'O', '17': 'U' } }, perfect)
    expect(score).toEqual({ ou: 1, ouClinched: 1, standings: 0, total: 1 })
  })
})
