import { isHostedApiPath, isNativeApp, readApiBaseUrl } from "./api-base";
import { NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE } from "./capacitor-origins";

let installed = false;

function stampNative(headers: Headers): Headers {
  headers.set(NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE);
  return headers;
}

function rewriteUrl(url: string, apiBase: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost");
  } catch {
    return null;
  }
  if (!isHostedApiPath(parsed.pathname)) return null;
  if (parsed.origin === apiBase) return null;
  return `${apiBase}${parsed.pathname}${parsed.search}`;
}

/**
 * Point TanStack Start server functions and Better Auth at the hosted API
 * when this bundle is running inside Capacitor (no co-located server).
 *
 * Safe no-op on the regular website: rewrite only runs when the page origin
 * is a Capacitor WebView and `VITE_API_BASE_URL` is set at build time.
 */
export function installNativeApiFetch(): void {
  if (installed) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  const apiBase = readApiBaseUrl();
  if (!apiBase) return;
  if (!isNativeApp()) return;

  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === "string" || input instanceof URL) {
      const raw = typeof input === "string" ? input : input.href;
      const next = rewriteUrl(raw, apiBase);
      if (next) {
        const headers = stampNative(new Headers(init?.headers));
        return original(next, {
          ...init,
          headers,
          credentials: init?.credentials ?? "omit",
          mode: init?.mode ?? "cors",
        });
      }
    } else if (typeof Request !== "undefined" && input instanceof Request) {
      const next = rewriteUrl(input.url, apiBase);
      if (next) {
        const headers = stampNative(new Headers(input.headers));
        if (init?.headers) {
          new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        }
        const rewritten = new Request(next, {
          method: input.method,
          headers,
          body: init?.body ?? (input.method === "GET" || input.method === "HEAD" ? undefined : input.body),
          mode: "cors",
          credentials: "omit",
          cache: input.cache,
          redirect: input.redirect,
          integrity: input.integrity,
          signal: init?.signal ?? input.signal,
        });
        return original(rewritten);
      }
    }
    return original(input as RequestInfo, init);
  };
}

export { rewriteUrl as rewriteHostedApiUrl };
