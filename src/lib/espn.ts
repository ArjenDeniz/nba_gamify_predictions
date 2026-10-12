import { useEffect, useState } from 'react'
import { SEASON } from '../config'
import type { Conference } from '../data/winTotals'
import type { Standings } from './scoring'

// ESPN mirrors the official NBA standings and, unlike nba.com, allows browser requests.
const STANDINGS_URL = `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${SEASON}&seasontype=2`
const POLL_MS = 60_000

type EspnStat = { name: string; value?: number }
type EspnEntry = { team: { id: string }; stats: EspnStat[] }
type EspnConference = { abbreviation: string; standings: { entries: EspnEntry[] } }

export async function fetchStandings(): Promise<Standings> {
  const res = await fetch(STANDINGS_URL)
  if (!res.ok) throw new Error(`ESPN standings returned ${res.status}`)
  const data: { children: EspnConference[] } = await res.json()

  const standings: Standings = {}
  for (const conf of data.children) {
    const records = conf.standings.entries.map((entry) => {
      const stat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0
      return {
        id: entry.team.id,
        wins: stat('wins'),
        losses: stat('losses'),
        seed: stat('playoffSeed'),
        conf: conf.abbreviation as Conference,
      }
    })
    // ESPN reports seed 0 until games are played; fall back to win percentage so ranks are always 1-15.
    if (records.some((r) => r.seed < 1)) {
      const pct = (r: (typeof records)[number]) => r.wins / Math.max(1, r.wins + r.losses)
      records.sort((a, b) => pct(b) - pct(a) || b.wins - a.wins).forEach((r, i) => (r.seed = i + 1))
    }
    for (const { id, ...rec } of records) standings[id] = rec
  }
  return standings
}

export function useStandings() {
  const [standings, setStandings] = useState<Standings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetchStandings()
        .then((s) => {
          if (cancelled) return
          setStandings(s)
          setUpdatedAt(new Date())
          setError(null)
        })
        .catch((e: Error) => !cancelled && setError(e.message))
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return { standings, error, updatedAt }
}
