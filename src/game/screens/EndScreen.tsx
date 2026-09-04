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
import { useGame } from "../store";
import { AuthBar } from "./AuthBar";

export function EndScreen() {
  const s = useGame((g) => g.state);
  const start = useGame((g) => g.start);
  const resume = useGame((g) => g.resume);
  const toTitle = useGame((g) => g.toTitle);
  const markCheckpoint = useGame((g) => g.markCheckpoint);
  const { user, isPending } = useCurrentUserState();
  const posted = useRef(false);
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

  useEffect(() => {
    markCheckpoint();
  }, [markCheckpoint]);

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
    <div className="flex min-h-dvh flex-col bg-bg px-5 py-6 text-fg sm:py-10">
      <div className="mb-6 flex justify-end">
        <AuthBar showTable={false} />
      </div>
      <p className="text-xs tracking-[0.25em] text-accent">{t(hard ? "end.kicker.over" : "end.kicker.checkpoint")}</p>
      <h1 className="mt-2 font-display text-4xl">{t(`end.${kind}.title` as MsgKey)}</h1>
      <p className="mt-2 font-medium">{s.company || s.captain}</p>
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
        <Button onClick={resume}>{hard ? t("end.bail") : t("end.continue")}</Button>
        <Button variant="secondary" onClick={() => start(s.company || s.captain, s.director || "")}>
          {t("end.again")}
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
  );
}
