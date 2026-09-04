import { isHostedApiPath, isNativeClientOrigin, readApiBaseUrl } from "./api-base";

let installed = false;

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
  if (!isNativeClientOrigin(window.location.origin) && import.meta.env.VITE_NATIVE !== "1") {
    return;
  }

  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === "string") {
      const next = rewriteUrl(input, apiBase);
      if (next) {
        return original(next, {
          ...init,
          credentials: init?.credentials ?? "omit",
          mode: init?.mode ?? "cors",
        });
      }
    } else if (input instanceof URL) {
      const next = rewriteUrl(input.href, apiBase);
      if (next) {
        return original(next, {
          ...init,
          credentials: init?.credentials ?? "omit",
          mode: init?.mode ?? "cors",
        });
      }
    } else if (typeof Request !== "undefined" && input instanceof Request) {
      const next = rewriteUrl(input.url, apiBase);
      if (next) {
        const headers = new Headers(input.headers);
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
        return original(rewritten, init);
      }
    }
    return original(input as RequestInfo, init);
  };
}

export { rewriteUrl as rewriteHostedApiUrl };
