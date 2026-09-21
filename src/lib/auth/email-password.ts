/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;

/**
 * Immediate session on sign-up (no email round-trip). App Review has no inbox
 * we can count on, and the native shell stores the bearer token from this response.
 */
export const emailAndPassword = {
  enabled: true,
  autoSignIn: true,
  minPasswordLength: 8,
  maxPasswordLength: 128,
} as const;
