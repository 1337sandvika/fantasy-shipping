import type { GameState } from "./types";
import { activeShip } from "./fleet";

export type HeatBand = "quiet" | "rumor" | "watch" | "probe" | "trial";
export type Verdict = "acquit" | "slap" | "guilty" | "miss";
export type LawyerTier = 0 | 1 | 2;

export function lawyerRadius(tier: LawyerTier): number {
  if (tier === 2) return 0.31;
  if (tier === 1) return 0.2;
  return 0.12;
}

export function lawyerCost(tier: LawyerTier, stake: number): number {
  if (tier === 1) return 95_000;
  if (tier === 2) return Math.round(Math.min(420_000, Math.max(220_000, stake * 0.28)));
  return 0;
}

export function trialStake(s: GameState): number {
  const ship = activeShip(s);
  const onBoard = ship
    ? ship.hold.filter((l) => l.grey).reduce((a, l) => a + l.ceu * l.rate, 0)
    : 0;
  return Math.max(90_000, Math.round((s.greyEarned ?? 0) + onBoard * 0.55));
}

export function scoreThrow(x: number, y: number, lawyer: LawyerTier): { dist: number; verdict: Verdict; cut: number } {
  const dist = Math.hypot(x, y);
  const r = lawyerRadius(lawyer);
  if (dist <= r) return { dist, verdict: "acquit", cut: 0 };
  if (dist <= r * 2.15) return { dist, verdict: "slap", cut: 0.38 };
  if (dist <= 1) return { dist, verdict: "guilty", cut: 0.82 };
  return { dist, verdict: "miss", cut: 0.95 };
}

export function heatBand(heat: number, probe = false, trial = false): HeatBand {
  if (trial) return "trial";
  if (probe || heat >= 48) return "probe";
  if (heat >= 32) return "watch";
  if (heat >= 16) return "rumor";
  return "quiet";
}

export function rumorEvent(s: GameState): GameState {
  return {
    ...s,
    phase: "event",
    event: {
      id: "rumor",
      title: "event.rumor.title",
      body: "event.rumor.body",
      a: { id: "lay", label: "event.rumor.lay", hint: "event.rumor.layHint" },
      b: { id: "push", label: "event.rumor.push", hint: "event.rumor.pushHint" },
    },
  };
}

export function probeEvent(s: GameState): GameState {
  return {
    ...s,
    phase: "event",
    event: {
      id: "probe",
      title: "event.probe.title",
      body: "event.probe.body",
      a: { id: "stall", label: "event.probe.stall", hint: "event.probe.stallHint" },
      b: { id: "court", label: "event.probe.court", hint: "event.probe.courtHint" },
    },
  };
}

export function beginTrial(s: GameState): GameState {
  return {
    ...s,
    phase: "port",
    event: null,
    trial: {
      stake: trialStake(s),
      lawyer: 0,
      phase: "counsel",
    },
  };
}
