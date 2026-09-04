/**
 * First-party Capacitor WebView origins. The iOS wrapper loads bundled assets
 * from these origins and calls the hosted API cross-origin.
 *
 * Keep this module dependency-free so both the browser bundle and the
 * Better Auth / isolation server paths can import it.
 */
export const CAPACITOR_ORIGINS: string[] = [
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
];

export function isCapacitorOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  // `capacitor:` / `ionic:` are non-special URL schemes — `new URL(...).origin`
  // is often the string `"null"`, so exact allow-list match comes first.
  if (CAPACITOR_ORIGINS.includes(origin)) return true;
  try {
    return CAPACITOR_ORIGINS.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}
