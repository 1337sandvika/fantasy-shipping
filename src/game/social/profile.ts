import { careerPoints } from "../score";
import { fleetValue } from "../fleet";
import type { GameState } from "../types";
import type { LineSnapshot } from "./types";

export function utcDate(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function lineLevel(s: {
  deliveredCeu: number;
  honours: unknown[];
  milestones?: unknown[];
  reputation: number;
  voyages: number;
}): number {
  const ceu = Math.max(0, s.deliveredCeu);
  const plaques = Array.isArray(s.honours) ? s.honours.length : 0;
  const marks = Array.isArray(s.milestones) ? s.milestones.length : 0;
  const rep = Math.max(0, s.reputation - 50);
  const miles = Math.max(0, s.voyages);
  return 1 + Math.floor(ceu / 8000) + plaques + marks + Math.floor(rep / 10) + Math.floor(miles / 40);
}

export function snapshotFromCareer(s: GameState, handle: string): LineSnapshot {
  const nw = s.cash + fleetValue(s);
  const points = careerPoints({
    netWorth: nw,
    deliveredCeu: s.deliveredCeu,
    reputation: s.reputation,
    co2t: s.co2t,
    fines: s.fines,
  });
  return {
    handle: handle || s.company || s.captain || "Line",
    company: s.company || s.captain || "",
    director: s.director || "",
    level: lineLevel(s),
    points,
    day: Math.round(s.day),
    cash: s.cash,
    reputation: s.reputation,
    deliveredCeu: s.deliveredCeu,
    voyages: s.voyages,
    co2t: Math.round(s.co2t),
    fleetSize: s.fleet.length,
    honours: (s.honours ?? []).slice(0, 8).map((h) => ({
      kind: h.kind,
      brand: h.brand,
      n: h.n,
    })),
    onTimeStreak: s.onTimeStreak ?? 0,
    preferred: s.preferred ?? [],
    updatedAt: new Date().toISOString(),
  };
}

export function emptySnapshot(handle: string): LineSnapshot {
  return {
    handle,
    company: handle,
    director: "",
    level: 1,
    points: 0,
    day: 0,
    cash: 0,
    reputation: 55,
    deliveredCeu: 0,
    voyages: 0,
    co2t: 0,
    fleetSize: 0,
    honours: [],
    onTimeStreak: 0,
    preferred: [],
    updatedAt: new Date().toISOString(),
  };
}
