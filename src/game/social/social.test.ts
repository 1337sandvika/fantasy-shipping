import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHALLENGE_DEFAULTS, decodeInvite, decodeResult, encodeInvite, encodeResult } from "./codes.ts";
import { DAILY_CATALOG, makeDaily } from "./dailies.ts";
import { lineLevel } from "./profile.ts";
import { detectDelta, emptyCounters, applyCounters, tickSlots, tickChallenges } from "./progress.ts";
import type { Challenge } from "./types.ts";
import type { GameState } from "../types.ts";

function ship(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Test",
    hullId: "a",
    year: 2018,
    ceu: 4000,
    hhCap: 40,
    burn: 0.1,
    fuel: "lng",
    ice: false,
    speed: 18,
    opex: 8000,
    condition: 80,
    bunkers: 200,
    bunkerCap: 480,
    lastDrydock: 0,
    upgrades: [],
    hold: [],
    port: "zeebrugge",
    atSea: false,
    etsAcc: 0,
    ...over,
  };
}

function gs(over: Partial<GameState> = {}): GameState {
  return {
    phase: "port",
    captain: "Line",
    company: "Line",
    director: "MD",
    day: 10,
    cash: 1_000_000,
    debt: 0,
    reputation: 55,
    co2t: 0,
    fines: 0,
    voyages: 2,
    deliveredCeu: 100,
    heat: 0,
    greyEarned: 0,
    heatBeat: 0,
    heatNoteDay: -99,
    probe: false,
    trial: null,
    ets: null,
    etsAcc: 0,
    lastEtsMonth: -1,
    fleet: [ship() as GameState["fleet"][number]],
    activeId: "s1",
    selectedPort: "zeebrugge",
    lots: {},
    market: [],
    marketDay: 0,
    tc: [],
    tcDay: 0,
    charters: [],
    seed: 1,
    legs: [],
    event: null,
    news: [],
    log: [],
    tab: "cargo",
    endKind: null,
    milestones: [],
    honours: [],
    brandOnTime: {},
    preferred: [],
    onTimeStreak: 0,
    lastGreenMonth: -1,
    ceuMarks: [],
    pendingEvent: null,
    helm: null,
    ...over,
  };
}

describe("daily rotation", () => {
  it("is deterministic for a date", () => {
    const a = makeDaily("2026-09-19");
    const b = makeDaily("2026-09-19");
    assert.equal(a.slots.length, 3);
    assert.deepEqual(
      a.slots.map((s) => s.id),
      b.slots.map((s) => s.id),
    );
    assert.deepEqual(
      a.slots.map((s) => s.target),
      b.slots.map((s) => s.target),
    );
  });

  it("changes across consecutive days", () => {
    const a = makeDaily("2026-09-19");
    const b = makeDaily("2026-09-20", a.slots.map((s) => s.id));
    const same = a.slots.every((s, i) => s.id === b.slots[i]?.id);
    assert.equal(same, false);
  });

  it("covers several skills over a week", () => {
    const skills = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      const day = `2026-09-0${d}`;
      const slots = makeDaily(day).slots;
      for (const s of slots) {
        const def = DAILY_CATALOG.find((x) => x.id === s.id);
        if (def) skills.add(def.skill);
      }
    }
    assert.ok(skills.size >= 4);
  });
});

describe("challenge codes", () => {
  it("round-trips an invite", () => {
    const ch: Challenge = {
      id: "ABC123",
      code: "",
      kind: "ceu",
      status: "open",
      createdAt: "2026-09-19T00:00:00.000Z",
      expiresAt: "2026-09-26T00:00:00.000Z",
      hostHandle: "North Sea Line",
      guestHandle: null,
      opponentId: null,
      target: CHALLENGE_DEFAULTS.ceu,
      hostProgress: 0,
      guestProgress: 0,
      iAmHost: true,
    };
    const code = encodeInvite(ch);
    const parsed = decodeInvite(code);
    assert.ok(parsed);
    assert.equal(parsed!.challenge.id, "ABC123");
    assert.equal(parsed!.challenge.kind, "ceu");
    assert.equal(parsed!.challenge.target, CHALLENGE_DEFAULTS.ceu);
    assert.equal(parsed!.friend.handle, "North Sea Line");
    assert.equal(parsed!.challenge.iAmHost, false);
  });

  it("rejects a tampered checksum", () => {
    const ch: Challenge = {
      id: "ABC123",
      code: "",
      kind: "helm",
      status: "open",
      createdAt: "2026-09-19T00:00:00.000Z",
      expiresAt: "2026-09-26T00:00:00.000Z",
      hostHandle: "Line",
      guestHandle: null,
      opponentId: null,
      target: 2,
      hostProgress: 0,
      guestProgress: 0,
      iAmHost: true,
    };
    const code = encodeInvite(ch);
    const broken = code.slice(0, -1) + (code.endsWith("A") ? "B" : "A");
    assert.equal(decodeInvite(broken), null);
  });

  it("round-trips a result", () => {
    const ch: Challenge = {
      id: "ABC123",
      code: "x",
      kind: "voyage",
      status: "active",
      createdAt: "2026-09-19T00:00:00.000Z",
      expiresAt: "2026-09-26T00:00:00.000Z",
      hostHandle: "A",
      guestHandle: "B",
      opponentId: "f1",
      target: 3,
      hostProgress: 2,
      guestProgress: 1,
      iAmHost: true,
    };
    const code = encodeResult(ch, "A");
    const parsed = decodeResult(code);
    assert.ok(parsed);
    assert.equal(parsed!.id, "ABC123");
    assert.equal(parsed!.progress, 2);
  });
});

