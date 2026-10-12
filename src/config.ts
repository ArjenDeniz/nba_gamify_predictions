// ESPN numbers seasons by the year they end: 2027 = the 2026-27 season.
export const SEASON = 2027
export const SEASON_LABEL = '2026–27'
export const GAMES = 82

// Opening night first tip (Celtics at Pistons). Keep in sync with LOCK_MS in firestore.rules.
export const LOCK_AT = new Date('2026-10-20T19:00:00Z')

export const isLocked = (now = new Date()) => now.getTime() >= LOCK_AT.getTime()

// Firebase web config is public by design; access is enforced by firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyC8HuXzyu5NR2kx6DCWa2bxgk7QfeV5lto',
  authDomain: 'nba-pickem-2627.firebaseapp.com',
  projectId: 'nba-pickem-2627',
  storageBucket: 'nba-pickem-2627.firebasestorage.app',
  messagingSenderId: '893395267020',
  appId: '1:893395267020:web:705de5a26a0e9a89478169',
}
