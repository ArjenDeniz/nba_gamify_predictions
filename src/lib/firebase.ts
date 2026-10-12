import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig } from '../config'

if (!firebaseConfig.apiKey) throw new Error('VITE_FIREBASE_API_KEY is not set. Run `vercel env pull .env.local`.')

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
export const logOut = () => signOut(auth)