describe("progress deltas", () => {
  it("counts CEU, on-time, and helm without a pilot", () => {
    const prev = gs({
      deliveredCeu: 100,
      onTimeStreak: 1,
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge" },
    });
    const next = gs({ deliveredCeu: 450, onTimeStreak: 2, cash: 1_080_000, helm: null });
    const d = detectDelta(prev, next);
    assert.equal(d.ceu, 350);
    assert.equal(d.onTime, 1);
    assert.equal(d.helmClean, 1);
    assert.equal(d.profit, 80_000);
    assert.equal(d.any, true);
  });

  it("does not count hiring a harbour pilot as helm mastery", () => {
    const prev = gs({
      cash: 1_000_000,
      helm: { kind: "depart", shipId: "s1", port: "zeebrugge", dest: "goteborg" },
    });
    const next = gs({ cash: 988_000, helm: null });
    const d = detectDelta(prev, next);
    assert.equal(d.helmClean, 0);
  });

  it("ticks daily slots from counters", () => {
    const daily = makeDaily("2026-01-15");
    daily.slots = [
      { id: "ceu", target: 200, progress: 0, done: false },
      { id: "helm", target: 1, progress: 0, done: false },
      { id: "event", target: 1, progress: 0, done: false },
    ];
    const prev = gs({ event: { id: "fog", title: "x", body: "y", a: { id: "a", label: "a", hint: "" } } });
    const next = gs({
      deliveredCeu: 300,
      event: null,
      helm: null,
    });
    const withHelm = gs({
      ...next,
      deliveredCeu: 300,
    });
    const fromHelm = detectDelta(
      gs({ deliveredCeu: 100, helm: { kind: "arrive", shipId: "s1", port: "zeebrugge" } }),
      withHelm,
    );
    let c = emptyCounters();
    c = applyCounters(c, fromHelm);
    const dEvent = detectDelta(prev, gs({ deliveredCeu: 100 }));
    c = applyCounters(c, dEvent);
    const slots = tickSlots(daily.slots, c, {
      ...fromHelm,
      events: dEvent.events,
      ceu: 200,
    });
    assert.equal(slots[0]!.done, true);
    assert.equal(slots[1]!.done, true);
    assert.equal(slots[2]!.done, true);
  });

  it("leaves a live challenge open until the window ends", () => {
    const ch: Challenge = {
      id: "X",
      code: "x",
      kind: "ceu",
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      hostHandle: "A",
      guestHandle: "B",
      opponentId: "f",
      target: 100,
      hostProgress: 0,
      guestProgress: 0,
      iAmHost: true,
    };
    const next = tickChallenges(
      [ch],
      emptyCounters(),
      {
        ceu: 500,
        voyages: 0,
        onTime: 0,
        cashUp: 0,
        helmClean: 0,
        events: 0,
        hhLoaded: 0,
        lngStems: 0,
        etsPaid: 0,
        fleetOps: 0,
        lngVoyages: 0,
        profit: 0,
        charterOps: 0,
        oceanCalls: 0,
        hub: null,
        any: true,
      },
    );
    assert.equal(next[0]!.status, "active");
    assert.equal(next[0]!.hostProgress, 500);
  });
});

describe("line level", () => {
  it("rises with CEU, plaques and reputation", () => {
    const low = lineLevel({ deliveredCeu: 0, honours: [], reputation: 55, voyages: 0 });
    const high = lineLevel({
      deliveredCeu: 24_000,
      honours: [1, 2, 3],
      milestones: ["wealth"],
      reputation: 85,
      voyages: 80,
    });
    assert.equal(low, 1);
    assert.ok(high > low + 5);
  });
});
