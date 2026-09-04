import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { isCapacitorOrigin } from "@/lib/capacitor-origins";
import { installNativeApiFetch } from "@/lib/native-fetch";

/**
 * Keep Start's default CSRF (same-origin server functions) and additionally
 * allow the first-party Capacitor binary. Sibling `*.grok.me` apps stay blocked.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  secFetchSite: (site, ctx) => {
    if (site === "same-origin") return true;
    return site === "cross-site" && isCapacitorOrigin(ctx.request.headers.get("origin"));
  },
  origin: (origin, ctx) => {
    if (isCapacitorOrigin(origin)) return true;
    try {
      return origin === new URL(ctx.request.url).origin;
    } catch {
      return false;
    }
  },
});

export const startInstance = createStart(() => {
  if (typeof window !== "undefined") installNativeApiFetch();
  return {
    requestMiddleware: [csrfMiddleware],
  };
});
