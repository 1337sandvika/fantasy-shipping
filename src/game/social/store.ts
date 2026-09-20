import { create } from "zustand";
import { cleanHandle } from "../score";
import { loadSave } from "../save";
import type { GameState } from "../types";
import { CHALLENGE_DEFAULTS, decodeInvite, decodeResult, encodeInvite, encodeResult, makeId } from "./codes";
import { makeDaily } from "./dailies";
import { freshBlob, loadBlob, saveBlob } from "./persist";
import { applyCounters, completedCount, detectDelta, emptyCounters, tickChallenges, tickSlots } from "./progress";
import { emptySnapshot, snapshotFromCareer, utcDate } from "./profile";
import type { Challenge, ChallengeKind, DailyKind, Friend, LineSnapshot, SocialBlob } from "./types";

export type DeskTab = "today" | "challenges" | "line" | "friends";

type SocialStore = {
  blob: SocialBlob;
  desk: boolean;
  deskTab: DeskTab;
  guide: boolean;
  guidePage: number;
  note: string | null;
  lastInvite: string | null;
  lastResult: string | null;
  hydrate: () => void;
  setDesk: (v: boolean, tab?: DeskTab) => void;
  setGuide: (v: boolean, page?: number) => void;
  skipGuide: () => void;
  finishGuide: () => void;
  setSelfHandle: (h: string) => void;
  ensureDay: (now?: number) => void;
  applyCareer: (prev: GameState | null, next: GameState) => void;
  addLocalFriend: (handle: string) => Friend | null;
  removeFriend: (id: string) => void;
  importLeagueMates: (
    mates: { handle: string; points: number; deliveredCeu: number; day: number; endKind?: string; leagueId?: number }[],
  ) => void;
  createChallenge: (kind: ChallengeKind, opponentId: string | null, target?: number) => Challenge | null;
  joinCode: (code: string) => boolean;
  importResult: (code: string) => boolean;
  recordOpponent: (id: string, progress: number) => void;
  resultCode: (id: string) => string | null;
  inviteCode: (id: string, snap?: LineSnapshot) => string | null;
  markDailyClaimed: () => { cash: number; n: number } | null;
  markChallengeClaimed: (id: string) => { cash: number } | null;
};

function persist(blob: SocialBlob) {
  saveBlob(blob);
  return blob;
}

function rollover(blob: SocialBlob, now = Date.now()): SocialBlob {
  const today = utcDate(now);
  if (blob.daily?.date === today && blob.counterDate === today) return blob;
  let next = { ...blob };
  if (blob.daily && blob.daily.date !== today) {
    next.history = [{ date: blob.daily.date, completed: completedCount(blob.daily.slots) }, ...blob.history].slice(0, 21);
  }
  if (next.counterDate !== today) {
    next.counters = emptyCounters();
    next.counterDate = today;
  }
  if (!next.daily || next.daily.date !== today) {
    const yIds = (blob.daily?.slots.map((s) => s.id) ?? []) as DailyKind[];
    next.daily = makeDaily(today, yIds);
  }
  return next;
}

