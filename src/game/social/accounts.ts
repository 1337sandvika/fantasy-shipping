/**
 * Friends / challenges extension point
 * ===================================
 *
 * Today this layer is local-first (`localStorage` key `fs-social-v1`). Career saves
 * stay on `uecc-ports-of-call-v2` and are never rewritten by social state.
 *
 * Already on the server (do not duplicate):
 * - Auth + captains — `src/lib/auth/*`, `migrations/0001_auth.sql`
 * - Career scoreboard — `src/game/score-api.ts` `submitCareer` / `listMyCareers` / `listGlobalBoard`
 * - Friend groups (private leagues, invite codes, seasons, teams) — `createLeague` /
 *   `joinLeague` / `listMyLeagues` / `listLeagueBoard`, migrations `0002`–`0004`
 * - House tournaments — `listOfficial` / `joinOfficial`, migration `0005_official.sql`
 *
 * Hook a real friends backend later by replacing the stubs below with
 * `createServerFn` routes that use `authMiddleware` and `context.userId`
 * (never a client-sent user id). Suggested shape:
 *
 *   POST   /challenges          { kind, target, opponentUserId, leagueId? }
 *   POST   /challenges/join     { code }
 *   POST   /challenges/:id/progress  { progress }   // server trusts the signed-in user
 *   GET    /friends             league members + accepted handles
 *   GET    /dailies             optional: same UTC seed as `dailies.ts` so everyone
 *                               shares the day's craft (already deterministic client-side)
 *
 * League mates are imported as friend stubs (`source: "league"`, optional `userId`)
 * from `listLeagueBoard` rows. That is the join between private seasons and
 * lightweight voyage/harbour challenges.
 *
 * Daily objectives stay on-device so guests and the offline iOS career keep
 * working. When you add a server copy, keep the same date-seeded catalog so
 * a signed-in board can show "today's harbour" without a login bonus.
 */
export const SOCIAL_SYNC = {
  version: 1,
  storageKey: "fs-social-v1",
  careerSaveKey: "uecc-ports-of-call-v2",
  server: null as null | {
    createChallenge: (input: { kind: string; target: number; opponentUserId: string }) => Promise<{ id: string; code: string }>;
    joinChallenge: (code: string) => Promise<{ id: string }>;
    pushProgress: (id: string, progress: number) => Promise<void>;
  },
} as const;

/** Call from a future accounts module once the routes exist. */
export function attachSocialServer(api: NonNullable<(typeof SOCIAL_SYNC)["server"]>) {
  (SOCIAL_SYNC as { server: typeof api }).server = api;
}
