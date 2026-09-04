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

## App Store (iOS)

Capacitor wraps the **bundled** web game (not a remote-only WebView). See
**[APP_STORE.md](./APP_STORE.md)** for the Mac / Xcode / Connect checklist.

```bash
npm install
npm run cap:sync    # SPA build → www/ → ios/
npm run cap:open    # Mac only: open Xcode
```

- Bundle ID: `com.fantasyshipping.app`
- Display name: Fantasy Shipping
- Career sim is offline (localStorage). Auth and leagues call
  `https://palm-river-olive-field.grok.me` (`VITE_API_BASE_URL`).
- Free game today — no in-app purchases. Digital unlocks on iOS must use Apple IAP.
- Sign in with Apple is required only if Google/X stay in the iOS binary.
  Email-only (already hidden on iOS WKWebView) avoids that for v1.

## Stack

TanStack Start, React 19, Tailwind v4, Zustand, Better Auth, PGLite/Postgres.
