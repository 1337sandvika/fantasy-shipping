import { getPort } from "../data/ports";
import { inEurope } from "../geo";
import { activeShip } from "../fleet";
import type { GameState, Ship } from "../types";
import type { Challenge, ChallengeKind, DailySlot, SocialCounters, SocialDelta } from "./types";

export function emptyCounters(): SocialCounters {
  return {
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
    hubCalls: {},
  };
}

function hhOn(ship: Ship | null): number {
  return ship?.hold.reduce((a, l) => a + (l.hh ?? 0), 0) ?? 0;
}

function upgradesOf(s: GameState): number {
  return s.fleet.reduce((a, sh) => a + (sh.upgrades?.length ?? 0), 0);
}

export function detectDelta(prev: GameState | null, next: GameState): SocialDelta {
  const z: SocialDelta = {
    ceu: 0,
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
    any: false,
  };
  if (!prev) return z;
  if (next.phase === "title") return z;

  z.ceu = Math.max(0, next.deliveredCeu - prev.deliveredCeu);
  z.voyages = Math.max(0, next.voyages - prev.voyages);
  z.onTime = Math.max(0, (next.onTimeStreak ?? 0) - (prev.onTimeStreak ?? 0));
  z.cashUp = Math.max(0, next.cash - prev.cash);
  if (z.ceu > 0 && z.cashUp > 0) z.profit = z.cashUp;

  if (prev.helm && !next.helm && next.cash >= prev.cash) z.helmClean = 1;
  if (prev.event && !next.event) z.events = 1;
  if (prev.ets && !next.ets) z.etsPaid = 1;

  const pShip = activeShip(prev);
  const nShip = activeShip(next);
  const hhGain = hhOn(nShip) - hhOn(pShip);
  if (hhGain > 0) z.hhLoaded = 1;

  if (nShip && pShip && nShip.id === pShip.id && nShip.fuel === "lng" && nShip.bunkers > pShip.bunkers + 2) {
    z.lngStems = 1;
  }

  const repaired = next.fleet.some((sh) => {
    const old = prev.fleet.find((x) => x.id === sh.id);
    return old && sh.condition > old.condition + 0.5;
  });
  const docked = next.fleet.some((sh) => {
    const old = prev.fleet.find((x) => x.id === sh.id);
    return old && sh.lastDrydock > old.lastDrydock;
  });
  if (repaired || docked || upgradesOf(next) > upgradesOf(prev)) z.fleetOps = 1;

  if ((next.charters?.length ?? 0) !== (prev.charters?.length ?? 0)) z.charterOps = 1;

  if (z.voyages > 0) {
    const arrived = next.fleet.find((sh) => {
      const old = prev.fleet.find((x) => x.id === sh.id);
      return old && old.atSea && !sh.atSea;
    });
    if (arrived) {
      const port = getPort(arrived.port);
      if (port.hub) z.hub = port.id;
      if (!inEurope(port.lon, port.lat)) z.oceanCalls = 1;
      if (arrived.fuel === "lng") z.lngVoyages = 1;
    }
  }

  z.any = Boolean(
    z.ceu ||
      z.voyages ||
      z.onTime ||
      z.helmClean ||
      z.events ||
      z.hhLoaded ||
      z.lngStems ||
      z.etsPaid ||
      z.fleetOps ||
      z.lngVoyages ||
      z.profit ||
      z.charterOps ||
      z.oceanCalls ||
      z.hub,
  );
  return z;
}

export function applyCounters(c: SocialCounters, d: SocialDelta): SocialCounters {
  const hubCalls = { ...c.hubCalls };
  if (d.hub) hubCalls[d.hub] = (hubCalls[d.hub] ?? 0) + 1;
  return {
    helmClean: c.helmClean + d.helmClean,
    events: c.events + d.events,
    hhLoaded: c.hhLoaded + d.hhLoaded,
    lngStems: c.lngStems + d.lngStems,
    etsPaid: c.etsPaid + d.etsPaid,
    fleetOps: c.fleetOps + d.fleetOps,
    lngVoyages: c.lngVoyages + d.lngVoyages,
    profit: c.profit + d.profit,
    charterOps: c.charterOps + d.charterOps,
    oceanCalls: c.oceanCalls + d.oceanCalls,
    hubCalls,
  };
}

export function tickSlots(slots: DailySlot[], c: SocialCounters, d: SocialDelta): DailySlot[] {
  return slots.map((slot) => {
    let progress = slot.progress;
    switch (slot.id) {
      case "ceu":
        progress += d.ceu;
        break;
      case "ontime":
        progress += d.onTime;
        break;
      case "helm":
        progress = c.helmClean;
        break;
      case "voyage":
        progress += d.voyages;
        break;
      case "hub":
        progress = slot.port ? c.hubCalls[slot.port] ?? 0 : progress;
        break;
      case "hh":
        progress = c.hhLoaded;
        break;
      case "lng":
        progress = c.lngStems;
        break;
      case "event":
        progress = c.events;
        break;
      case "ets":
        progress = c.etsPaid;
        break;
      case "fleet":
        progress = c.fleetOps;
        break;
      case "green":
        progress = c.lngVoyages;
        break;
      case "profit":
        progress = c.profit;
        break;
      case "charter":
        progress = c.charterOps;
        break;
      case "ocean":
        progress = c.oceanCalls;
        break;
      default:
        break;
    }
    const done = progress >= slot.target;
    return { ...slot, progress: Math.min(progress, slot.target * 4), done };
  });
}

export function challengeProgress(kind: ChallengeKind, _c: SocialCounters, d: SocialDelta, acc: number): number {
  switch (kind) {
    case "ceu":
      return acc + d.ceu;
    case "voyage":
      return acc + d.voyages;
    case "profit":
      return acc + d.profit;
    case "ontime":
      return acc + d.onTime;
    case "helm":
      return acc + d.helmClean;
    case "event":
      return acc + d.events;
    case "green":
      return acc + d.lngVoyages;
    default:
      return acc;
  }
}

function settle(ch: Challenge, hostProgress: number, guestProgress: number, iAmHost: boolean): Challenge["status"] {
  if (!ch.guestHandle) {
    return hostProgress >= ch.target ? "won" : "expired";
  }
  if (hostProgress === guestProgress) return hostProgress >= ch.target ? "tied" : "expired";
  const hostAhead = hostProgress > guestProgress;
  return hostAhead === iAmHost ? "won" : "lost";
}

export function tickChallenges(list: Challenge[], c: SocialCounters, d: SocialDelta, now = Date.now()): Challenge[] {
  return list.map((ch) => {
    if (ch.status === "won" || ch.status === "lost" || ch.status === "tied") return ch;
    const expired = new Date(ch.expiresAt).getTime() < now;
    const mine = ch.iAmHost ? ch.hostProgress : ch.guestProgress;
    const nextMine = challengeProgress(ch.kind, c, d, mine);
    const hostProgress = ch.iAmHost ? nextMine : ch.hostProgress;
    const guestProgress = ch.iAmHost ? ch.guestProgress : nextMine;
    const status = expired
      ? settle(ch, hostProgress, guestProgress, ch.iAmHost)
      : ch.guestHandle
        ? "active"
        : "open";
    return { ...ch, hostProgress, guestProgress, status };
  });
}

export function completedCount(slots: DailySlot[]): number {
  return slots.filter((s) => s.done).length;
}
