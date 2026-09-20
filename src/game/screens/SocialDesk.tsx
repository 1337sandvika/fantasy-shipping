import { useEffect, useState, type FormEvent } from "react";
import { Flag, Medal, Swords, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, type MsgKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { portName } from "../data/ports";
import { money, qty } from "../format";
import { CHALLENGE_DEFAULTS } from "../social/codes";
import { completedCount } from "../social/progress";
import { liveSnapshot, useSocial, type DeskTab } from "../social/store";
import type { Challenge, ChallengeKind, DailySlot, Friend } from "../social/types";
import { useGame } from "../store";
import { LineCard, dailyTitle } from "./LineCard";

const TABS: { id: DeskTab; icon: typeof Flag; label: MsgKey }[] = [
  { id: "today", icon: Flag, label: "desk.today" },
  { id: "challenges", icon: Swords, label: "desk.challenges" },
  { id: "line", icon: Medal, label: "desk.line" },
  { id: "friends", icon: Users, label: "desk.friends" },
];

const KINDS: ChallengeKind[] = ["ceu", "voyage", "profit", "ontime", "helm", "event", "green"];

export function SocialDesk() {
  const t = useT();
  const tab = useSocial((s) => s.deskTab);
  const setDesk = useSocial((s) => s.setDesk);
  const ensureDay = useSocial((s) => s.ensureDay);

  useEffect(() => {
    ensureDay();
  }, [ensureDay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDesk(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDesk]);

  return (
    <div
      className="scrim fixed inset-0 z-40 flex items-stretch justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desk-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setDesk(false);
      }}
    >
      <div className="sheet flex h-full w-full max-w-lg flex-col bg-bg-elevated text-fg sm:h-[min(42rem,90dvh)] sm:rounded-xl sm:border sm:border-border sm:shadow-panel">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="kicker">{t("desk.kicker")}</p>
            <h2 id="desk-title" className="font-display text-xl">
              {t("desk.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDesk(false)}
            className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
            aria-label={t("desk.close")}
          >
            <X className="size-5" />
          </button>
        </header>
        <nav className="flex shrink-0 gap-1 border-b border-border px-2 py-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDesk(true, item.id)}
                className={cn("tab flex flex-1 items-center justify-center gap-1.5 px-2 text-xs", tab === item.id && "tab-on")}
              >
                <Icon className="size-3.5" aria-hidden />
                {t(item.label)}
              </button>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === "today" ? <TodayPanel /> : null}
          {tab === "challenges" ? <ChallengesPanel /> : null}
          {tab === "line" ? <LinePanel /> : null}
          {tab === "friends" ? <FriendsPanel /> : null}
        </div>
      </div>
    </div>
  );
}

export function TodayStrip({ onOpen }: { onOpen?: () => void }) {
  const t = useT();
  const daily = useSocial((s) => s.blob.daily);
  const history = useSocial((s) => s.blob.history);
  const ensureDay = useSocial((s) => s.ensureDay);
  useEffect(() => {
    ensureDay();
  }, [ensureDay]);
  if (!daily) return null;
  const n = completedCount(daily.slots);
  const week = history.slice(0, 7);
  const mastered = week.filter((h) => h.completed === 3).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
    >
      <span>
        <span className="kicker block">{t("daily.kicker")}</span>
        <span className="text-sm">
          {t("daily.progress", { n, of: daily.slots.length })}
          {daily.claimed ? ` · ${t("daily.claimed")}` : ""}
        </span>
        {week.length ? (
          <span className="mt-0.5 block text-xs text-subtle">{t("daily.week", { n: mastered, of: week.length })}</span>
        ) : null}
      </span>
      <span className="flex gap-1" aria-hidden>
        {daily.slots.map((s) => (
          <span key={s.id} className={cn("size-2 rounded-full", s.done ? "bg-ok" : "bg-border")} />
        ))}
      </span>
    </button>
  );
}

