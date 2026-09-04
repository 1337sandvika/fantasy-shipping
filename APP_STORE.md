# Fantasy Shipping — App Store path (iOS / Capacitor)

This repo now wraps the **existing web game** in Capacitor. The career sim
(ships, ports, cargo, saves) is a local JavaScript app and is **copied into
the iOS binary**. It is not a remote-only WebView of
https://palm-river-olive-field.grok.me (Apple Guideline 4.2).

Sign-in, the public scoreboard, and leagues still use that hosted backend.
No Apple or API secrets belong in this repo.

| Item | Value |
| --- | --- |
| Display name | Fantasy Shipping |
| Bundle ID | `com.fantasyshipping.app` |
| Capacitor `webDir` | `www/` (generated, not committed) |
| Production API | `https://palm-river-olive-field.grok.me` |
| Privacy policy (web) | https://palm-river-olive-field.grok.me/privacy |

Change the bundle ID in `capacitor.config.ts` (`appId`) and in Xcode if you
already registered a different one in App Store Connect.

---

## What this PR already did

- Capacitor 8 + iOS platform project (`ios/`)
- `npm run build:ios` — SPA build of the game into `www/`
- `npm run cap:sync` — rebuild `www/` and copy it into the Xcode project
- Status bar / splash colors (`#071018`), safe-area padding, `viewport-fit=cover`
- Native app talks to the hosted API via `VITE_API_BASE_URL` (no secrets)
- Email/password sign-in on iOS (Google / X buttons stay hidden in the
  WKWebView so you do **not** have to ship Sign in with Apple for v1)
- CORS + origin allow-list on the **hosted** server for `capacitor://localhost`

You still have to: Apple Developer Program, Xcode signing, screenshots,
privacy answers, and the Connect upload. This PR does **not** submit the app.

---

## What you do on a Mac (non-expert checklist)

### 0. One-time Apple accounts

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/)
   ($99 / year) with the Apple ID you will use in Xcode.
