import type { EventPick, GameState, TrialJob } from "./types";
import { activeShip } from "./fleet";

export type HeatBand = "quiet" | "rumor" | "watch" | "probe" | "trial";
export type Verdict = "acquit" | "slap" | "guilty" | "miss";
export type LawyerTier = 0 | 1 | 2;

export const HEAT_RUMOR = 18;
export const HEAT_WATCH = 28;
export const HEAT_PROBE = 42;

export function lawyerRadius(tier: LawyerTier): number {
  if (tier === 2) return 0.215;
  if (tier === 1) return 0.14;
  return 0.082;
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
  if (dist <= r * 2.0) return { dist, verdict: "slap", cut: 0.44 };
  if (dist <= 1) return { dist, verdict: "guilty", cut: 0.86 };
  return { dist, verdict: "miss", cut: 0.96 };
}

export function heatBand(heat: number, probe = false, trial = false): HeatBand {
  if (trial) return "trial";
  if (probe || heat >= HEAT_PROBE) return "probe";
  if (heat >= HEAT_WATCH) return "watch";
  if (heat >= HEAT_RUMOR) return "rumor";
  return "quiet";
}

export type VerdictEffects = {
  verdict: Verdict;
  days: number;
  heatAfter: number;
  repHit: number;
  seize: boolean;
  fine: number;
};

export function verdictEffects(trial: Pick<TrialJob, "verdict" | "fine">): VerdictEffects {
  const verdict = trial.verdict ?? "guilty";
  const fine = trial.fine ?? 0;
  const days = verdict === "miss" ? 14 : verdict === "guilty" ? 8 : verdict === "slap" ? 2 : 0;
  const heatAfter = verdict === "acquit" ? 8 : verdict === "slap" ? 14 : 5;
  const repHit = verdict === "acquit" ? 2 : verdict === "slap" ? -4 : verdict === "guilty" ? -10 : -16;
  const seize = verdict === "guilty" || verdict === "miss";
  return { verdict, days, heatAfter, repHit, seize, fine };
}

export function greyOnBoardCeu(s: GameState): number {
  return s.fleet.reduce(
    (a, sh) => a + sh.hold.filter((l) => l.grey).reduce((b, l) => b + l.ceu, 0),
    0,
  );
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

export function verdictEvent(vars: Record<string, string | number>, verdict: Verdict): EventPick {
  return {
    id: "verdict",
    title: `event.verdict.title.${verdict}`,
    body: `event.verdict.body.${verdict}`,
    a: { id: "work", label: "event.verdict.work", hint: "event.verdict.workHint" },
    b: { id: "low", label: "event.verdict.low", hint: "event.verdict.lowHint" },
    vars,
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
