import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, Crown, Flame, Leaf, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errMsg, useT, type MsgKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { qty } from "../format";
import {
  joinOfficial,
  leaveLeague,
  listOfficial,
  listOfficialPublic,
  type OfficialCard,
  type OfficialSlug,
} from "../score-api";

const ICONS: Record<OfficialSlug, typeof Zap> = {
  week: Zap,
  month: Calendar,
  alltime: Crown,
  grind: Flame,
  green: Leaf,
};

function clockLabel(endsAt: string | null, now: number, t: (k: MsgKey, v?: Record<string, string | number>) => string) {
  if (!endsAt) return t("comp.open");
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return t("comp.ended");
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 2) return t("comp.daysLeft", { n: days });
  if (hours >= 1) return t("comp.hoursLeft", { n: hours });
  return t("comp.endsToday");
}

function failMsg(e: unknown, fallback: string) {
  const raw = e instanceof Error ? e.message : String(e);
  const mapped = errMsg(raw);
  return mapped === raw ? fallback : mapped;
}

export function OfficialList({
  compact,
  signedIn,
  pending,
}: {
  compact?: boolean;
  signedIn: boolean;
  pending: boolean;
}) {
  const t = useT();
  const [cards, setCards] = useState<OfficialCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<OfficialSlug | null>(null);
  const [open, setOpen] = useState<OfficialSlug | null>(compact ? null : "week");
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    const list = signedIn ? await listOfficial() : await listOfficialPublic();
    setCards(list);
    return list;
  }, [signedIn]);

  useEffect(() => {
    let live = true;
    setErr(null);
    reload()
      .then((list) => {
        if (!live) return;
        if (!compact) {
          setOpen((prev) => (list.some((c) => c.slug === prev) ? prev : (list[0]?.slug ?? null)));
        }
      })
      .catch((e) => {
        if (live) setErr(failMsg(e, t("board.leagueFail")));
      });
    return () => {
      live = false;
    };
  }, [reload, t, compact]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function onJoin(slug: OfficialSlug) {
    setBusy(slug);
    setErr(null);
    try {
      await joinOfficial({ data: { slug } });
      await reload();
      setOpen(slug);
    } catch (e) {
      setErr(failMsg(e, t("board.joinFail")));
    } finally {
      setBusy(null);
    }
  }

  async function onLeave(id: number, slug: OfficialSlug) {
    setBusy(slug);
    setErr(null);
    try {
      await leaveLeague({ data: { id } });
      await reload();
    } catch (e) {
      setErr(failMsg(e, t("board.leaveFail")));
    } finally {
      setBusy(null);
    }
  }

  if (pending && !cards) return <p className="text-sm text-muted">{t("board.fetchLeagues")}</p>;
  if (err && !cards) return <p className="text-sm text-danger">{err}</p>;
  if (!cards) return <p className="text-sm text-muted">{t("board.fetchLeagues")}</p>;

  return (
    <div className="space-y-3">
      {!compact ? (
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-accent">{t("off.kicker")}</p>
          <p className="mt-1 text-sm text-muted">{t("off.blurb")}</p>
        </div>
      ) : null}
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      <ul className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-1")}>
        {cards.map((c) => {
          const Icon = ICONS[c.slug];
          const expanded = !compact && open === c.slug;
          const nameKey = `off.${c.slug}` as MsgKey;
          const blurbKey = `off.${c.slug}.blurb` as MsgKey;
          const ruleKey = (`off.rule.${c.scoring}` as MsgKey);
          const metricKey = (`off.metric.${c.metric}` as MsgKey);
          const leader = c.top.find((r) => r.points > 0);
          return (
            <li key={c.slug}>
              <article
                className={cn(
                  "rounded-xl border bg-bg-elevated p-4",
                  expanded ? "border-accent" : "border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(open === c.slug ? null : c.slug)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-md bg-surface text-accent">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-display text-lg">{t(nameKey)}</span>
                      <span className="text-xs tracking-wider text-accent">
                        {c.live ? t("comp.live") : t("comp.ended")} · {clockLabel(c.endsAt, now, t)}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">{t(blurbKey)}</span>
                    <span className="mt-1 block text-xs text-subtle">
                      {t(ruleKey)} · {t(metricKey)}
                      {c.members ? ` · ${c.members} ${c.members === 1 ? t("board.member") : t("board.members")}` : ""}
                      {leader ? ` · ${t("comp.champion", { name: leader.handle })}` : ""}
                    </span>
                  </span>
                </button>

                {c.top.length && c.top.some((r) => r.points > 0) ? (
                  <ol className="mt-3 space-y-1">
                    {(expanded ? c.top : c.top.slice(0, compact ? 3 : 3)).map((r) =>
                      r.points <= 0 ? null : (
                        <li
                          key={`${c.slug}-${r.rank}-${r.handle}`}
                          className={cn(
                            "flex items-baseline justify-between gap-3 rounded-md border px-3 py-1.5",
                            r.mine ? "border-accent bg-surface" : "border-border bg-bg",
                          )}
                        >
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="w-5 font-mono text-xs tabular-nums text-subtle">{r.rank}</span>
                            <span className="truncate text-sm">
                              {r.handle}
                              {r.mine ? <span className="ml-2 text-xs text-accent">{t("board.you")}</span> : null}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-sm tabular-nums">{qty(r.points)}</span>
                        </li>
                      ),
                    )}
                  </ol>
                ) : (
                  <p className="mt-3 text-xs text-subtle">{t("off.empty")}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.joined ? (
                    <>
                      <span className="inline-flex min-h-11 items-center rounded-md border border-accent/40 bg-accent/10 px-3 text-xs font-medium text-accent">
                        {t("off.joined")}
                      </span>
                      <Button size="sm" variant="ghost" disabled={busy === c.slug} onClick={() => void onLeave(c.id, c.slug)}>
                        {t("board.leave")}
                      </Button>
                    </>
                  ) : signedIn ? (
                    <Button disabled={busy === c.slug} onClick={() => void onJoin(c.slug)}>
                      {t("off.join")}
                    </Button>
                  ) : (
                    <Link
                      to="/login"
                      search={{ next: "/scoreboard" }}
                      className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
                    >
                      {t("off.signIn")}
                    </Link>
                  )}
                  {compact ? (
                    <Link
                      to="/scoreboard"
                      className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-medium text-muted hover:text-fg"
                    >
                      {t("off.open")}
                    </Link>
                  ) : null}
                </div>
                {c.joined ? <p className="mt-2 text-xs text-subtle">{t("off.joinedHint")}</p> : null}
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TourneyTeaser() {
  const t = useT();
  const [card, setCard] = useState<OfficialCard | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    listOfficialPublic()
      .then((list) => {
        if (!live) return;
        setCard(list.find((c) => c.slug === "week" && c.live) ?? list.find((c) => c.live) ?? list[0] ?? null);
      })
      .catch(() => {
        if (live) setCard(null);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!card) {
    return (
      <Link to="/scoreboard" className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
        {t("title.tourneys")}
      </Link>
    );
  }
  const name = t(`off.${card.slug}` as MsgKey);
  return (
    <Link to="/scoreboard" className="inline-flex min-h-11 items-center gap-2 text-xs text-accent underline-offset-4 hover:underline">
      <Trophy className="size-3.5" aria-hidden />
      {t("title.tourney", { name, clock: clockLabel(card.endsAt, now, t) })}
    </Link>
  );
}