export const useSocial = create<SocialStore>((set, get) => ({
  blob: freshBlob(),
  desk: false,
  deskTab: "today",
  guide: false,
  guidePage: 0,
  note: null,
  lastInvite: null,
  lastResult: null,
  hydrate: () => {
    const blob = rollover(loadBlob());
    saveBlob(blob);
    set({ blob });
  },
  setDesk: (v, tab) => set({ desk: v, deskTab: tab ?? get().deskTab, note: null }),
  setGuide: (v, page) => set({ guide: v, guidePage: page ?? 0 }),
  skipGuide: () => {
    const blob = persist({ ...get().blob, onboardingDone: true });
    set({ blob, guide: false, guidePage: 0 });
  },
  finishGuide: () => {
    const blob = persist({ ...get().blob, onboardingDone: true });
    set({ blob, guide: false, guidePage: 0 });
  },
  setSelfHandle: (h) => {
    const blob = persist({ ...get().blob, selfHandle: cleanHandle(h) });
    set({ blob });
  },
  ensureDay: (now) => {
    const blob = persist(rollover(loadBlob(), now));
    set({ blob });
  },
  applyCareer: (prev, next) => {
    if (next.phase === "title") return;
    const d = detectDelta(prev, next);
    const today = utcDate();
    const needsRoll = get().blob.daily?.date !== today || get().blob.counterDate !== today;
    if (!d.any && !needsRoll) {
      if (next.company && !get().blob.selfHandle) {
        set({ blob: persist({ ...get().blob, selfHandle: cleanHandle(next.company) }) });
      }
      return;
    }
    let blob = needsRoll ? rollover(get().blob) : get().blob;
    if (next.company && !blob.selfHandle) blob = { ...blob, selfHandle: cleanHandle(next.company) };
    if (!d.any) {
      set({ blob: persist(blob) });
      return;
    }
    const counters = applyCounters(blob.counters, d);
    const daily = blob.daily ? { ...blob.daily, slots: tickSlots(blob.daily.slots, counters, d) } : blob.daily;
    const challenges = tickChallenges(blob.challenges, counters, d);
    set({ blob: persist({ ...blob, counters, daily, challenges }) });
  },
  addLocalFriend: (handle) => {
    const name = cleanHandle(handle);
    if (name.length < 2) return null;
    const blob = get().blob;
    if (blob.friends.some((f) => f.handle.toLowerCase() === name.toLowerCase())) {
      set({ note: "dup" });
      return null;
    }
    const friend: Friend = {
      id: makeId("f", 6),
      handle: name,
      source: "local",
      snapshot: emptySnapshot(name),
    };
    set({ blob: persist({ ...blob, friends: [friend, ...blob.friends].slice(0, 40) }), note: "friend" });
    return friend;
  },
  removeFriend: (id) => {
    const blob = get().blob;
    set({ blob: persist({ ...blob, friends: blob.friends.filter((f) => f.id !== id) }) });
  },
  importLeagueMates: (mates) => {
    if (!mates.length) return;
    const blob = get().blob;
    const mine = (blob.selfHandle || "").toLowerCase();
    const extra: Friend[] = [];
    const rest = blob.friends.map((f) => ({ ...f, snapshot: { ...f.snapshot, honours: [...f.snapshot.honours] } }));
    let changed = false;
    for (const m of mates) {
      const handle = cleanHandle(m.handle);
      if (!handle || handle.toLowerCase() === mine) continue;
      const existing = rest.find((f) => f.handle.toLowerCase() === handle.toLowerCase());
      const snap = {
        ...emptySnapshot(handle),
        points: m.points,
        deliveredCeu: m.deliveredCeu,
        day: m.day,
        level: 1 + Math.floor(m.deliveredCeu / 8000) + Math.floor(m.points / 400_000),
      };
      if (existing) {
        if (existing.snapshot.points !== snap.points || existing.snapshot.deliveredCeu !== snap.deliveredCeu) changed = true;
        existing.snapshot = { ...existing.snapshot, ...snap, honours: existing.snapshot.honours };
        existing.source = existing.source === "local" ? "league" : existing.source;
        existing.leagueId = m.leagueId ?? existing.leagueId;
      } else if (!extra.some((f) => f.handle.toLowerCase() === handle.toLowerCase())) {
        extra.push({
          id: makeId("lg", 6),
          handle,
          source: "league",
          leagueId: m.leagueId,
          snapshot: snap,
        });
        changed = true;
      }
    }
    if (!changed && extra.length === 0) return;
    set({ blob: persist({ ...blob, friends: [...extra, ...rest].slice(0, 40) }) });
  },
  createChallenge: (kind, opponentId, target) => {
    const blob = get().blob;
    const friend = opponentId ? blob.friends.find((f) => f.id === opponentId) ?? null : null;
    const ch: Challenge = {
      id: makeId("", 6),
      code: "",
      kind,
      status: friend ? "active" : "open",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      hostHandle: blob.selfHandle || "Line",
      guestHandle: friend?.handle ?? null,
      opponentId: friend?.id ?? null,
      target: Math.max(1, Math.round(target ?? CHALLENGE_DEFAULTS[kind])),
      hostProgress: 0,
      guestProgress: 0,
      iAmHost: true,
    };
    ch.code = encodeInvite(ch, friend?.snapshot);
    set({
      blob: persist({ ...blob, challenges: [ch, ...blob.challenges].slice(0, 24) }),
      lastInvite: ch.code,
      note: "created",
      deskTab: "challenges",
    });
    return ch;
  },
  joinCode: (code) => {
    const parsed = decodeInvite(code);
    if (!parsed) {
      set({ note: "badcode" });
      return false;
    }
    const blob = get().blob;
    if (blob.challenges.some((c) => c.id === parsed.challenge.id)) {
      set({ note: "dupch" });
      return false;
    }
    const ch = {
      ...parsed.challenge,
      guestHandle: blob.selfHandle || "Line",
      opponentId: parsed.friend.id,
      iAmHost: false,
      status: "active" as const,
    };
    const friends = blob.friends.some((f) => f.handle.toLowerCase() === parsed.friend.handle.toLowerCase())
      ? blob.friends
      : [parsed.friend, ...blob.friends];
    set({
      blob: persist({ ...blob, challenges: [ch, ...blob.challenges], friends: friends.slice(0, 40) }),
      note: "joined",
      deskTab: "challenges",
    });
    return true;
  },
  importResult: (code) => {
    const parsed = decodeResult(code);
    if (!parsed) {
      set({ note: "badcode" });
      return false;
    }
    const blob = get().blob;
    const ch = blob.challenges.find((c) => c.id === parsed.id);
    if (!ch) {
      set({ note: "noch" });
      return false;
    }
    const updated = blob.challenges.map((c) => {
      if (c.id !== parsed.id) return c;
      if (c.iAmHost) return { ...c, guestProgress: parsed.progress, guestHandle: c.guestHandle || parsed.handle, status: "active" as const };
      return { ...c, hostProgress: parsed.progress, status: "active" as const };
    });
    set({ blob: persist({ ...blob, challenges: updated }), note: "result" });
    return true;
  },
  recordOpponent: (id, progress) => {
    const blob = get().blob;
    const updated = blob.challenges.map((c) => {
      if (c.id !== id) return c;
      if (c.iAmHost) return { ...c, guestProgress: Math.max(0, Math.round(progress)) };
      return { ...c, hostProgress: Math.max(0, Math.round(progress)) };
    });
    set({ blob: persist({ ...blob, challenges: updated }), note: "result" });
  },
  resultCode: (id) => {
    const blob = get().blob;
    const ch = blob.challenges.find((c) => c.id === id);
    if (!ch) return null;
    const code = encodeResult(ch, blob.selfHandle || "Line");
    set({ lastResult: code });
    return code;
  },
  inviteCode: (id, snap) => {
    const blob = get().blob;
    const ch = blob.challenges.find((c) => c.id === id);
    if (!ch) return null;
    const code = encodeInvite(ch, snap);
    set({ lastInvite: code });
    return code;
  },
  markDailyClaimed: () => {
    const blob = rollover(get().blob);
    if (!blob.daily || blob.daily.claimed) return null;
    const n = completedCount(blob.daily.slots);
    if (n < 3) return null;
    const cash = blob.daily.rewardCash;
    set({ blob: persist({ ...blob, daily: { ...blob.daily, claimed: true } }), note: "claimed" });
    return { cash, n };
  },
  markChallengeClaimed: (id) => {
    const blob = get().blob;
    const ch = blob.challenges.find((c) => c.id === id);
    if (!ch || ch.status !== "won" || ch.note === "paid") return null;
    const cash = 35_000;
    const updated = blob.challenges.map((c) => (c.id === id ? { ...c, note: "paid" } : c));
    set({ blob: persist({ ...blob, challenges: updated }) });
    return { cash };
  },
}));

export function liveSnapshot(state: GameState | null, handle: string): LineSnapshot | null {
  const s = state && state.phase !== "title" ? state : loadSave();
  if (!s || s.phase === "title") return null;
  return snapshotFromCareer(s, handle || s.company || s.captain);
}

export function bootSocial() {
  useSocial.getState().hydrate();
}
