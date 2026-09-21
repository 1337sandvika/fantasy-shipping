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

/** Sent by the native shell so the hosted API can tell WKWebView from a website. */
export const NATIVE_CLIENT_HEADER = "x-fantasy-shipping-client";
export const NATIVE_CLIENT_VALUE = "capacitor";

export function isNativeClientHeader(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === NATIVE_CLIENT_VALUE;
}

export function isCapacitorOrigin(origin: string | null | undefined): boolean {
  if (!origin || origin === "null") return false;
  // `capacitor:` / `ionic:` are non-special URL schemes — `new URL(...).origin`
  // is often the string `"null"`, so exact allow-list match comes first.
  if (CAPACITOR_ORIGINS.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== "null" && CAPACITOR_ORIGINS.includes(parsed.origin)) return true;
    return CAPACITOR_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

/**
 * WKWebView's opaque `capacitor://` origin is serialized as the header
 * `Origin: null`. Better Auth rejects that before the allow-list runs.
 * Only rewrite when our native client header is present — a random site
 * cannot both omit its origin and set this header on a simple request, and
 * credentialed cookie sessions stay on the https host.
 */
export function nativeOriginOverride(
  origin: string | null | undefined,
  clientHeader: string | null | undefined,
): string | null {
  if (!isNativeClientHeader(clientHeader)) return null;
  if (origin && origin !== "null" && isCapacitorOrigin(origin)) return null;
  if (!origin || origin === "null") return "capacitor://localhost";
  return null;
}

/** Value for `Access-Control-Allow-Origin`, or null when this request is not the native app. */
export function corsAllowOrigin(
  origin: string | null | undefined,
  clientHeader: string | null | undefined,
): string | null {
  if (origin && isCapacitorOrigin(origin)) return origin;
  if ((!origin || origin === "null") && isNativeClientHeader(clientHeader)) return "null";
  return null;
}