2. In [App Store Connect](https://appstoreconnect.apple.com) → **Apps** →
   **+** → iOS app.
   - Name: **Fantasy Shipping**
   - Bundle ID: register `com.fantasyshipping.app` (or match whatever you set)
   - SKU: e.g. `fantasy-shipping-ios`
   - User access: full access is fine for a solo developer

### 1. Install tools

- macOS with **Xcode 26+** (Capacitor 8). From the Mac App Store, then open
  Xcode once and install additional components.
- Xcode → Settings → **Accounts** → add your Apple ID → manage certificates
  → let Xcode create an **Apple Development** and **Apple Distribution**
  certificate if it offers to.
- Node 22 LTS (https://nodejs.org).

### 2. Build the local web bundle and open Xcode

```bash
git clone https://github.com/1337sandvika/fantasy-shipping.git
cd fantasy-shipping
npm install
npm run cap:sync
npm run cap:open
```

`cap:open` launches `ios/App/App.xcodeproj` (or the `.xcworkspace` if you
see one). If `cap:open` fails, open that file yourself in Xcode.

Optional: point the iOS binary at a different host (custom domain later):

```bash
VITE_API_BASE_URL=https://your-domain.example npm run cap:sync
```

Redeploy the **website** from this branch first if you want sign-in / the
scoreboard to work from the phone. Until that deploy, the **game still
plays offline**; only account features talk to the server.

### 3. Signing (the step most people get stuck on)

1. In Xcode’s left sidebar, click the blue **App** project → target **App**.
2. **Signing & Capabilities**
   - Check **Automatically manage signing**
   - Team: your Developer Program team
   - Bundle Identifier: `com.fantasyshipping.app`
3. Plug in an iPhone or pick **Any iOS Device** (not a Simulator) for Archive.
4. Product → **Destination** → **Any iOS Device (arm64)**.

If Xcode complains about the bundle ID, create that identifier under
[Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).

### 4. Icons and splash (do this before review)

This repo ships a source image at `resources/icon-source.jpg` (same art as
the web OG card) and notes in `resources/README.md`.

On your Mac:

```bash
npx @capacitor/assets generate --ios --iconBackgroundColor '#071018' --splashBackgroundColor '#071018'
npx cap sync ios
```

Or in Xcode: replace **AppIcon** in `ios/App/App/Assets.xcassets` with a
1024×1024 PNG (no transparency for the App Store icon).

Apple rejects placeholder/generic icons.

### 5. Archive and upload

1. Product → **Archive** (this takes a few minutes).
2. Organizer window → **Distribute App** → **App Store Connect** → Upload.
3. Wait for processing email / the build to appear under TestFlight.

TestFlight: add yourself as an internal tester, install TestFlight on your
iPhone, run through a career (buy a hull, load cars, finish a voyage).

### 6. App Store Connect metadata you must fill

Nothing here is submitted for you.

- **Privacy Policy URL** (required):  
  `https://palm-river-olive-field.grok.me/privacy`  
  Host the same page on your own domain if you later leave grok.me.
- **Support URL**: a page or GitHub Issues URL you actually monitor.
- **Description**: worldwide RoRo career sim — buy hulls, load cars and
  High & Heavy, bunker LNG, pay EU ETS. Offline career save on device.
- **Keywords**: shipping, ro-ro, tycoon, simulation, cargo, …
- **Category**: Games → Simulation (or Strategy).
- **Age rating**: complete the questionnaire. Suggested answers for *this*
  build: no unrestricted web, no user-generated public chat, no violence
  beyond abstract business events. Likely **4+** or **9+**. Do not guess
  if you later add chat or real-money gambling.
- **Screenshots** (required, take them from the Simulator or a device):
  - 6.7" iPhone (e.g. 1290 × 2796) — title, map/voyage, port, scoreboard
  - Plus a second size if Connect still asks (6.5" or iPad)
- **Export compliance**: the app only uses standard HTTPS. In Connect, say
  you use encryption only for HTTPS **or** set
  `ITSAppUsesNonExemptEncryption` to `NO` in Info.plist (already set in
  the Xcode project when present).
- **Advertising**: none.
- **In-App Purchases**: none in this build. If you later add paid unlocks,
  they **must** use Apple IAP — not Stripe — on iOS.
- **Sign in with Apple**: not required while Google/X stay hidden on iOS
  (email/password + guest play). If you turn social login back on in the
  binary, add Sign in with Apple first.

### 7. Privacy “nutrition label” (Connect → App Privacy)

Collects **only if the player signs in**:

| Data | Linked to identity? | Used for tracking? |
| --- | --- | --- |
| Email (account) | Yes | No |
| Gameplay / career scores posted to leagues | Yes | No |
| Product interaction (optional analytics — we do not ship any) | — | No |

Guest play stores the save in **on-device** `localStorage` only.

Account deletion is on the privacy page (signed-in users).

---

## Architecture (why this is not a thin wrapper)

```
iOS app (WKWebView)
  └── bundled www/   ← full React game, art, audio, local saves
        ├── career sim     localStorage, no network required
        └── optional API   https://palm-river-olive-field.grok.me
              /api/auth/*  email sign-in (bearer token in the native app)
              /_serverFn/* scoreboard + leagues
```

`__Host-` session cookies cannot be used from `capacitor://localhost`
(cross-site). The native client stores a Better Auth bearer token instead.
The hosted app must be deployed from a commit that includes the Capacitor
CORS / origin allow-list (this branch).

### What must stay server-side

- Postgres / Better Auth / league tables
- `DATABASE_URL`, `BETTER_AUTH_SECRET`, Grok auth broker secrets  
  These stay on the host. Never paste them into Xcode or this git repo.

### What ships in the client

- All of `src/game/**`, `public/game/**`, UI, i18n
- Capacitor config and the iOS project

---

## Commands (reference)

| Command | What it does |
| --- | --- |
| `npm run build` | Existing **website** production build (Vercel / grok.me). Unchanged. |
| `npm run build:ios` | SPA build → `www/` |
| `npm run cap:sync` | `build:ios` + `npx cap sync ios` |
| `npm run cap:open` | Open the Xcode project (Mac only) |
| `npx cap sync ios` | Copy a pre-built `www/` into `ios/` |

Linux CI can run `npm run build:ios` and `npx cap sync ios` to prove the
web bundle copies. It cannot Archive or codesign (no Xcode).

---

## You must still do manually

- [ ] Apple Developer Program enrollment
- [ ] App Store Connect app record + bundle ID
- [ ] Xcode signing team
- [ ] Final 1024px App Icon (replace the placeholder)
- [ ] Screenshots + review notes
- [ ] Privacy policy URL you control long-term
- [ ] Deploy this branch to the hosted backend so native sign-in/CORS work
- [ ] Archive → Upload → submit for review
- [ ] If you add Google/X to the iOS UI: Sign in with Apple
- [ ] If you add paid content: StoreKit IAP

Do not commit `.p12` certificates, AuthKey `.p8` files, or provisioning
profiles.
