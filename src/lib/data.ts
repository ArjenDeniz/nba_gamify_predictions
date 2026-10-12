import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  collection,
  deleteField,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useRef, useState } from 'react'
import { TEAMS, type Conference } from '../data/winTotals'
import { tallyDelta, type Tally } from './crowd'
import { auth, db } from './firebase'
import type { Pick, Prediction } from './scoring'

export type Player = {
  uid: string
  name: string
  photoURL: string | null
  ouCount: number
  standingsDone: boolean
}

export function useAuthUser() {
  // undefined while Firebase restores the session, null when signed out
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return user
}

function playerFields(user: User, pred: Prediction) {
  const ouCount = TEAMS.filter((t) => pred.overUnder?.[t.id]).length
  return {
    name: user.displayName ?? user.email ?? 'Anonymous',
    photoURL: user.photoURL ?? null,
    ouCount,
    standingsDone: Boolean(pred.east?.length && pred.west?.length),
    updatedAt: serverTimestamp(),
  }
}

// Writes the prediction change and the public progress summary together. A changed over/under
// pick also moves that team's public counts; the rules reject counts that don't match the pick.
function save(user: User, patch: Record<string, unknown>, next: Prediction, tally?: { teamId: string; delta: Tally }) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'predictions', user.uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  batch.set(doc(db, 'players', user.uid), playerFields(user, next))
  if (tally) {
    const { O, U } = tally.delta
    batch.set(doc(db, 'tallies', tally.teamId), { O: increment(O), U: increment(U) }, { merge: true })
  }
  return batch.commit()
}

export function useMyPrediction(user: User, editable: boolean) {
  const [pred, setPred] = useState<Prediction | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'predictions', user.uid),
        (snap) => setPred((snap.data() as Prediction | undefined) ?? {}),
        (e) => setError(e.message),
      ),
    [user.uid],
  )

  // Register in the "who's in" list as soon as someone signs in; later writes go through save().
  const registered = useRef(false)
  useEffect(() => {
    if (!pred || !editable || registered.current) return
    registered.current = true
    const batch = writeBatch(db)
    batch.set(doc(db, 'players', user.uid), playerFields(user, pred))
    batch.commit().catch((e: Error) => setError(e.message))
  }, [pred, editable, user])

  const report = (p: Promise<void>) => p.then(() => setError(null)).catch((e: Error) => setError(e.message))

  const setPick = (teamId: string, pick: Pick | null) => {
    if (!pred) return
    const overUnder = { ...pred.overUnder }
    if (pick) overUnder[teamId] = pick
    else delete overUnder[teamId]
    const delta = tallyDelta(pred.overUnder?.[teamId], pick)
    const tally = delta.O || delta.U ? { teamId, delta } : undefined
    report(save(user, { overUnder: { [teamId]: pick ?? deleteField() } }, { ...pred, overUnder }, tally))
  }

  const setOrder = (conf: Conference, ids: string[]) => {
    if (!pred) return
    const key = conf === 'East' ? 'east' : 'west'
    report(save(user, { [key]: ids }, { ...pred, [key]: ids }))
  }

  return { pred, error, setPick, setOrder }
}

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  useEffect(
    () =>
      onSnapshot(collection(db, 'players'), (snap) =>
        setPlayers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Player, 'uid'>) }))),
      ),
    [],
  )
  return players
}

// How many players took each side of every line. Readable before lock; only counts, never who.
export function useTallies() {
  const [tallies, setTallies] = useState<Record<string, Tally>>({})
  useEffect(
    () =>
      onSnapshot(collection(db, 'tallies'), (snap) =>
        setTallies(Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as Tally]))),
      ),
    [],
  )
  return tallies
}

// Everyone's picks; the security rules only allow this once picks are locked.
export function useAllPredictions(enabled: boolean) {
  const [preds, setPreds] = useState<Record<string, Prediction>>({})
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let retry: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = onSnapshot(
      collection(db, 'predictions'),
      (snap) => {
        setPreds(Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as Prediction])))
        setError(null)
      },
      (e) => {
        // Right at lock time a fast device clock can beat the server's; try again shortly.
        setError(`Couldn’t load everyone’s picks yet (${e.code}). Retrying…`)
        retry = setTimeout(() => setAttempt((n) => n + 1), 15_000)
      },
    )
    return () => {
      unsubscribe()
      clearTimeout(retry)
    }
  }, [enabled, attempt])
  return { preds, error }
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
