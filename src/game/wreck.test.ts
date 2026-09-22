import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { accrueDebt, cheapestBuyPrice, fortune, isStranded } from "./fleet.ts";
import type { GameState } from "./types.ts";
import { resolveWreck, sinkHelm, wreckBranch } from "./wreck.ts";
import { HULLS } from "./data/ships.ts";

function ship(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Test",
    hullId: "nordfjord",
    year: 1998,
    ceu: 1800,
    hhCap: 24,
    burn: 0.145,
    fuel: "mgo",
    ice: false,
    speed: 16.5,
    opex: 9200,
    condition: 80,
    bunkers: 200,
    bunkerCap: 420,
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
    cash: 4_400_000,
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
    helm: {
      kind: "arrive",
      shipId: "s1",
      port: "zeebrugge",
    },
    ...over,
  };
}

const yardMin = Math.min(...HULLS.map((h) => h.price));

describe("cheapestBuyPrice", () => {
  it("uses the cheapest new hull from the yard", () => {
    assert.equal(cheapestBuyPrice(gs()), yardMin);
    assert.equal(yardMin, 2_150_000);
  });

  it("uses a cheaper second-hand offer when one exists", () => {
    const s = gs({
      market: [{ id: "o1", hullId: "nordfjord", name: "Dump", year: 1998, price: 900_000, condition: 40 }],
    });
    assert.equal(cheapestBuyPrice(s), 900_000);
  });
});

describe("sinkHelm", () => {
  it("writes off a worn hull, bills salvage, and keeps collision on a traffic hit", () => {
    const before = gs({
      fleet: [ship({ condition: 30 }) as GameState["fleet"][number]],
    });
    const cash = before.cash;
    const next = sinkHelm(before, "traffic");
    assert.equal(next.fleet.length, 0);
    assert.equal(next.helm?.lost, true);
    assert.equal(next.helm?.wreck, true);
    assert.equal(next.helm?.collision, true);
    assert.ok((next.helm?.salvage ?? 0) > 0);
    assert.ok(next.cash < cash);
    assert.ok(next.log.some((l) => /Test/.test(l.text)));
  });

  it("bills the owners on a time-charter wreck", () => {
    const before = gs({
      fleet: [ship({ charter: "in", condition: 90 }) as GameState["fleet"][number]],
      charters: [
        {
          id: "c1",
          kind: "in",
          shipId: "s1",
          hullId: "nordfjord",
          name: "Test",
          rate: 8000,
          untilDay: 40,
          deposit: 100000,
        },
      ],
    });
    const next = sinkHelm(before, "traffic");
    assert.equal(next.fleet.length, 0);
    assert.equal(next.helm?.tcWreck, true);
    assert.equal(next.helm?.lost, true);
    assert.ok((next.helm?.hullBill ?? 0) > 0);
    assert.ok(next.cash < before.cash - (next.helm?.salvage ?? 0));
  });

  it("keeps a sound hull afloat after a sink hit", () => {
    const next = sinkHelm(gs({ fleet: [ship({ condition: 88 }) as GameState["fleet"][number]] }), "wall");
    assert.equal(next.fleet.length, 1);
    assert.equal(next.helm?.lost, false);
    assert.equal(next.helm?.wreck, true);
    assert.equal(next.helm?.collision, false);
  });
});

