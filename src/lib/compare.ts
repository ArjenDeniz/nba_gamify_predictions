import type { User } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'
import type { Prediction } from './scoring'

export type Invite = { token: string; from: string; acceptedBy?: string; createdAt?: Timestamp | null }
export type Pair = { id: string; members: string[] }

// One doc per two players, the same whoever invited whom. firestore.rules builds the id the same way.
export const pairId = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`)
export const partnerOf = (pair: Pair, me: string) => pair.members.find((m) => m !== me) ?? me

export const inviteUrl = (token: string) => `${window.location.origin}${window.location.pathname}#/invite/${token}`

export const createInvite = (user: User) =>
  addDoc(collection(db, 'invites'), { from: user.uid, createdAt: serverTimestamp() })

export const cancelInvite = (token: string) => deleteDoc(doc(db, 'invites', token))

// Marks the invite used and creates the pair in one write; the rules only allow the two together,
// which is what makes a link single-use.
export async function acceptInvite(user: User, invite: Invite) {
  const id = pairId(user.uid, invite.from)
  const batch = writeBatch(db)
  batch.update(doc(db, 'invites', invite.token), { acceptedBy: user.uid })
  batch.set(doc(db, 'pairs', id), {
    members: [user.uid, invite.from].sort(),
    invite: invite.token,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return id
}

export const stopComparing = (id: string) => deleteDoc(doc(db, 'pairs', id))

// Your links nobody has accepted yet, newest first.
export function useMyInvites(uid: string) {
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'invites'), where('from', '==', uid)),
        (snap) => {
          const created = (i: Invite) => i.createdAt?.toMillis() ?? Infinity // still being written
          setInvites(
            snap.docs
              .map((d) => ({ token: d.id, ...(d.data() as Omit<Invite, 'token'>) }))
              .filter((i) => !i.acceptedBy)
              .sort((a, b) => created(b) - created(a)),
          )
          setError(null)
        },
        (e) => setError(e.message),
      ),
    [uid],
  )
  return { invites, error }
}

// undefined while loading, null when the link doesn't exist (never did, or was cancelled).
export function useInvite(token: string) {
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'invites', token),
        (snap) => setInvite(snap.exists() ? { token, ...(snap.data() as Omit<Invite, 'token'>) } : null),
        (e) => setError(e.message),
      ),
    [token],
  )
  return { invite, error }
}

export function usePairs(uid: string) {
  const [pairs, setPairs] = useState<Pair[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'pairs'), where('members', 'array-contains', uid)),
        (snap) => {
          setPairs(snap.docs.map((d) => ({ id: d.id, members: (d.data() as Omit<Pair, 'id'>).members })))
          setError(null)
        },
        (e) => setError(e.message),
      ),
    [uid],
  )
  return { pairs, error }
}

// undefined while loading.
export function usePairExists(id: string | null) {
  const [exists, setExists] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!id) return
    return onSnapshot(
      doc(db, 'pairs', id),
      (snap) => setExists(snap.exists()),
      () => setExists(false),
    )
  }, [id])
  return id ? exists : false
}

// Someone else's sheet. Before lock the rules only allow this while you're paired with them.
export function usePrediction(uid: string) {
  const [pred, setPred] = useState<Prediction | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'predictions', uid),
        (snap) => {
          setPred((snap.data() as Prediction | undefined) ?? {})
          setError(null)
        },
        (e) => setError(e.code),
      ),
    [uid],
  )
  return { pred, error }
}
