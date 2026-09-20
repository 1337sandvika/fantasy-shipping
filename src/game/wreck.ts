// @ts-nocheck
import { t, type MsgKey } from "../i18n";
import { portName } from "./data/ports";
import { cheapestBuyPrice, replacementValue } from "./fleet";
import type { HelmCrashCause } from "./helm";
import type { GameState } from "./types";

export type WreckIntent = "dismiss" | "yard" | "broke";
export type WreckBranch = "continue" | "buy" | "broke";

function log(s: GameState, key: MsgKey, vars?: Record<string, string | number>) {
  s.log = [{ day: s.day, text: t(key, vars) }, ...s.log].slice(0, 80);
}

export function sinkHelm(s: GameState, cause?: HelmCrashCause): GameState {
  const job = s.helm;
  const ship = s.fleet.find((x) => x.id === job?.shipId);
  if (!job || !ship) return s;
  const lostCeu = ship.hold.reduce((a, l) => a + l.ceu, 0);
  const grey = ship.hold.some((l) => l.grey);
  const salvage = 54000 + Math.round(ship.ceu * 28);
  const book = replacementValue(ship);
  const hire = (s.charters ?? []).find((c) => c.shipId === ship.id && c.kind === "in");
  const tcWreck = ship.charter === "in" || Boolean(hire);
  const collision = cause !== "wall";

  if (tcWreck) {
    const hullBill = book;
    const bill = salvage + hullBill;
    const fleet = s.fleet.filter((x) => x.id !== ship.id);
    const next: GameState = {
      ...s,
      cash: s.cash - bill,
      day: s.day + 3.4,
      heat: Math.min(100, (s.heat ?? 0) + (grey ? 28 : 8)),
      reputation: Math.max(0, (s.reputation ?? 50) - 16),
      fines: (s.fines ?? 0) + (grey ? 18000 : 0),
      fleet,
      legs: s.legs.filter((v) => v.shipId !== ship.id),
      charters: (s.charters ?? []).filter((c) => c.shipId !== ship.id),
      activeId: s.activeId === ship.id ? (fleet[0]?.id ?? null) : s.activeId,
      selectedPort: job.kind === "arrive" ? job.port : s.selectedPort,
      helm: {
        ...job,
        wreck: true,
        lost: true,
        lostCeu,
        salvage,
        hullBill,
        tcWreck: true,
        shipName: ship.name,
        bump: true,
        collision,
      },
    };
    log(next, "log.helm.lostTc", {
      name: ship.name,
      port: portName(job.port),
      hull: hullBill,
      salvage,
      n: bill,
      ceu: lostCeu,
    });
    if (lostCeu > 0) log(next, "log.helm.wreckCargo", { ceu: lostCeu });
    return next;
  }

  const total = ship.condition < 44 || (ship.condition < 60 && s.cash < salvage * 0.35);
  const scrap = total ? Math.round(book * 0.1) : 0;
  let next: GameState = {
    ...s,
    cash: s.cash - salvage + scrap,
    day: s.day + 3.4,
    heat: Math.min(100, (s.heat ?? 0) + (grey ? 28 : 8)),
    reputation: Math.max(0, (s.reputation ?? 50) - (total ? 14 : 8)),
    fines: (s.fines ?? 0) + (grey ? 18000 : 0),
  };
  if (total) {
    const fleet = next.fleet.filter((x) => x.id !== ship.id);
    next = {
      ...next,
      fleet,
      legs: next.legs.filter((v) => v.shipId !== ship.id),
      activeId: next.activeId === ship.id ? (fleet[0]?.id ?? null) : next.activeId,
      selectedPort: job.kind === "arrive" ? job.port : next.selectedPort,
      helm: { ...job, wreck: true, lost: true, lostCeu, salvage, shipName: ship.name, bump: true, collision },
    };
    log(next, "log.helm.lost", { name: ship.name, port: portName(job.port), n: salvage, ceu: lostCeu });
    return next;
  }
  next = {
    ...next,
    helm: { ...job, wreck: true, lost: false, lostCeu, salvage, shipName: ship.name, bump: true, collision },
    fleet: next.fleet.map((sh) =>
      sh.id === ship.id
        ? { ...sh, hold: [], condition: Math.max(18, sh.condition - (26 + Math.floor(Math.random() * 10))) }
        : sh,
    ),
  };
  log(next, "log.helm.sink", { name: ship.name, port: portName(job.port), n: salvage, ceu: lostCeu });
  if (lostCeu > 0) log(next, "log.helm.wreckCargo", { ceu: lostCeu });
  return next;
}

export function wreckBranch(s: GameState): WreckBranch {
  const job = s.helm;
  if (!job?.wreck) return "continue";
  if (s.cash < 0) return "broke";
  if (!job.lost) return "continue";
  const canBuy = s.cash >= cheapestBuyPrice(s);
  if (s.fleet.length === 0) return canBuy ? "buy" : "broke";
  return canBuy ? "buy" : "continue";
}

export function resolveWreck(s: GameState, intent: WreckIntent = "dismiss"): GameState {
  const job = s.helm;
  if (!job) return s;
  const next: GameState = { ...s, helm: null, tab: intent === "yard" ? "yard" : s.tab };
  if (intent === "broke" || next.cash < 0) {
    const broke: GameState = { ...next, phase: "end", endKind: "broke" };
    log(broke, "log.broke");
    return broke;
  }
  return next;
}

export { cheapestBuyPrice };
