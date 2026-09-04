# Fantasy Shipping

Worldwide RoRo (PCTC) career sim. Buy hulls, load cars and High & Heavy, bunker LNG, pay EU ETS on EEA legs.

Built as a web app (TanStack Start). Next step: Capacitor wrap for App Store / Play.

## Run

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run preview
```

Auth (email/password + optional Google/X) and the scoreboard need a database in production (`DATABASE_URL`). Local preview uses PGLite.

## App Store notes

- Free web game today — no in-app purchases.
- For iOS, digital unlocks must use Apple IAP; do not add Stripe for that.
- Sign in with Apple is required if Google/X stay in the iOS binary. Email-only avoids that for v1.

## Stack

TanStack Start, React 19, Tailwind v4, Zustand, Better Auth, PGLite/Postgres.
