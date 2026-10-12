# NBA Pick'em 2026–27

Season predictions for a group of friends:

- **Over/Under**: pick over or under on every team's Vegas win total (`src/data/winTotals.ts`). Under each team you
  see which way the crowd leans once 3 players take the same side ("5+ picked over"), rounded down to 3, 5, 10, 15 or 20.
- **Standings**: rank each conference 1–15. The order starts from the lines, nudged 3 wins by your over/under picks, then you drag to finalize.
- **Leaderboard**: scores against live ESPN standings, refreshed every minute.
- **Compare**: send a friend a single-use invite link. Once they accept, you both see your match: one sheet scored
  against the other as if it were the final result. Before lock that's only the totals and how many teams you split on;
  after lock you see every split, both standings orders side by side, and live scores.

Picks lock at opening tip, 2026-10-20 19:00 UTC. Until then nobody can read anyone else's picks (enforced in `firestore.rules`).
The only shared pick data before lock is the per-team count of overs and unders in `tallies/{teamId}`. The rules only
accept a count change when it matches your own pick changing in the same write. The board rounds the counts, but
the stored numbers are exact, so anyone poking at the database can see them.

The one exception is Compare. Accepting an invite creates `pairs/{uidA_uidB}` (together with marking the invite used,
which makes links single-use), and the rules let the two players read each other's picks while that pair exists. The
browser needs both sheets to compute the match, so the "totals only until tip-off" part is the page's choice, not
the rules': a paired player poking at the database can see the full sheet. Either player can stop comparing to end it.

## Scoring

- Over/under: 1 point per correct pick (30 max). Mid-season, picks count by current pace and become final once clinched.
- Standings: per team, exact spot is 3 points, 1 off is 2, 2 off is 1 (90 max).

## Stack

Vite + React + TypeScript + Tailwind, Firebase Auth (Google) and Firestore, hosted on Vercel. There's no backend: the browser reads ESPN's public standings API directly.

## Setup

The Firebase web API key lives in Vercel env vars, not the repo. It's restricted to the site's domains
(plus `localhost:5173`) and to the Auth and Firestore APIs.

```sh
vercel env pull .env.local   # gets VITE_FIREBASE_API_KEY
```

## Scripts

```sh
npm run dev          # local dev server
npm test             # scoring unit tests
npm run test:rules   # checks firestore.rules via the Firebase Rules API (needs gcloud auth)
npm run deploy:rules # deploy firestore.rules
npm run recount      # rebuilds the crowd counts from everyone's picks (needs gcloud auth)
npm run build
```

## Changing the lock time or lines

- Lock time is in two places: `LOCK_AT` in `src/config.ts` and `lockTime()` in `firestore.rules`. Update both, then run `npm run deploy:rules`.
- Lines are in `src/data/winTotals.ts`.
