import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { HouseMark } from "@/components/ui/mark";
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
import { HelpButton, OnboardingGuide } from "./OnboardingGuide";
import { SocialDesk, TodayStrip } from "./SocialDesk";
import { bootSocial, useSocial } from "../social/store";

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
  const setGuide = useSocial((s) => s.setGuide);
  const setDesk = useSocial((s) => s.setDesk);
  const guide = useSocial((s) => s.guide);
  const desk = useSocial((s) => s.desk);

  useEffect(() => {
    bootSocial();
    const done = useSocial.getState().blob.onboardingDone;
    if (!done) setGuide(true, 0);
  }, [setGuide]);

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
    <div className="safe-pad harbour-grain relative flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg text-fg">
      <img src="/game/title-hero.jpg?v=3" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="harbour-hero absolute inset-0" />
      <div className="compass-wash pointer-events-none absolute inset-0 opacity-80" />
      <div className="relative z-10 flex items-start justify-between gap-3 px-4 pt-4 sm:px-10">
        <HelpButton />
        <AuthBar />
      </div>
      <div className="screen-in relative z-10 flex flex-1 flex-col justify-end px-5 pb-10 pt-8 sm:px-10">
        <div className="mb-4 flex items-center gap-3">
          <HouseMark size={48} />
          <p className="kicker">{t("brand.kicker")}</p>
        </div>
        <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">{t("brand.game")}</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">{t("title.blurb")}</p>
        {postedNote ? <p className="mt-3 max-w-md text-sm text-ok">{postedNote}</p> : null}

        <div className="panel mt-8 max-w-md p-4 sm:p-5">
          <label className="block text-xs font-medium tracking-wide text-muted">
            {t("title.company")}
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onFocus={() => unlockAudio()}
              placeholder={t("title.companyPh")}
              maxLength={32}
              autoComplete="organization"
              className="field mt-2"
              suppressHydrationWarning
            />
          </label>
          <label className="mt-3 block text-xs font-medium tracking-wide text-muted">
            {t("title.director")}
            <input
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              onFocus={() => unlockAudio()}
              placeholder={t("title.directorPh")}
              maxLength={28}
              autoComplete="name"
              className="field mt-2"
              suppressHydrationWarning
            />
          </label>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
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
          <p className="mt-3 text-xs text-subtle">{user ? t("title.signedIn") : t("title.guest")}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" className="link-quiet" onClick={() => setAbout(true)}>
            {t("title.about")}
          </button>
          <button type="button" className="link-quiet" onClick={() => setDesk(true, "today")}>
            {t("title.desk")}
          </button>
          <Link to="/scoreboard" className="link-quiet">
            {t("title.board")}
          </Link>
          <TourneyTeaser />
        </div>
        <div className="mt-4 max-w-md">
          <TodayStrip onOpen={() => setDesk(true, "today")} />
        </div>
      </div>
      {paywallOpen ? <Paywall /> : null}
      {guide ? <OnboardingGuide /> : null}
      {desk ? <SocialDesk /> : null}
      {about ? (
        <div className="scrim absolute inset-0 z-20 grid place-items-center p-4" role="dialog">
          <div className="sheet panel max-w-lg p-6">
            <h2 className="font-display text-2xl">{t("about.title")}</h2>
            <p className="mt-3 text-sm text-muted">{t("about.p1")}</p>
            <p className="mt-3 text-sm text-muted">{t("about.p2")}</p>
            <p className="mt-3 text-sm text-muted">{t("about.p3")}</p>
            <p className="mt-3 text-xs text-subtle">{t("about.legal")}</p>
            <div className="mt-5 flex flex-wrap gap-3">
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
