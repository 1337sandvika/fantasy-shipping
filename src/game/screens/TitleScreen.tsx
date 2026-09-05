import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/i18n";
import { unlockAudio } from "../audio";
import { clearPendingScore, readPendingScore } from "../pending-score";
import { submitCareer } from "../score-api";
import { useGame } from "../store";
import { requirePlay, useIap } from "@/lib/iap";
import { AuthBar } from "./AuthBar";
import { Paywall, TrialChip } from "./Paywall";
import { TourneyTeaser } from "./OfficialTournaments";

export function TitleScreen() {
  const start = useGame((s) => s.start);
  const continueSave = useGame((s) => s.continueSave);
  const hasSave = useGame((s) => s.hasSave);
  const about = useGame((s) => s.ui.about);
  const setAbout = useGame((s) => s.setAbout);
  const user = useCurrentUser();
  const { isPending } = useCurrentUserState();
  const [company, setCompany] = useState("");
  const [director, setDirector] = useState("");
  const [postedNote, setPostedNote] = useState<string | null>(null);
  const filledName = useRef(false);
  const t = useT();
  const paywallOpen = useIap((s) => s.paywallOpen);

  useEffect(() => {
    if (isPending || !user) return;
    const pending = readPendingScore();
    if (!pending) return;
    submitCareer({ data: { ...pending, captain: pending.captain || user.displayName || t("auth.captain") } })
      .then((res) => {
        clearPendingScore();
        setPostedNote(t("title.posted", { n: Math.round(res.points) }));
      })
      .catch(() => {
        /* keep pending for retry */
      });
  }, [user, isPending, t]);

  useEffect(() => {
    if (filledName.current || !user?.displayName) return;
    filledName.current = true;
    setDirector(user.displayName.slice(0, 28));
  }, [user]);

  return (
    <div className="safe-pad relative flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg text-fg">
      <img src="/game/title-hero.jpg?v=3" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/25" />
      <div className="relative z-10 flex justify-end px-4 pt-4 sm:px-10">
        <AuthBar />
      </div>
      <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-10 pt-8 sm:px-10">
        <p className="mb-3 text-xs font-medium tracking-[0.28em] text-accent">{t("brand.kicker")}</p>
        <h1 className="font-display text-4xl font-medium leading-tight tracking-tight sm:text-6xl">{t("brand.game")}</h1>
        <p className="mt-3 max-w-md text-sm text-muted sm:text-base">{t("title.blurb")}</p>
        {postedNote ? <p className="mt-3 max-w-md text-sm text-ok">{postedNote}</p> : null}

        <label className="mt-8 block max-w-sm text-xs font-medium tracking-wide text-muted">
          {t("title.company")}
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onFocus={() => unlockAudio()}
            placeholder={t("title.companyPh")}
            maxLength={32}
            autoComplete="organization"
            className="mt-2 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none placeholder:text-subtle focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            suppressHydrationWarning
          />
        </label>
        <label className="mt-3 block max-w-sm text-xs font-medium tracking-wide text-muted">
          {t("title.director")}
          <input
            value={director}
            onChange={(e) => setDirector(e.target.value)}
            onFocus={() => unlockAudio()}
            placeholder={t("title.directorPh")}
            maxLength={28}
            autoComplete="name"
            className="mt-2 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none placeholder:text-subtle focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            suppressHydrationWarning
          />
        </label>

        <div className="mt-5 flex max-w-md flex-col gap-2 sm:flex-row">
          {hasSave ? (
            <>
              <Button className="flex-1" onClick={() => requirePlay(continueSave)}>
                {t("title.continue")}
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => requirePlay(() => start(company, director))}>
                {t("title.new")}
              </Button>
            </>
          ) : (
            <Button className="flex-1" onClick={() => requirePlay(() => start(company, director))}>
              {t("title.new")}
            </Button>
          )}
        </div>
        <TrialChip />
        <p className="mt-3 max-w-md text-xs text-subtle">{user ? t("title.signedIn") : t("title.guest")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline" onClick={() => setAbout(true)}>
            {t("title.about")}
          </button>
          <Link to="/scoreboard" className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
            {t("title.board")}
          </Link>
          <TourneyTeaser />
        </div>
      </div>
      {paywallOpen ? <Paywall /> : null}
      {about ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg/80 p-4" role="dialog">
          <div className="max-w-lg rounded-xl border border-border bg-bg-elevated p-6 shadow-panel">
            <h2 className="font-display text-2xl">{t("about.title")}</h2>
            <p className="mt-3 text-sm text-muted">{t("about.p1")}</p>
            <p className="mt-3 text-sm text-muted">{t("about.p2")}</p>
            <p className="mt-3 text-sm text-muted">{t("about.p3")}</p>
            <p className="mt-3 text-xs text-subtle">{t("about.legal")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => setAbout(false)}>{t("about.close")}</Button>
              <Link to="/privacy" className="inline-flex min-h-11 items-center text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
                {t("privacy.title")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