function TodayPanel() {
  const t = useT();
  const daily = useSocial((s) => s.blob.daily);
  const history = useSocial((s) => s.blob.history);
  const claimed = daily?.claimed;
  const phase = useGame((g) => g.state.phase);
  const claimDaily = useGame((g) => g.claimDaily);
  if (!daily) return <p className="text-sm text-muted">{t("daily.loading")}</p>;
  const n = completedCount(daily.slots);
  const canClaim = n === 3 && !claimed && phase !== "title" && phase !== "end";
  const week = history.slice(0, 7);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("daily.blurb")}</p>
      <ul className="space-y-2">
        {daily.slots.map((slot) => (
          <DailyRow key={slot.id} slot={slot} />
        ))}
      </ul>
      {n === 3 && !claimed && phase === "title" ? (
        <p className="text-xs text-subtle">{t("daily.claimInCareer")}</p>
      ) : null}
      {canClaim ? (
        <Button className="w-full" onClick={() => claimDaily()}>
          {t("daily.claim", { n: money(daily.rewardCash) })}
        </Button>
      ) : null}
      {claimed ? <p className="text-sm text-ok">{t("daily.claimedBody", { n: money(daily.rewardCash) })}</p> : null}
      {week.length ? (
        <p className="text-xs text-subtle">
          {t("daily.week", { n: week.filter((h) => h.completed === 3).length, of: week.length })}
        </p>
      ) : null}
    </div>
  );
}

