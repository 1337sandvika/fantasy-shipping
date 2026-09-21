import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { HouseMark } from "@/components/ui/mark";
import { isNativeApp } from "@/lib/api-base";
import { captureNativeSessionToken, getBearerToken, GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import {
  accountFormError,
  classifyAuthError,
  shouldOfferSocialLogin,
  withTimeout,
  type AuthFailKind,
} from "@/lib/auth/native-request";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";

const AUTH_TIMEOUT_MS = 20_000;

function detectSocialLogin(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  let platform = "";
  try {
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } })
      .Capacitor;
    if (cap?.isNativePlatform?.() && cap.getPlatform) platform = cap.getPlatform();
  } catch {
    platform = "";
  }
  return shouldOfferSocialLogin({
    userAgent: navigator.userAgent || "",
    platform,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches || Boolean(nav.standalone),
    hasWebkitHandlers: Boolean(
      (window as unknown as { webkit?: { messageHandlers?: unknown } }).webkit?.messageHandlers,
    ),
  });
}

function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(overlap > 40 ? Math.round(overlap) : 0);
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return inset;
}

export default function LoginScreen() {
  const { user, isPending } = useCurrentUserState();
  const { next, mode: startMode } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"in" | "up">(startMode === "up" ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [social, setSocial] = useState(false);
  const keyboard = useKeyboardInset();
  const t = useT();

  useEffect(() => {
    setSocial(detectSocialLogin());
  }, []);

  useEffect(() => {
    setMode(startMode === "up" ? "up" : "in");
  }, [startMode]);

  const dest = next === "/scoreboard" ? "/scoreboard" : "/";

  if (!isPending && user) {
    return dest === "/scoreboard" ? <Navigate to="/scoreboard" /> : <Navigate to="/" />;
  }

  function failMessage(kind: AuthFailKind, fallback: string): string {
    if (kind === "network") return t("login.network");
    if (kind === "timeout") return t("login.timeout");
    if (kind === "origin") return t("login.origin");
    if (kind === "exists") return t("login.exists");
    if (kind === "creds") return t("login.badCreds");
    if (kind === "invalid") return t("login.shortPassword");
    return fallback;
  }

  function reveal(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    requestAnimationFrame(() => target.scrollIntoView({ block: "center" }));
  }

  async function oauth(providerId: string) {
    setError(null);
    setBusy(true);
    try {
      await withTimeout(signIn(providerId, { callbackURL: dest, errorCallbackURL: "/login" }), AUTH_TIMEOUT_MS);
    } catch (e) {
      setError(failMessage(classifyAuthError(e), t("login.failed")));
      setBusy(false);
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const invalid = accountFormError({ email, password });
    if (invalid === "email") {
      setError(t("login.invalidEmail"));
      return;
    }
    if (invalid === "password") {
      setError(t("login.shortPassword"));
      return;
    }
    setBusy(true);
    try {
      const trimmed = email.trim();
      const result =
        mode === "up"
          ? await withTimeout(
              authClient.signUp.email({
                email: trimmed,
                password,
                name: name.trim() || trimmed.split("@")[0] || t("auth.captain"),
              }),
              AUTH_TIMEOUT_MS,
            )
          : await withTimeout(authClient.signIn.email({ email: trimmed, password }), AUTH_TIMEOUT_MS);
      if (result.error) {
        const kind = classifyAuthError(result.error);
        if (kind === "exists") setMode("in");
        throw new Error(result.error.message ?? (mode === "up" ? t("login.signupFail") : t("login.badCreds")));
      }
      captureNativeSessionToken(result.data);
      if (isNativeApp() && !getBearerToken()) {
        setMode("in");
        setError(t("login.sessionMissing"));
        setBusy(false);
        return;
      }
      window.location.href = dest;
    } catch (err) {
      const kind = classifyAuthError(err);
      if (kind === "exists") setMode("in");
      const fallback = mode === "up" ? t("login.signupFail") : t("login.failed");
      setError(failMessage(kind, err instanceof Error && err.message ? err.message : fallback));
      setBusy(false);
    }
  }

  return (
    <div className="safe-pad harbour-grain relative flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg text-fg">
      <img src="/game/title-hero.jpg?v=3" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="harbour-hero absolute inset-0" />
      <div className="relative z-10 flex justify-end px-4 pt-4">
        <LanguageSwitch compact />
      </div>
      <div className="screen-in relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-start px-5 pb-8 pt-6 md:max-w-lg md:justify-center">
        <div className="mb-4 flex items-center gap-3">
          <HouseMark size={40} />
          <p className="kicker">{t("brand.account")}</p>
        </div>
        <h1 className="font-display text-4xl leading-tight">{mode === "up" ? t("login.create") : t("login.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t("login.optional")}</p>

        <div className="panel mt-6 p-4 sm:p-5">
          {!authEnabled ? (
            <p className="text-sm text-muted">{t("login.disabled")}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "up"}
                  className={mode === "up" ? "chip chip-on justify-center text-center" : "chip justify-center text-center"}
                  onClick={() => {
                    setMode("up");
                    setError(null);
                  }}
                >
                  {t("login.create")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "in"}
                  className={mode === "in" ? "chip chip-on justify-center text-center" : "chip justify-center text-center"}
                  onClick={() => {
                    setMode("in");
                    setError(null);
                  }}
                >
                  {t("auth.signIn")}
                </button>
              </div>
              <p className="mt-4 text-sm text-muted">{mode === "up" ? t("login.blurbSave") : t("login.blurb")}</p>
              {social ? (
                <div className="mt-4 flex flex-col gap-2">
                  {GROK_PROVIDERS.map((p) => (
                    <Button key={p.providerId} variant="secondary" className="w-full" disabled={busy} onClick={() => oauth(p.providerId)}>
                      {t("login.continueWith", { name: p.label })}
                    </Button>
                  ))}
                </div>
              ) : null}
              <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-brass">{t("login.emailSection")}</p>
              <form className="mt-3 space-y-3" onSubmit={onEmail} noValidate>
                {mode === "up" ? (
                  <label className="block text-xs font-medium text-muted">
                    {t("login.name")}
                    <input
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      onFocus={(ev) => reveal(ev.target)}
                      maxLength={28}
                      autoComplete="nickname"
                      enterKeyHint="next"
                      className="field mt-1"
                    />
                  </label>
                ) : null}
                <label className="block text-xs font-medium text-muted">
                  {t("login.email")}
                  <input
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="email"
                    enterKeyHint="next"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    onFocus={(ev) => reveal(ev.target)}
                    className="field mt-1"
                  />
                </label>
                <label className="block text-xs font-medium text-muted">
                  {t("login.password")}
                  <input
                    type="password"
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                    enterKeyHint="go"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    onFocus={(ev) => reveal(ev.target)}
                    className="field mt-1"
                  />
                  <span className="mt-1 block text-[11px] font-normal text-subtle">{t("login.passwordHint")}</span>
                </label>
                {error ? (
                  <p className="text-sm text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button className="w-full" disabled={busy}>
                  {busy ? t("login.wait") : mode === "up" ? t("login.create") : t("login.submit")}
                </Button>
              </form>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link to="/" className="link-quiet">
            {t("login.guest")}
          </Link>
          <Link to="/privacy" className="link-quiet">
            {t("privacy.title")}
          </Link>
        </div>
        <div aria-hidden style={{ height: keyboard }} />
      </div>
    </div>
  );
}
