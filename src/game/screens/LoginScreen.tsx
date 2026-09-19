import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { HouseMark } from "@/components/ui/mark";
import { GROK_PROVIDERS, authClient, authEnabled, captureNativeSessionToken, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";

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

export default function LoginScreen() {
  const { user, isPending } = useCurrentUserState();
  const { next, mode: startMode } = useSearch({ from: "/login" });
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
    <div className="safe-pad harbour-grain relative flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg text-fg">
      <img src="/game/title-hero.jpg?v=3" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="harbour-hero absolute inset-0" />
      <div className="relative z-10 flex justify-end px-4 pt-4">
        <LanguageSwitch compact />
      </div>
      <div className="screen-in relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-end px-5 pb-10 pt-8 sm:justify-center">
        <div className="mb-4 flex items-center gap-3">
          <HouseMark size={40} />
          <p className="kicker">{t("brand.account")}</p>
        </div>
        <h1 className="font-display text-4xl leading-tight">{mode === "up" ? t("login.create") : t("login.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{startMode === "up" ? t("login.blurbSave") : t("login.blurb")}</p>

        <div className="panel mt-6 p-4 sm:p-5">
          {!authEnabled ? (
            <p className="text-sm text-muted">{t("login.disabled")}</p>
          ) : (
            <>
              {social ? (
                <div className="flex flex-col gap-2">
                  {GROK_PROVIDERS.map((p) => (
                    <Button key={p.providerId} variant="secondary" className="w-full" disabled={busy} onClick={() => oauth(p.providerId)}>
                      {t("login.continueWith", { name: p.label })}
                    </Button>
                  ))}
                </div>
              ) : null}
              <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-brass">{t("login.emailSection")}</p>
              <form className="mt-3 space-y-3" onSubmit={onEmail}>
                {mode === "up" ? (
                  <label className="block text-xs font-medium text-muted">
                    {t("login.name")}
                    <input
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      maxLength={28}
                      className="field mt-1"
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
                    className="field mt-1"
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
                    className="field mt-1"
                  />
                </label>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <Button className="w-full" disabled={busy}>
                  {busy ? t("login.wait") : mode === "up" ? t("login.create") : t("login.submit")}
                </Button>
              </form>
              <button type="button" className="link-quiet mt-3" onClick={() => setMode(mode === "up" ? "in" : "up")}>
                {mode === "up" ? t("login.hasAccount") : t("login.newCaptain")}
              </button>
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
      </div>
    </div>
  );
}
