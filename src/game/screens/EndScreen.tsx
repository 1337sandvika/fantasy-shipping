import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT, type MsgKey } from "@/i18n";
import { money, qty } from "../format";
import { fleetValue } from "../fleet";
import { careerPoints } from "../score";
import { clearPendingScore, readPendingScore } from "../pending-score";
import { submitCareer } from "../score-api";
import { foghorn } from "../audio";
import { useGame } from "../store";
import { AuthBar } from "./AuthBar";

const BROKE_QUOTES: MsgKey[] = [
  "end.broke.q0",
  "end.broke.q1",
  "end.broke.q2",
  "end.broke.q3",
  "end.broke.q4",
];

export function EndScreen() {
  const s = useGame((g) => g.state);
  const start = useGame((g) => g.start);
  const resume = useGame((g) => g.resume);
  const toTitle = useGame((g) => g.toTitle);
  const markCheckpoint = useGame((g) => g.markCheckpoint);
  const { user, isPending } = useCurrentUserState();
  const posted = useRef(false);
  const horned = useRef(false);
  const [post, setPost] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const t = useT();
  const kind = s.endKind ?? "retired";
  const hard = kind === "broke";
  const nw = s.cash + fleetValue(s);
  const pts = careerPoints({
    netWorth: nw,
    deliveredCeu: s.deliveredCeu,
    reputation: s.reputation,
    co2t: s.co2t,
    fines: s.fines,
  });
  const quote = BROKE_QUOTES[((s.seed >>> 0) + Math.floor(s.day)) % BROKE_QUOTES.length]!;

  useEffect(() => {
    markCheckpoint();
  }, [markCheckpoint]);

  useEffect(() => {
    if (!hard || horned.current) return;
    horned.current = true;
    foghorn();
  }, [hard]);

  useEffect(() => {
    if (isPending || !user || posted.current) return;
    const pending = readPendingScore();
    if (!pending) {
      setPost("ok");
      return;
    }
    posted.current = true;
    setPost("sending");
    submitCareer({ data: { ...pending, captain: pending.captain || user.displayName || t("auth.captain") } })
      .then(() => {
        clearPendingScore();
        setPost("ok");
      })
      .catch(() => {
        posted.current = false;
        setPost("fail");
      });
  }, [user, isPending, t]);

  return (
    <div className="safe-pad flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg text-fg">
      {hard ? (
        <div className="relative isolate overflow-hidden border-b border-danger/40">
          <img
            src="/game/events/broke.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_40%]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/20" />
          <div className="relative z-10 px-5 pb-6 pt-6 sm:px-10 sm:pb-8 sm:pt-8">
            <div className="mb-6 flex justify-end">
              <AuthBar showTable={false} />
            </div>
            <p className="text-xs tracking-[0.25em] text-danger">{t("end.kicker.over")}</p>
            <div className="mt-4 flex flex-wrap items-end gap-6">
              <h1 className="max-w-xl font-display text-4xl sm:text-6xl">{t("end.broke.title")}</h1>
              <p
                className="animate-stamp rounded-sm border-4 border-danger px-3 py-1 font-display text-2xl font-semibold tracking-widest text-danger sm:text-3xl"
                aria-hidden="true"
              >
                {t("end.broke.stamp")}
              </p>
            </div>
            <p className="mt-4 max-w-xl text-sm italic text-fg">{t(quote)}</p>
          </div>
          <div className="relative z-10 overflow-hidden border-t border-danger/30 bg-bg/80 py-2">
            <p className="animate-ticker flex w-max gap-16 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.2em] text-danger">
              <span>{t("end.broke.auction")}</span>
              <span>{s.company || s.captain}</span>
              <span>{t("end.broke.auction")}</span>
              <span>{s.company || s.captain}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 pt-6 sm:px-10 sm:pt-10">
          <div className="mb-6 flex justify-end">
            <AuthBar showTable={false} />
          </div>
          <p className="text-xs tracking-[0.25em] text-accent">{t("end.kicker.checkpoint")}</p>
          <h1 className="mt-2 font-display text-4xl">{t(`end.${kind}.title` as MsgKey)}</h1>
        </div>
      )}

      <div className="flex flex-1 flex-col px-5 py-6 sm:px-10 sm:py-8">
        <p className="font-medium">{s.company || s.captain}</p>
        {s.director ? <p className="text-sm text-muted">{t("end.director", { name: s.director })}</p> : null}
        <p className="mt-3 max-w-lg text-sm text-muted">{t(`end.${kind}.why` as MsgKey)}</p>
        <p className="mt-3 max-w-lg text-sm text-fg">{t(`end.${kind}.body` as MsgKey)}</p>
        <dl className="mt-8 grid max-w-md grid-cols-2 gap-3 text-sm">
          <dt className="text-subtle">{t("end.points")}</dt>
          <dd className="font-mono tabular-nums">{qty(pts)}</dd>
          <dt className="text-subtle">{t("end.wealthStat")}</dt>
          <dd className="font-mono tabular-nums">{money(nw)}</dd>
          <dt className="text-subtle">{t("end.day")}</dt>
          <dd className="font-mono tabular-nums">{t("end.dayN", { n: qty(Math.floor(s.day)) })}</dd>
          <dt className="text-subtle">{t("end.ceu")}</dt>
          <dd className="font-mono tabular-nums">{qty(s.deliveredCeu)} CEU</dd>
          <dt className="text-subtle">{t("end.fleet")}</dt>
          <dd>{t("end.hulls", { n: s.fleet.length })}</dd>
        </dl>

        <div className="mt-8 max-w-md rounded-lg border border-border bg-surface p-4">
          {isPending ? (
            <div className="h-16 animate-pulse rounded-md bg-bg-elevated" />
          ) : user ? (
            <div>
              <p className="text-sm font-medium">{t("end.savedAs", { name: user.displayName || user.primaryEmail || t("auth.captain") })}</p>
              <p className="mt-1 text-xs text-subtle">
                {post === "sending" ? t("end.posting") : post === "fail" ? t("end.postFail") : t("end.posted")}
              </p>
            </div>
          ) : authEnabled ? (
            <div>
              <p className="text-sm font-medium">{t("end.saveTitle")}</p>
              <p className="mt-1 text-xs text-muted">{t("end.saveBlurb")}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link
                  to="/login"
                  search={{ next: "/" }}
                  onClick={() => markCheckpoint()}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
                >
                  {t("auth.signIn")}
                </Link>
                <Link
                  to="/login"
                  search={{ next: "/", mode: "up" }}
                  onClick={() => markCheckpoint()}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-border px-4 text-sm font-medium"
                >
                  {t("login.create")}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-xs text-subtle">{t("end.guestPost")}</p>
          )}
        </div>

        <div className="mt-6 flex max-w-md flex-col gap-2">
          <Button onClick={() => start(s.company || s.captain, s.director || "")}>
            {t("end.again")}
          </Button>
          <Button variant="secondary" onClick={resume}>
            {hard ? t("end.bail") : t("end.continue")}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Link to="/scoreboard" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-border px-4 text-sm">
              {t("end.board")}
            </Link>
            <Button variant="ghost" className="flex-1" onClick={toTitle}>
              {t("set.home")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
