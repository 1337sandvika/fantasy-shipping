import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errMsg, useT, type MsgKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { qty } from "../format";
import {
  continueSeason,
  createLeague,
  endSeason,
  extendSeason,
  joinLeague,
  leaveLeague,
  listGlobalBoard,
  listLeagueBoard,
  listMyCareers,
  listMyLeagues,
  setMemberTeam,
  updateLeagueSettings,
  type BoardRow,
  type LeagueBoard,
  type LeagueMode,
  type LeagueSummary,
  type MyCareerRow,
  type Scoring,
} from "../score-api";
import { AuthBar } from "./AuthBar";
import { OfficialList } from "./OfficialTournaments";

type Tab = "play" | "mine" | "league";

const DURS: { days: number; key: MsgKey }[] = [
  { days: 7, key: "comp.d7" },
  { days: 14, key: "comp.d14" },
  { days: 30, key: "comp.d30" },
  { days: 60, key: "comp.d60" },
  { days: 90, key: "comp.d90" },
  { days: 180, key: "comp.d180" },
  { days: 0, key: "comp.d0" },
];

const MODES: { id: LeagueMode; label: MsgKey; hint: MsgKey }[] = [
  { id: "solo", label: "comp.solo", hint: "comp.soloh" },
  { id: "teams", label: "comp.teams", hint: "comp.teamsh" },
];

const SCORES: { id: Scoring; label: MsgKey; hint: MsgKey }[] = [
  { id: "best", label: "comp.score.best", hint: "comp.score.besth" },
  { id: "latest", label: "comp.score.latest", hint: "comp.score.latesth" },
  { id: "sum", label: "comp.score.sum", hint: "comp.score.sumh" },
];

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

function failMsg(e: unknown, fallback: string, locT: typeof errMsg) {
  const raw = e instanceof Error ? e.message : String(e);
  const mapped = locT(raw);
  return mapped === raw ? fallback : mapped;
}