function DailyRow({ slot }: { slot: DailySlot }) {
  const t = useT();
  const pct = Math.min(100, Math.round((slot.progress / Math.max(1, slot.target)) * 100));
  return (
    <li className={cn("rounded-md border px-3 py-2", slot.done ? "border-ok/40 bg-ok/10" : "border-border bg-surface")}>
      <p className="text-sm font-medium">{dailyTitle(slot, t, portName)}</p>
      <p className="mt-0.5 text-xs text-muted">{t(`daily.${slot.id}.body` as MsgKey, { n: slot.target, port: slot.port ? portName(slot.port) : "" })}</p>
      <p className="mt-1 font-mono text-xs tabular-nums text-subtle">
        {slot.id === "profit" ? money(slot.progress) : qty(slot.progress)} / {slot.id === "profit" ? money(slot.target) : qty(slot.target)}
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
        <div className={cn("h-full", slot.done ? "bg-ok" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function ChallengesPanel() {
  const t = useT();
  const blob = useSocial((s) => s.blob);
  const createChallenge = useSocial((s) => s.createChallenge);
  const joinCode = useSocial((s) => s.joinCode);
  const lastInvite = useSocial((s) => s.lastInvite);
  const note = useSocial((s) => s.note);
  const [kind, setKind] = useState<ChallengeKind>("ceu");
  const [opp, setOpp] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const ch = createChallenge(kind, opp || null);
    if (ch?.code) {
      void navigator.clipboard?.writeText(ch.code).then(() => setCopied(true)).catch(() => {});
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("ch.blurb")}</p>
      <form onSubmit={onCreate} className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">{t("ch.new")}</p>
        <div className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "chip py-0",
                kind === k && "chip-on",
              )}
            >
              {t(`ch.kind.${k}` as MsgKey)}
            </button>
          ))}
        </div>
        <label className="block text-xs text-muted">
          {t("ch.opponent")}
          <select
            value={opp}
            onChange={(e) => setOpp(e.target.value)}
            className="field mt-1"
          >
            <option value="">{t("ch.openInvite")}</option>
            {blob.friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.handle}
                {f.source === "league" ? ` · ${t("ch.fromLeague")}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="w-full">
          {t("ch.create")}
        </Button>
      </form>
      {lastInvite ? (
        <p className="break-all rounded-md border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-xs">
          {lastInvite}
          {copied ? <span className="ml-2 font-sans text-ok">{t("board.copy")}</span> : null}
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (joinCode(code)) setCode("");
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="block flex-1 text-xs text-muted">
          {t("ch.joinCode")}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="field mt-1 font-mono text-xs"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={code.trim().length < 8}>
          {t("board.join")}
        </Button>
      </form>
      {note ? <p className="text-xs text-ok">{noteLabel(note, t)}</p> : null}
      {!blob.challenges.length ? <p className="text-sm text-muted">{t("ch.empty")}</p> : null}
      <ul className="space-y-2">
        {blob.challenges.map((ch) => (
          <ChallengeCard key={ch.id} ch={ch} />
        ))}
      </ul>
    </div>
  );
}

function ChallengeCard({ ch }: { ch: Challenge }) {
  const t = useT();
  const resultCode = useSocial((s) => s.resultCode);
  const inviteCode = useSocial((s) => s.inviteCode);
  const recordOpponent = useSocial((s) => s.recordOpponent);
  const lastResult = useSocial((s) => s.lastResult);
  const claimChallenge = useGame((g) => g.claimChallenge);
  const phase = useGame((g) => g.state.phase);
  const [their, setTheir] = useState("");
  const mine = ch.iAmHost ? ch.hostProgress : ch.guestProgress;
  const theirs = ch.iAmHost ? ch.guestProgress : ch.hostProgress;
  const rival = ch.iAmHost ? ch.guestHandle : ch.hostHandle;
  return (
    <li className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-sm font-medium">
        {t(`ch.kind.${ch.kind}` as MsgKey)} · {t(`ch.status.${ch.status}` as MsgKey)}
      </p>
      <p className="text-xs text-muted">
        {t("ch.vs", { name: rival || t("ch.openInvite") })} · {t("ch.target", { n: ch.kind === "profit" ? money(ch.target) : qty(ch.target) })}
      </p>
      <p className="mt-1 font-mono text-xs tabular-nums">
        {t("ch.mine", { n: ch.kind === "profit" ? money(mine) : qty(mine) })}
        {rival ? ` · ${t("ch.theirs", { n: ch.kind === "profit" ? money(theirs) : qty(theirs), name: rival })}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {ch.iAmHost ? (
          <Button size="sm" variant="secondary" onClick={() => inviteCode(ch.id)}>
            {t("ch.copyInvite")}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => resultCode(ch.id)}>
          {t("ch.copyResult")}
        </Button>
        {ch.status === "won" && ch.note !== "paid" && phase !== "title" && phase !== "end" ? (
          <Button size="sm" onClick={() => claimChallenge(ch.id)}>
            {t("ch.claim")}
          </Button>
        ) : null}
      </div>
      {lastResult ? <p className="mt-2 break-all font-mono text-[10px] text-subtle">{lastResult}</p> : null}
      {rival ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(their);
            if (Number.isFinite(n)) recordOpponent(ch.id, n);
            setTheir("");
          }}
        >
          <input
            value={their}
            onChange={(e) => setTheir(e.target.value)}
            inputMode="numeric"
            placeholder={t("ch.enterTheirs")}
            className="field min-h-9 flex-1 px-2 text-xs"
          />
          <Button size="sm" variant="ghost" type="submit">
            {t("ch.saveTheirs")}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

function LinePanel() {
  const t = useT();
  const state = useGame((g) => g.state);
  const handle = useSocial((s) => s.blob.selfHandle);
  const friends = useSocial((s) => s.blob.friends);
  const snap = liveSnapshot(state, handle || state.company || state.captain || t("auth.captain"));
  const setGuide = useSocial((s) => s.setGuide);
  return (
    <div className="space-y-3">
      {snap ? <LineCard snap={snap} mine /> : <p className="text-sm text-muted">{t("line.needCareer")}</p>}
      <p className="text-xs text-subtle">{t("line.boardHint")}</p>
      {friends.filter((f) => f.snapshot.points > 0 || f.snapshot.honours.length > 0).length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">{t("line.friends")}</p>
          {friends.slice(0, 6).map((f) => (
            <LineCard key={f.id} snap={f.snapshot} compact />
          ))}
        </div>
      ) : null}
      <button type="button" className="link-quiet" onClick={() => setGuide(true, 0)}>
        {t("title.help")}
      </button>
    </div>
  );
}

