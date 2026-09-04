import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GROK_PROVIDERS, authClient, authEnabled, captureNativeSessionToken, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";

type LoginSearch = { next?: "/" | "/scoreboard"; mode?: "up" };

function allowSocialLogin() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return true;
  const ua = navigator.userAgent || "";
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  if (!iOS) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || Boolean(nav.standalone);
  const wk = Boolean((window as unknown as { webkit?: { messageHandlers?: unknown } }).webkit?.messageHandlers);
  return !(standalone || wk);
}

export const Route = createFileRoute("/login")({
  validateSearch: (raw: Record<string, unknown>): LoginSearch => ({
    ...(raw.next === "/scoreboard" ? { next: "/scoreboard" as const } : {}),
    ...(raw.mode === "up" ? { mode: "up" as const } : {}),
  }),
  component: Login,
});

function Login() {
  const { user, isPending } = useCurrentUserState();
  const { next, mode: startMode } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">(startMode === "up" ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [social, setSocial] = useState(true);
  const t = useT();

  useEffect(() => {
    setSocial(allowSocialLogin());
  }, []);

  const dest = next === "/scoreboard" ? "/scoreboard" : "/";

  if (!isPending && user) {
    return dest === "/scoreboard" ? <Navigate to="/scoreboard" /> : <Navigate to="/" />;
  }

  async function oauth(providerId: string) {
    setError(null);
    setBusy(true);
    try {
      await signIn(providerId, { callbackURL: dest, errorCallbackURL: "/login" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.failed"));
      setBusy(false);
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split("@")[0] || t("auth.captain"),
        });
        if (err) throw new Error(err.message ?? t("login.signupFail"));
        captureNativeSessionToken(data);
      } else {
        const { data, error: err } = await authClient.signIn.email({ email: email.trim(), password });
        if (err) throw new Error(err.message ?? t("login.badCreds"));
        captureNativeSessionToken(data);
      }
      window.location.href = dest;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
      setBusy(false);
    }
  }

  return (
    <div className="safe-pad relative flex min-h-dvh flex-col overflow-hidden bg-bg text-fg">
      <img src="/game/title-hero.jpg?v=3" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/80 to-bg/40" />
      <div className="relative z-10 flex justify-end px-4 pt-4">
        <LanguageSwitch compact />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-end px-5 pb-10 pt-8 sm:justify-center">
        <p className="text-xs font-medium tracking-[0.28em] text-accent">{t("brand.account")}</p>
        <h1 className="mt-2 font-display text-4xl">{mode === "up" ? t("login.create") : t("login.title")}</h1>
        <p className="mt-3 text-sm text-muted">{startMode === "up" ? t("login.blurbSave") : t("login.blurb")}</p>

        {!authEnabled ? (
          <p className="mt-6 text-sm text-muted">{t("login.disabled")}</p>
        ) : (
          <>
            {social ? (
              <div className="mt-6 flex flex-col gap-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button key={p.providerId} variant="secondary" className="w-full" disabled={busy} onClick={() => oauth(p.providerId)}>
                    {t("login.continueWith", { name: p.label })}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="mt-6" />
            )}
            <p className="mt-6 text-center text-xs uppercase tracking-wider text-subtle">{t("login.emailSection")}</p>
            <form className="mt-3 space-y-3" onSubmit={onEmail}>
              {mode === "up" ? (
                <label className="block text-xs font-medium text-muted">
                  {t("login.name")}
                  <input
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    maxLength={28}
                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                  />
                </label>
              ) : null}
              <label className="block text-xs font-medium text-muted">
                {t("login.email")}
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                {t("login.password")}
                <input
                  type="password"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                />
              </label>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button className="w-full" disabled={busy}>
                {busy ? t("login.wait") : mode === "up" ? t("login.create") : t("login.submit")}
              </Button>
            </form>
            <button
              type="button"
              className="mt-3 text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? t("login.hasAccount") : t("login.newCaptain")}
            </button>
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-4">
          <Link to="/" className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
            {t("login.guest")}
          </Link>
          <Link to="/privacy" className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
            {t("privacy.title")}
          </Link>
        </div>
      </div>
    </div>
  );
}