export function ScoreboardScreen() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("play");
  const t = useT();

  return (
    <div className="safe-pad flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg text-fg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8">
        <div>
          <p className="text-xs font-medium tracking-[0.28em] text-accent">{t("brand.results")}</p>
          <h1 className="font-display text-2xl sm:text-3xl">{t("board.title")}</h1>
        </div>
        <AuthBar
          showTable={false}
          extra={
            <Link
              to="/"
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-bg-elevated/90 px-3 text-xs font-medium text-muted hover:text-fg"
            >
              {t("auth.play")}
            </Link>
          }
        />
      </header>

      <nav className="flex gap-1 border-b border-border px-3 py-1 sm:px-8">
        {(["play", "mine", "league"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm font-medium",
              tab === id ? "bg-surface text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t(`board.${id}` as MsgKey)}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-8">
        {tab === "play" ? <OfficialList signedIn={Boolean(user)} pending={isPending} /> : null}
        {tab === "mine" ? <MineTab signedIn={Boolean(user)} pending={isPending} /> : null}
        {tab === "league" ? <LeagueTab signedIn={Boolean(user)} pending={isPending} /> : null}
      </main>
    </div>
  );
}

function NeedAccount({ title, body }: { title: string; body: string }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link
        to="/login"
        search={{ next: "/scoreboard" }}
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
      >
        {t("auth.signIn")}
      </Link>
    </div>
  );
}

function MineTab({ signedIn, pending }: { signedIn: boolean; pending: boolean }) {
  const t = useT();
  const [rows, setRows] = useState<MyCareerRow[] | null>(null);
  const [global, setGlobal] = useState<BoardRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    setErr(null);
    Promise.all([listMyCareers(), listGlobalBoard()])
      .then(([mine, g]) => {
        if (!live) return;
        setRows(mine);
        setGlobal(g);
      })
      .catch((e) => {
        if (live) setErr(failMsg(e, t("board.mineFail"), errMsg));
      });
    return () => {
      live = false;
    };
  }, [signedIn, t]);

  if (pending) return <p className="text-sm text-muted">{t("board.fetchMine")}</p>;
  if (!signedIn) {
    return <NeedAccount title={t("board.needInternTitle")} body={t("board.needInternBody")} />;
  }
  if (err) return <p className="text-sm text-danger">{err}</p>;
  if (!rows) return <p className="text-sm text-muted">{t("board.fetchMine")}</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">{t("board.emptyMine")}</p>;

  const best = [...rows].sort((a, b) => b.points - a.points)[0]!;
  const place = global?.find((r) => r.mine)?.rank;

  return (
    <div>
      <h2 className="font-display text-xl">{t("board.internHeader")}</h2>
      <p className="mt-1 text-sm text-muted">
        {t("board.bestCareer", { kind: t(`end.kind.${best.endKind}` as MsgKey) })} · {qty(best.points)}
      </p>
      <p className="mt-1 text-xs text-subtle">{place ? t("board.globalRank") + ` #${place}` : t("board.notTop")}</p>
      <ol className="mt-5 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2">
            <span className="text-sm">
              {t("board.dayCeu", { kind: t(`end.kind.${r.endKind}` as MsgKey), day: r.day, ceu: qty(r.deliveredCeu) })}
            </span>
            <span className="font-mono text-sm tabular-nums">{qty(r.points)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LeagueTab({ signedIn, pending }: { signedIn: boolean; pending: boolean }) {
  const t = useT();
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [board, setBoard] = useState<LeagueBoard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createDuration, setCreateDuration] = useState(60);
  const [createScoring, setCreateScoring] = useState<Scoring>("best");
  const [createMode, setCreateMode] = useState<LeagueMode>("solo");
  const [teamName, setTeamName] = useState("");
  const [joinTeam, setJoinTeam] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await listMyLeagues();
    setLeagues(list);
    return list;
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    setErr(null);
    reload()
      .then((list) => {
        if (!live) return;
        if (list[0] && selected == null) {
          const friend = list.find((l) => l.kind !== "official") ?? null;
          if (friend) setSelected(friend.id);
        }
      })
      .catch((e) => {
        if (live) setErr(failMsg(e, t("board.leagueFail"), errMsg));
      });
    return () => {
      live = false;
    };
    // selected is intentionally omitted — only hydrate once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, reload, t]);

  useEffect(() => {
    if (!signedIn || selected == null) {
      setBoard(null);
      return;
    }
    let live = true;
    setBoard(null);
    listLeagueBoard({ data: { id: selected } })
      .then((b) => {
        if (live) setBoard(b);
      })
      .catch((e) => {
        if (live) setErr(failMsg(e, t("board.leagueBoardFail"), errMsg));
      });
    return () => {
      live = false;
    };
  }, [signedIn, selected, t]);

  if (pending) return <p className="text-sm text-muted">{t("board.fetchLeagues")}</p>;
  if (!signedIn) {
    return <NeedAccount title={t("board.needLeagueTitle")} body={t("board.needLeagueBody")} />;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setErr(null);
    try {
      const res = await createLeague({
        data: { name, durationDays: createDuration, scoring: createScoring, mode: createMode, team: teamName },
      });
      setName("");
      setTeamName("");
      await reload();
      setSelected(res.id);
    } catch (e) {
      setErr(failMsg(e, t("board.createFail"), errMsg));
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await joinLeague({ data: { code, team: joinTeam } });
      setCode("");
      setJoinTeam("");
      await reload();
      setSelected(res.id);
    } catch (e) {
      setErr(failMsg(e, t("board.joinFail"), errMsg));
    } finally {
      setBusy(false);
    }
  }

  async function onLeave(id: number) {
    setBusy(true);
    setErr(null);
    try {
      await leaveLeague({ data: { id } });
      const list = await reload();
      const next = list.find((l) => l.kind !== "official");
      setSelected(next?.id ?? null);
      setBoard(null);
    } catch (e) {
      setErr(failMsg(e, t("board.leaveFail"), errMsg));
    } finally {
      setBusy(false);
    }
  }

  const friends = (leagues ?? []).filter((l) => l.kind !== "official");
  const current = friends.find((l) => l.id === selected) ?? null;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-bg-elevated p-5">
        <p className="text-xs font-medium tracking-[0.22em] text-accent">{t("comp.kicker")}</p>
        <p className="mt-2 text-sm text-muted">{t("comp.blurb")}</p>
        <p className="mt-2 text-xs text-subtle">{t("comp.createHint")}</p>
        <form onSubmit={onCreate} className="mt-4 space-y-4">
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
          <SeasonFields
            duration={createDuration}
            scoring={createScoring}
            mode={createMode}
            onDuration={setCreateDuration}
            onScoring={setCreateScoring}
            onMode={setCreateMode}
          />
          {createMode === "teams" ? (
            <label className="block text-xs font-medium text-muted">
              {t("comp.teamName")}
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={22}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </label>
          ) : null}
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            {t("board.create")}
          </Button>
        </form>
        <form onSubmit={onJoin} className="mt-6 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-xs font-medium text-muted">
              {t("board.inviteCode")}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm tracking-widest text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </label>
            <label className="block flex-1 text-xs font-medium text-muted">
              {t("comp.teamName")}
              <input
                value={joinTeam}
                onChange={(e) => setJoinTeam(e.target.value)}
                maxLength={22}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={busy || code.trim().length < 4}>
              {t("board.join")}
            </Button>
          </div>
        </form>
      </section>

      {err ? <p className="text-sm text-danger">{err}</p> : null}
      {note ? <p className="text-sm text-ok">{note}</p> : null}

      {!leagues ? (
        <p className="text-sm text-muted">{t("board.fetchLeagues")}</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-muted">{t("board.emptyLeagues")}</p>
      ) : (
        <ul className="space-y-2">
          {friends.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setSelected(l.id)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm",
                  selected === l.id ? "border-accent bg-surface" : "border-border bg-bg-elevated hover:border-muted",
                )}
              >
                <span>
                  <span className="font-medium">{l.name}</span>
                  <span className="ml-2 text-xs text-subtle">
                    {t("board.code")} {l.code} · {l.members} {l.members === 1 ? t("board.member") : t("board.members")}
                    {l.owner ? ` · ${t("board.owner")}` : ""}
                    {l.mode === "teams" ? ` · ${t("comp.teams")}` : ""}
                  </span>
                </span>
                <span className="text-xs text-muted">{t("comp.season", { n: l.seasonNo })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {current ? (
        <LeagueDetail
          league={current}
          board={board}
          busy={busy}
          onCopied={() => setNote(t("board.copy"))}
          onLeave={() => onLeave(current.id)}
          onSaved={async () => {
            setNote(t("comp.saved"));
            await reload();
            if (selected != null) setBoard(await listLeagueBoard({ data: { id: selected } }));
          }}
          onRefresh={async () => {
            await reload();
            if (selected != null) setBoard(await listLeagueBoard({ data: { id: selected } }));
          }}
        />
      ) : null}
    </div>
  );
}

function SeasonFields({
  duration,
  scoring,
  mode,
  onDuration,
  onScoring,
  onMode,
}: {
  duration: number;
  scoring: Scoring;
  mode?: LeagueMode;
  onDuration: (n: number) => void;
  onScoring: (s: Scoring) => void;
  onMode?: (m: LeagueMode) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      {onMode && mode ? (
        <div>
          <p className="text-xs font-medium text-muted">{t("comp.mode")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onMode(m.id)}
                className={cn(
                  "min-h-11 rounded-md border px-3 py-2 text-left",
                  mode === m.id ? "border-accent bg-surface" : "border-border hover:border-muted",
                )}
              >
                <span className="block text-sm font-medium">{t(m.label)}</span>
                <span className="mt-1 block text-xs text-subtle">{t(m.hint)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-muted">{t("comp.duration")}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {DURS.map((d) => (
            <button
              key={d.days}
              type="button"
              onClick={() => onDuration(d.days)}
              className={cn(
                "min-h-11 rounded-md border px-3 text-xs font-medium",
                duration === d.days ? "border-accent bg-surface text-fg" : "border-border text-muted hover:text-fg",
              )}
            >
              {t(d.key)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted">{t("comp.scoring")}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {SCORES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onScoring(s.id)}
              className={cn(
                "min-h-11 rounded-md border px-3 py-2 text-left",
                scoring === s.id ? "border-accent bg-surface" : "border-border hover:border-muted",
              )}
            >
              <span className="block text-sm font-medium">{t(s.label)}</span>
              <span className="mt-1 block text-xs text-subtle">{t(s.hint)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeasonBanner({ meta }: { meta: LeagueBoard["meta"] }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg">
          {t("comp.season", { n: meta.seasonNo })}
          <span className="ml-2 text-xs font-sans tracking-wider text-accent">{meta.live ? t("comp.live") : t("comp.ended")}</span>
        </p>
        <p className="text-xs text-muted">{clockLabel(meta.endsAt, now, t)}</p>
      </div>
      {meta.champion && meta.champion.points > 0 ? (
        <p className="mt-1 text-xs text-subtle">
          {t("comp.champion", { name: meta.champion.handle })} · {t("comp.championPts", { n: qty(meta.champion.points) })}
        </p>
      ) : null}
    </div>
  );
}

function LeagueDetail({
  league,
  board,
  busy,
  onCopied,
  onLeave,
  onSaved,
  onRefresh,
}: {
  league: LeagueSummary;
  board: LeagueBoard | null;
  busy: boolean;
  onCopied: () => void;
  onLeave: () => void;
  onSaved: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const t = useT();
  const [duration, setDuration] = useState(league.durationDays);
  const [scoring, setScoring] = useState<Scoring>(league.scoring);
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [switchTeam, setSwitchTeam] = useState(league.teamName ?? "");

  useEffect(() => {
    setDuration(league.durationDays);
    setScoring(league.scoring);
    setSwitchTeam(league.teamName ?? "");
  }, [league.id, league.durationDays, league.scoring, league.teamName]);

  async function saveSettings() {
    setSaving(true);
    setLocalErr(null);
    try {
      await updateLeagueSettings({ data: { id: league.id, durationDays: duration, scoring } });
      await onSaved();
    } catch (e) {
      setLocalErr(failMsg(e, t("board.leagueFail"), errMsg));
    } finally {
      setSaving(false);
    }
  }

  async function roll(kind: "end" | "continue") {
    setSaving(true);
    setLocalErr(null);
    try {
      if (kind === "end") await endSeason({ data: { id: league.id } });
      else await continueSeason({ data: { id: league.id } });
      await onRefresh();
    } catch (e) {
      setLocalErr(failMsg(e, t("err.LEAGUE_SEASON"), errMsg));
    } finally {
      setSaving(false);
    }
  }

  async function extend(extraDays: number) {
    setSaving(true);
    setLocalErr(null);
    try {
      await extendSeason({ data: { id: league.id, extraDays } });
      await onRefresh();
    } catch (e) {
      setLocalErr(failMsg(e, t("err.LEAGUE_ENDED"), errMsg));
    } finally {
      setSaving(false);
    }
  }

  async function saveTeam() {
    setSaving(true);
    setLocalErr(null);
    try {
      await setMemberTeam({ data: { id: league.id, team: switchTeam } });
      await onRefresh();
    } catch (e) {
      setLocalErr(failMsg(e, t("err.LEAGUE_TEAM"), errMsg));
    } finally {
      setSaving(false);
    }
  }

  const meta = board?.meta;
  const live = meta?.live ?? league.live;
  const hintKey: MsgKey =
    (meta?.scoring ?? league.scoring) === "latest"
      ? "comp.hintLatest"
      : (meta?.scoring ?? league.scoring) === "sum"
        ? "comp.hintSum"
        : "comp.hintBest";

  return (
    <section className="space-y-4">
      {meta ? <SeasonBanner meta={meta} /> : <p className="text-sm text-muted">{t("board.fetchLeagueBoard")}</p>}
      <p className="text-xs text-subtle">{live ? t(hintKey) : t("comp.frozen")}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(league.code).then(onCopied);
          }}
        >
          {t("board.copy")}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onLeave}>
          {t("board.leave")}
        </Button>
      </div>

      {league.mode === "teams" ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void saveTeam();
          }}
        >
          <label className="block flex-1 text-xs font-medium text-muted">
            {t("comp.teamName")}
            <input
              value={switchTeam}
              onChange={(e) => setSwitchTeam(e.target.value)}
              maxLength={22}
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
          <Button type="submit" size="sm" variant="secondary" disabled={saving || switchTeam.trim().length < 2}>
            {t("yard.save")}
          </Button>
        </form>
      ) : null}

      {league.owner && meta ? (
        <div className="rounded-xl border border-border bg-bg-elevated p-4">
          <p className="text-xs font-medium tracking-wide text-muted">{t("comp.settings")}</p>
          <p className="mt-1 text-xs text-subtle">{t("comp.applyNow")}</p>
          <div className="mt-3">
            <SeasonFields duration={duration} scoring={scoring} onDuration={setDuration} onScoring={setScoring} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={saveSettings}>
              {t("comp.save")}
            </Button>
            {live ? (
              <>
                <Button size="sm" variant="secondary" disabled={saving} onClick={() => roll("end")}>
                  {t("comp.endNow")}
                </Button>
                <span className="self-center text-xs text-subtle">{t("comp.extend")}</span>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => extend(7)}>
                  {t("comp.extend7")}
                </Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => extend(14)}>
                  {t("comp.extend14")}
                </Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => extend(30)}>
                  {t("comp.extend30")}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => roll("continue")}>
                {t("comp.continue")}
              </Button>
            )}
          </div>
          {localErr ? <p className="mt-2 text-xs text-danger">{localErr}</p> : null}
        </div>
      ) : league.owner ? null : (
        <p className="text-xs text-subtle">{t("comp.ownerOnly")}</p>
      )}

      {board && board.teams.length > 0 ? (
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted">{t("comp.teamBoard")}</h3>
          <ol className="mt-2 space-y-1">
            {board.teams.map((r) => (
              <li
                key={r.name}
                className={cn(
                  "flex items-baseline justify-between gap-3 rounded-md border px-3 py-2",
                  r.mine ? "border-accent bg-surface" : "border-border bg-bg-elevated",
                )}
              >
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="w-6 font-mono text-xs tabular-nums text-subtle">{r.rank}</span>
                  <span className="truncate text-sm font-medium">
                    {r.name === "Unaffiliated" ? t("comp.unaffiliated") : r.name}
                    {r.mine ? <span className="ml-2 text-xs font-normal text-accent">{t("board.you")}</span> : null}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-mono text-sm tabular-nums">{qty(r.points)}</span>
                  <span className="ml-2 hidden text-xs text-subtle sm:inline">{t("comp.teamMembers", { n: r.members })}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {board ? (
        board.rows.length === 0 || board.rows.every((r) => r.points === 0) ? (
          <p className="text-sm text-muted">{t("comp.noneInSeason")}</p>
        ) : (
          <BoardTable rows={board.rows} kind={board.meta.scoring} />
        )
      ) : null}

      {board && board.past.length > 0 ? <PastSeasons past={board.past} /> : null}
    </section>
  );
}

function PastSeasons({ past }: { past: LeagueBoard["past"] }) {
  const t = useT();
  return (
    <div>
      <h3 className="text-xs font-medium tracking-wide text-muted">{t("comp.past")}</h3>
      <ul className="mt-2 space-y-1">
        {past.map((p) => (
          <li key={p.seasonNo} className="text-xs text-subtle">
            {p.champion
              ? t("comp.pastRow", { n: p.seasonNo, name: p.champion.handle, pts: qty(p.champion.points) })
              : t("comp.pastEmpty", { n: p.seasonNo })}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardTable({ rows, kind }: { rows: BoardRow[]; kind: Scoring | "best" }) {
  const t = useT();
  return (
    <ol className="space-y-1">
      {rows.map((r) => (
        <li
          key={`${r.rank}-${r.handle}`}
          className={cn(
            "flex items-baseline justify-between gap-3 rounded-md border px-3 py-2",
            r.mine ? "border-accent bg-surface" : "border-border bg-bg-elevated",
          )}
        >
          <span className="flex min-w-0 items-baseline gap-3">
            <span className="w-6 font-mono text-xs tabular-nums text-subtle">{r.rank}</span>
            <span className="truncate text-sm font-medium">
              {r.handle}
              {r.mine ? <span className="ml-2 text-xs font-normal text-accent">{t("board.you")}</span> : null}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="font-mono text-sm tabular-nums">{qty(r.points)}</span>
            <span className="ml-2 hidden text-xs text-subtle sm:inline">
              {r.points <= 0
                ? t("board.noCareerYet")
                : kind === "sum" && r.runs
                  ? t("comp.runs", { n: r.runs })
                  : t("board.rowMeta", {
                      kind: r.endKind ? t(`end.kind.${r.endKind}` as MsgKey) : "—",
                      ceu: qty(r.deliveredCeu),
                      day: r.day,
                    })}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
