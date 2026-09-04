/**
 * CORS for the first-party Capacitor iOS/Android binary.
 *
 * The career sim is bundled locally; only `/api/auth/*` and `/_serverFn/*`
 * hit this hosted origin from `capacitor://localhost`. Sibling `*.grok.me`
 * apps are NOT reflected — that would reopen cookie riding.
 */
import { isCapacitorOrigin } from "../../src/lib/capacitor-origins";

interface CorsEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers":
      "Authorization,Content-Type,X-Requested-With,Better-Auth-Cookie",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function applyCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function capacitorCorsMiddleware(
  event: CorsEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const origin = event.req.headers.get("origin") ?? "";
  if (!isCapacitorOrigin(origin)) return next();

  const method = (event.req.method ?? "GET").toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const result = await next();
  if (result instanceof Response) return applyCors(result, origin);
  return result;
}
