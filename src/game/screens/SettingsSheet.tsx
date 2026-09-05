import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Home, Settings, Share2, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALES, setLocale, useLocale, useT, errMsg } from "@/i18n";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { persist } from "../save";
import { createLeague, joinLeague, listMyLeagues, type LeagueSummary } from "../score-api";
import { purchase, restore, useIap } from "@/lib/iap";
import { useGame } from "../store";
import { OfficialList } from "./OfficialTournaments";

const DURS = [7, 30, 60, 0] as const;

const subscribeToNothing = () => () => {};
const noGateOnServer = () => false;

export function SettingsSheet() {
  const t = useT();
  const setSettings = useGame((s) => s.setSettings);
  const toTitle = useGame((s) => s.toTitle);
  const muted = useGame((s) => s.ui.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const locale = useLocale();
  const { user, isPending } = useCurrentUserState();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateOnServer);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSettings]);

  function persistCareer() {
    const st = useGame.getState().state;
    if (st.phase !== "title") persist(st);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-bg/85 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettings(false);
      }}
    >
      <div className="flex h-full w-full max-w-lg flex-col bg-bg-elevated text-fg sm:h-[min(42rem,90dvh)] sm:rounded-xl sm:border sm:border-border sm:shadow-panel">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Settings className="size-4 text-accent" aria-hidden />
            <h2 id="settings-title" className="font-display text-xl">
              {t("set.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSettings(false)}
            className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
            aria-label={t("set.close")}
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section>
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">{t("lang.label")}</p>
            <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
              {LOCALES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  lang={l.html}
                  onClick={() => setLocale(l.id)}
                  className={cn(
                    "min-h-11 rounded-md border px-3 text-sm",
                    locale === l.id ? "border-accent bg-surface text-fg" : "border-border text-muted hover:text-fg",
                  )}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">{t("set.sound")}</p>
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={!muted}
              className="mt-2 flex min-h-11 w-full items-center justify-between rounded-md border border-border bg-surface px-3 text-sm"
            >
              <span className="flex items-center gap-2">
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                {muted ? t("hud.unmute") : t("hud.mute")}
              </span>
              <span className="text-xs text-muted" aria-hidden>
                {muted ? t("set.off") : t("set.on")}
              </span>
            </button>
          </section>

          <section className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">{t("set.account")}</p>
            {isPending ? (
              <div className="mt-2 h-11 animate-pulse rounded-md bg-surface" />
            ) : user ? (
              <div className="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3">
                <span className="truncate text-sm">
                  {user.displayName ?? user.primaryEmail ?? t("auth.captain")}
                </span>
                {authEnabled && !gateSession ? (
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={() => {
                      setSigningOut(true);
                      void signOut().catch(() => setSigningOut(false));
                    }}
                    className="shrink-0 text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    {signingOut ? t("auth.signingOut") : t("auth.signOut")}
                  </button>
                ) : null}
              </div>
            ) : (
              <Link
                to="/login"
                search={{ next: "/" }}
                onClick={persistCareer}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg"
              >
                {t("auth.signIn")}
              </Link>
            )}
          </section>

          <IapBlock />

          <TourneyBlock signedIn={Boolean(user)} pending={isPending} />

          <section className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">{t("set.more")}</p>
            <div className="mt-2 grid gap-1">
              <Link
                to="/scoreboard"
                onClick={persistCareer}
                className="flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted hover:text-fg"
              >
                {t("auth.board")}
              </Link>
              <button
                type="button"
                onClick={() => setAboutOpen((v) => !v)}
                className="flex min-h-11 items-center rounded-md border border-border px-3 text-left text-sm text-muted hover:text-fg"
              >
                {t("title.about")}
              </button>
              {aboutOpen ? (
                <div className="rounded-md border border-border bg-surface p-3">
                  <h3 className="font-display text-lg">{t("about.title")}</h3>
                  <p className="mt-2 text-sm text-muted">{t("about.p1")}</p>
                  <p className="mt-2 text-sm text-muted">{t("about.p2")}</p>
                  <p className="mt-2 text-sm text-muted">{t("about.p3")}</p>
                  <p className="mt-2 text-xs text-subtle">{t("about.legal")}</p>
                </div>
              ) : null}
              <Link
                to="/privacy"
                onClick={persistCareer}
                className="flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted hover:text-fg"
              >
                {t("privacy.title")}
              </Link>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border p-3 sm:flex-row">
          <Button className="flex-1" onClick={() => setSettings(false)}>
            {t("set.resume")}
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            onClick={() => {
              toTitle();
            }}
          >
            <Home className="mr-2 size-4" />
            {t("set.home")}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function IapBlock() {
  const t = useT();
  const { gating, ready, isUnlocked, trialActive, trialDaysLeft, busy, error, note, priceString } = useIap();
  if (!gating) return null;
  const priceLabel = priceString ? t("iap.unlock", { price: priceString }) : t("iap.unlockFallback");
  return (
    <section className="mt-6">
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{t("iap.settings")}</p>
      {!ready ? <div className="mt-2 h-11 animate-pulse rounded-md bg-surface" /> : null}
      {ready && isUnlocked ? <p className="mt-2 text-sm text-ok">{t("iap.owned")}</p> : null}
      {ready && !isUnlocked && trialActive ? (
        <p className="mt-2 text-sm text-muted">
          {trialDaysLeft <= 1 ? t("iap.trialLeftOne") : t("iap.trialLeft", { n: trialDaysLeft })}
        </p>
      ) : null}
      {ready && !isUnlocked && !trialActive ? <p className="mt-2 text-sm text-warn">{t("iap.trialExpired")}</p> : null}
      {note === "restored" ? <p className="mt-2 text-sm text-ok">{t("iap.restored")}</p> : null}
      {error === "none" ? <p className="mt-2 text-sm text-warn">{t("iap.none")}</p> : null}
      {error === "fail" ? <p className="mt-2 text-sm text-danger">{t("iap.fail")}</p> : null}
      <div className="mt-2 grid gap-1">
        {ready && !isUnlocked ? (
          <Button disabled={busy} onClick={() => void purchase()} className="w-full">
            {busy ? t("iap.buying") : priceLabel}
          </Button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void restore()}
          className="flex min-h-11 items-center justify-center rounded-md border border-border px-3 text-sm text-muted hover:text-fg disabled:opacity-50"
        >
          {busy ? t("iap.restoring") : t("iap.restore")}
        </button>
      </div>
    </section>
  );
}

function failMsg(e: unknown, fallback: string) {
  const raw = e instanceof Error ? e.message : String(e);
  const mapped = errMsg(raw);
  return mapped === raw ? fallback : mapped;
}

function TourneyBlock({ signedIn, pending }: { signedIn: boolean; pending: boolean }) {
  const t = useT();
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await listMyLeagues();
    setLeagues(list);
    return list;
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    reload().catch((e) => {
      if (live) setErr(failMsg(e, t("board.leagueFail")));
    });
    return () => {
      live = false;
    };
  }, [signedIn, reload, t]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await createLeague({
        data: { name, durationDays: duration, scoring: "best", mode: "solo" },
      });
      setName("");
      setFresh(res.code);
      await reload();
      await copyOrShare(res.code, false);
    } catch (e) {
      setErr(failMsg(e, t("board.createFail")));
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await joinLeague({ data: { code } });
      setCode("");
      await reload();
      setNote(t("set.joined"));
    } catch (e) {
      setErr(failMsg(e, t("board.joinFail")));
    } finally {
      setBusy(false);
    }
  }

  async function copyOrShare(invite: string, share: boolean) {
    const text = t("set.inviteShare", { code: invite });
    if (share && typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("brand.game"), text });
        setNote(t("set.shared"));
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(invite);
      setNote(t("set.copied"));
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mt-6">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-subtle">
        <Trophy className="size-3.5 text-accent" aria-hidden />
        {t("set.tournaments")}
      </p>
      <p className="mt-1 text-sm text-muted">{t("set.tourneyBlurb")}</p>

      <div className="mt-4">
        <OfficialList compact signedIn={signedIn} pending={pending} />
      </div>

      {pending ? <p className="mt-3 text-sm text-muted">{t("board.fetchLeagues")}</p> : null}

      {!pending && !signedIn ? (
        <p className="mt-3 rounded-md border border-border bg-surface px-3 py-3 text-sm text-muted">{t("set.needSignIn")}</p>
      ) : null}

      {signedIn ? (
        <>
          <form onSubmit={onCreate} className="mt-3 space-y-3">
            <label className="block text-xs font-medium text-muted">
              {t("board.leagueName")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={28}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {DURS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "min-h-11 rounded-md border px-3 text-xs font-medium",
                    duration === d ? "border-accent bg-surface text-fg" : "border-border text-muted hover:text-fg",
                  )}
                >
                  {t(d === 7 ? "comp.d7" : d === 30 ? "comp.d30" : d === 60 ? "comp.d60" : "comp.d0")}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={busy || name.trim().length < 2} className="w-full">
              {t("set.createTourney")}
            </Button>
          </form>

          {fresh ? (
            <p className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-sm tracking-widest">
              {t("board.code")} {fresh}
            </p>
          ) : null}

          <form onSubmit={onJoin} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-xs font-medium text-muted">
              {t("board.inviteCode")}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm tracking-widest text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={busy || code.trim().length < 4}>
              {t("board.join")}
            </Button>
          </form>

          {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
          {note ? <p className="mt-2 text-sm text-ok">{note}</p> : null}

          {!leagues ? (
            <p className="mt-4 text-sm text-muted">{t("board.fetchLeagues")}</p>
          ) : leagues.filter((l) => l.kind !== "official").length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("board.emptyLeagues")}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {leagues
                .filter((l) => l.kind !== "official")
                .map((l) => (
                <li key={l.id} className="rounded-md border border-border bg-surface px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="shrink-0 font-mono text-xs tracking-widest text-accent">{l.code}</p>
                  </div>
                  <p className="text-xs text-subtle">
                    {l.members} {l.members === 1 ? t("board.member") : t("board.members")}
                    {l.owner ? ` · ${t("board.owner")}` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void copyOrShare(l.code, false)}>
                      <Copy className="mr-1.5 size-3.5" />
                      {t("board.copy")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void copyOrShare(l.code, true)}>
                      <Share2 className="mr-1.5 size-3.5" />
                      {t("set.invite")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
