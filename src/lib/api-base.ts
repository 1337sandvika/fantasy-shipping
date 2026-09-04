/**
 * Hosted production API for the Capacitor binary.
 *
 * The career sim itself is fully local (Zustand + localStorage). Auth,
 * scoreboard, and leagues stay on the existing TanStack Start backend.
 * Never put secrets in VITE_* — they ship in the client bundle.
 *
 * Unset on the regular web build so same-origin `/api/auth` and `/_serverFn`
 * keep working on grok.me / localhost.
 */
export const DEFAULT_API_BASE_URL = "https://palm-river-olive-field.grok.me";

export function readApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

export function isNativeClientOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return (
    origin.startsWith("capacitor:") ||
    origin.startsWith("ionic:") ||
    origin === "https://localhost" ||
    origin === "http://localhost"
  );
}

/** Paths that must hit the hosted Start/Better Auth backend from the native app. */
export function isHostedApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_serverFn") ||
    pathname.startsWith("/__server") ||
    pathname.startsWith("/api/auth")
  );
}
