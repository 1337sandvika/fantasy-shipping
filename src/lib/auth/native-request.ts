import { nativeOriginOverride, NATIVE_CLIENT_HEADER } from "../capacitor-origins.ts";

/**
 * Rewrite `Origin: null` from the Capacitor WKWebView to the trusted
 * `capacitor://localhost` origin before Better Auth's CSRF check.
 * Leaves every other request untouched.
 */
export function prepareNativeAuthRequest(request: Request): Request {
  const override = nativeOriginOverride(
    request.headers.get("origin"),
    request.headers.get(NATIVE_CLIENT_HEADER),
  );
  if (!override) return request;
  const headers = new Headers(request.headers);
  headers.set("origin", override);
  return new Request(request, { headers });
}

export type AuthFailKind =
  | "network"
  | "timeout"
  | "origin"
  | "exists"
  | "creds"
  | "invalid"
  | "generic";

export function classifyAuthError(err: unknown): AuthFailKind {
  const code =
    typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err ?? "");
  const blob = `${code} ${msg}`.toLowerCase();
  if (/timeout|timed out|aborted/.test(blob)) return "timeout";
  if (/failed to fetch|network|load failed|offline|internet|networkerror/.test(blob)) return "network";
  if (/invalid origin|missing_or_null_origin|null origin/.test(blob)) return "origin";
  if (/already exists|already registered|user already|email already/.test(blob)) return "exists";
  if (/invalid email or password|invalid password|wrong password|credentials/.test(blob)) return "creds";
  if (/invalid email|password.*8|too short|too long/.test(blob)) return "invalid";
  return "generic";
}

export function accountFormError(input: {
  email: string;
  password: string;
}): "email" | "password" | null {
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "email";
  if (input.password.length < 8) return "password";
  return null;
}

export function shouldOfferSocialLogin(env: {
  userAgent: string;
  /** Capacitor platform: "ios" | "android" | "web" | "". */
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasWebkitHandlers: boolean;
}): boolean {
  const ua = env.userAgent || "";
  const ios =
    env.platform === "ios" ||
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && (env.maxTouchPoints > 1 || env.hasWebkitHandlers));
  if (ios) return false;
  if (env.standalone || env.hasWebkitHandlers) return false;
  return true;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