function FriendsPanel() {
  const t = useT();
  const friends = useSocial((s) => s.blob.friends);
  const addLocalFriend = useSocial((s) => s.addLocalFriend);
  const removeFriend = useSocial((s) => s.removeFriend);
  const createChallenge = useSocial((s) => s.createChallenge);
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("friends.blurb")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (addLocalFriend(name)) setName("");
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="block flex-1 text-xs text-muted">
          {t("friends.add")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={28}
            className="field mt-1"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={name.trim().length < 2}>
          {t("friends.save")}
        </Button>
      </form>
      {!friends.length ? <p className="text-sm text-muted">{t("friends.empty")}</p> : null}
      <ul className="space-y-2">
        {friends.map((f) => (
          <FriendRow key={f.id} friend={f} onChallenge={() => createChallenge("ceu", f.id)} onRemove={() => removeFriend(f.id)} />
        ))}
      </ul>
    </div>
  );
}

function FriendRow({ friend, onChallenge, onRemove }: { friend: Friend; onChallenge: () => void; onRemove: () => void }) {
  const t = useT();
  return (
    <li className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium">{friend.handle}</p>
        <p className="text-xs text-subtle">{t(`friends.src.${friend.source}` as MsgKey)}</p>
      </div>
      <p className="text-xs text-muted">
        {t("line.level", { n: friend.snapshot.level })} · {qty(friend.snapshot.points)} · {qty(friend.snapshot.deliveredCeu)} CEU
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={onChallenge}>
          {t("ch.challengeThem")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          {t("friends.remove")}
        </Button>
      </div>
    </li>
  );
}

export function ChallengeRail({
  mates,
  leagueId,
}: {
  mates: { handle: string; points: number; deliveredCeu: number; day: number }[];
  leagueId?: number;
}) {
  const t = useT();
  const importLeagueMates = useSocial((s) => s.importLeagueMates);
  const createChallenge = useSocial((s) => s.createChallenge);
  const friends = useSocial((s) => s.blob.friends);
  const setDesk = useSocial((s) => s.setDesk);
  useEffect(() => {
    importLeagueMates(mates.map((m) => ({ ...m, leagueId })));
  }, [importLeagueMates, leagueId, mates]);
  const list = friends.filter((f) => f.source === "league" || mates.some((m) => m.handle === f.handle));
  if (!mates.length) return null;
  return (
    <section className="panel mt-6 p-4">
      <p className="kicker">{t("ch.railKicker")}</p>
      <p className="mt-1 text-sm text-muted">{t("ch.railBlurb")}</p>
      <ul className="mt-3 space-y-2">
        {list.slice(0, 8).map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm">
              {f.handle}
              <span className="ml-2 text-xs text-subtle">
                {t("line.level", { n: f.snapshot.level })} · {qty(f.snapshot.points)}
              </span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => createChallenge("ceu", f.id, CHALLENGE_DEFAULTS.ceu)}>
              {t("ch.challengeThem")}
            </Button>
          </li>
        ))}
      </ul>
      <button type="button" className="link-quiet mt-3" onClick={() => setDesk(true, "challenges")}>
        {t("desk.challenges")}
      </button>
    </section>
  );
}

function noteLabel(note: string, t: (k: MsgKey) => string) {
  const map: Record<string, MsgKey> = {
    created: "ch.note.created",
    joined: "ch.note.joined",
    result: "ch.note.result",
    badcode: "ch.note.badcode",
    dupch: "ch.note.dup",
    noch: "ch.note.missing",
    friend: "friends.added",
    dup: "friends.dup",
    claimed: "daily.claimed",
  };
  const key = map[note];
  return key ? t(key) : "";
}