describe("wreckBranch / resolveWreck", () => {
  it("offers a replacement when the last hull is gone and cash covers the yard", () => {
    const s = gs({
      cash: 3_000_000,
      fleet: [],
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: true, salvage: 60_000, shipName: "Test" },
    });
    assert.equal(wreckBranch(s), "buy");
    const next = resolveWreck(s, "yard");
    assert.equal(next.helm, null);
    assert.equal(next.tab, "yard");
    assert.equal(next.phase, "port");
  });

  it("bankrupts when the last hull is gone and cash cannot cover a replacement", () => {
    const s = gs({
      cash: 400_000,
      fleet: [],
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: true, salvage: 60_000, shipName: "Test" },
    });
    assert.equal(wreckBranch(s), "broke");
    const next = resolveWreck(s, "broke");
    assert.equal(next.phase, "end");
    assert.equal(next.endKind, "broke");
    assert.equal(next.helm, null);
  });

  it("does not file bankruptcy when the bill goes red but a hull keeps Formue above water", () => {
    const s = gs({
      cash: -80_000,
      fleet: [ship({ id: "s2" }) as GameState["fleet"][number]],
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: true, salvage: 60_000, hullBill: 2e6, tcWreck: true },
    });
    assert.ok(fortune(s) > 0);
    assert.equal(wreckBranch(s), "continue");
    const next = resolveWreck(s, "broke");
    assert.equal(next.phase, "port");
    assert.equal(next.endKind, null);
    assert.equal(next.fleet.length, 1);
  });

  it("files bankruptcy when the wreck bill leaves Formue underwater", () => {
    const s = gs({
      cash: -8_000_000,
      fleet: [ship({ id: "s2" }) as GameState["fleet"][number]],
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: true, salvage: 60_000, hullBill: 2e6, tcWreck: true },
    });
    assert.ok(fortune(s) < 0);
    assert.equal(wreckBranch(s), "broke");
    const next = resolveWreck(s);
    assert.equal(next.phase, "end");
    assert.equal(next.endKind, "broke");
  });

  it("offers a buy after hull loss when cash covers the yard, even if another hull remains", () => {
    const s = gs({
      cash: 255_927_170,
      fleet: [ship({ id: "s2", name: "Spare" }) as GameState["fleet"][number]],
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: true, salvage: 60_000, shipName: "Test" },
    });
    assert.equal(wreckBranch(s), "buy");
    const next = resolveWreck(s, "yard");
    assert.equal(next.phase, "port");
    assert.equal(next.tab, "yard");
    assert.notEqual(next.endKind, "broke");
  });

  it("bankrupts an empty fleet when the bill itself leaves cash negative", () => {
    const s = gs({
      cash: -80_000,
      fleet: [],
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: true, salvage: 60_000, shipName: "Test" },
    });
    assert.equal(wreckBranch(s), "broke");
    const next = resolveWreck(s);
    assert.equal(next.phase, "end");
    assert.equal(next.endKind, "broke");
  });

  it("does not bankrupt a salvageable hull when salvage pushed cash negative", () => {
    const s = gs({
      cash: -80_000,
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: false, salvage: 60_000 },
    });
    assert.equal(wreckBranch(s), "continue");
    const next = resolveWreck(s);
    assert.equal(next.phase, "port");
    assert.equal(next.endKind, null);
  });

  it("lets a remaining fleet carry on when a replacement is too dear", () => {
    const s = gs({
      cash: 100_000,
      fleet: [ship({ id: "s2", name: "Spare" }) as GameState["fleet"][number]],
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: true, salvage: 60_000 },
    });
    assert.equal(wreckBranch(s), "continue");
    const next = resolveWreck(s);
    assert.equal(next.phase, "port");
    assert.equal(next.helm, null);
    assert.equal(next.fleet.length, 1);
  });

  it("does not force a buy after a salvageable sink", () => {
    const s = gs({
      cash: 4_000_000,
      helm: { kind: "arrive", shipId: "s1", port: "zeebrugge", wreck: true, lost: false, salvage: 60_000 },
    });
    assert.equal(wreckBranch(s), "continue");
  });
});

describe("isStranded matches Formue", () => {
  it("does not bankrupt a rich line whose only hull is waiting on an LNG barge", () => {
    const s = gs({
      cash: 255_927_170,
      day: 1302,
      fleet: [
        ship({
          fuel: "lng",
          bunkers: 0,
          bunkerCap: 600,
          port: "jacksonville",
          barge: { from: "zeebrugge", eta: 1310, tons: 500, cost: 400_000 },
        }) as GameState["fleet"][number],
      ],
    });
    assert.ok(fortune(s) > 200_000_000);
    assert.equal(s.fleet.length, 1);
    assert.equal(isStranded(s), false);
  });

  it("does not bankrupt when the only hull is on hire and cash still covers a replacement", () => {
    const s = gs({
      cash: 255_927_170,
      debt: 900_000_000,
      fleet: [ship({ charter: "out", bunkers: 0, port: "jacksonville" }) as GameState["fleet"][number]],
    });
    assert.ok(fortune(s) > cheapestBuyPrice(s));
    assert.equal(isStranded(s), false);
  });

  it("stays in port when a paid barge is inbound even if cash cannot buy another hull", () => {
    const s = gs({
      cash: 1_000,
      debt: 80_000,
      fleet: [
        ship({
          fuel: "lng",
          bunkers: 0,
          bunkerCap: 600,
          port: "jacksonville",
          barge: { from: "zeebrugge", eta: 20, tons: 500, cost: 400_000 },
        }) as GameState["fleet"][number],
      ],
    });
    assert.ok(fortune(s) < cheapestBuyPrice(s));
    assert.equal(isStranded(s), false);
  });

  it("still strands a line that cannot fuel, sail, borrow, or buy", () => {
    const s = gs({
      cash: 1_000,
      debt: 80_000,
      fleet: [ship({ fuel: "mgo", bunkers: 0, port: "jacksonville" }) as GameState["fleet"][number]],
    });
    assert.ok(fortune(s) < cheapestBuyPrice(s));
    assert.equal(isStranded(s), true);
  });
});

describe("accrueDebt", () => {
  it("pro-rates a fraction of a day instead of charging a full day", () => {
    const full = accrueDebt(2_400_000, 1);
    const tick = accrueDebt(2_400_000, 0.01);
    assert.equal(full, Math.round(2_400_000 * 1.0015));
    assert.ok(tick > 2_400_000);
    assert.ok(tick < 2_400_000 + 500);
  });
});
