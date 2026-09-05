import { PORTS, getPort, portName } from "./data/ports";
import { HULLS, UPGRADES, hullById, type Hull } from "./data/ships";
import { pointOnPath, pointOnPathStepped, seaRoute } from "./route";
import type { GameState, Lot, MarketOffer, Ship, UpgradeId, Voyage } from "./types";

export function activeShip(s: GameState): Ship | null {
  return s.fleet.find((x) => x.id === s.activeId) ?? s.fleet[0] ?? null;
}

export function shipLeg(s: GameState, id: string | null | undefined): Voyage | null {
  if (!id) return null;
  return (s.legs ?? []).find((v) => v.shipId === id) ?? null;
}

export function activeLeg(s: GameState): Voyage | null {
  return shipLeg(s, s.activeId);
}

export function remainingCeu(ship: Ship): number {
  const used = ship.hold.reduce((a, l) => a + l.ceu, 0);
  return Math.max(0, ship.ceu - used);
}

export function remainingHh(ship: Ship): number {
  const used = ship.hold.reduce((a, l) => a + (l.hh ?? 0), 0);
  return Math.max(0, ship.hhCap - used);
}

export function usedHh(ship: Ship): number {
  return ship.hold.reduce((a, l) => a + (l.hh ?? 0), 0);
}

export function drydockLeft(ship: Ship, day: number): number {
  return 365 - (day - ship.lastDrydock);
}

export function hullValue(ship: Ship): number {
  if (ship.charter === "in") return 0;
  const h = hullById(ship.hullId);
  const base = h?.price ?? 2_000_000;
  const age = Math.max(0, 2026 - ship.year);
  const cond = ship.condition / 100;
  return Math.round(base * (0.55 + 0.45 * cond) * Math.max(0.35, 1 - age * 0.015));
}

export function fleetValue(s: GameState): number {
  return s.fleet.reduce((a, sh) => a + hullValue(sh), 0);
}

export function bunkerTonPrice(ship: Ship): number {
  const port = getPort(ship.port);
  return ship.fuel === "lng" && port.lng ? port.bunker * 0.85 : port.bunker;
}

export type BargeQuote = {
  hub: string;
  hubName: string;
  nm: number;
  days: number;
  tons: number;
  pricePerT: number;
  call: number;
  cost: number;
  canPay: boolean;
};

export function nearestLngId(from: string): string | null {
  const here = getPort(from);
  if (here.lng) return here.id;
  let best: string | null = null;
  let bestNm = Infinity;
  for (const p of PORTS) {
    if (!p.lng || p.id === from) continue;
    const nm = seaRoute(from, p.id).nm;
    if (nm < bestNm) {
      bestNm = nm;
      best = p.id;
    }
  }
  return best;
}

/** LNG bunker barge from the nearest LNG hub. Slow, expensive, ship stays put. */
export function bargeQuote(s: GameState, ship: Ship): BargeQuote | null {
  if (ship.fuel !== "lng" || ship.atSea || ship.charter === "out") return null;
  if (getPort(ship.port).lng) return null;
  if (ship.barge && s.day < ship.barge.eta) return null;
  const hub = nearestLngId(ship.port);
  if (!hub) return null;
  const room = Math.max(0, ship.bunkerCap - ship.bunkers);
  if (room < 20) return null;
  const nm = seaRoute(ship.port, hub).nm;
  const tons = Math.round(room);
  const steamDays = nm / 11 / 24;
  const pump = 0.35 + Math.min(0.55, tons / 1100);
  const days = Math.round((Math.max(0.45, steamDays) + pump) * 10) / 10;
  const shore = getPort(hub).bunker * 0.85;
  const pricePerT = Math.round(shore * 1.65);
  const call = 24_000 + Math.round(nm * 32);
  const cost = Math.round(tons * pricePerT + call);
  return {
    hub,
    hubName: portName(hub),
    nm: Math.round(nm),
    days,
    tons,
    pricePerT,
    call,
    cost,
    canPay: s.cash >= cost,
  };
}

export function bargeLeft(ship: Ship, day: number): number {
  if (!ship.barge) return 0;
  return Math.max(0, ship.barge.eta - day);
}

export function fleetHasBarge(s: GameState): boolean {
  return s.fleet.some((sh) => Boolean(sh.barge && s.day < sh.barge.eta));
}

export function loanOffer(s: GameState): { principal: number; due: number } {
  const ship = activeShip(s);
  const price = ship ? bunkerTonPrice(ship) : 620;
  const fill = ship ? Math.max(0, ship.bunkerCap - ship.bunkers) * price : 0;
  const hole = Math.max(0, 50_000 + fill - s.cash);
  const principal = Math.max(220_000, Math.min(2_400_000, Math.ceil(hole / 20_000) * 20_000));
  return { principal, due: Math.round(principal * 1.32) };
}

export function canTakeLoan(s: GameState): boolean {
  if ((s.debt ?? 0) > 20_000) return false;
  if (s.phase === "end" || s.phase === "title") return false;
  const ship = activeShip(s);
  if (s.cash < 0) return true;
  if (!ship || ship.atSea) return false;
  const need = Math.min(80, Math.max(0, ship.bunkerCap - ship.bunkers)) * bunkerTonPrice(ship);
  return need > 0 && s.cash < need;
}

export function cashTight(s: GameState, ship: Ship | null): boolean {
  if (s.cash < 0) return true;
  if ((s.debt ?? 0) > 0 && s.cash < 80_000) return true;
  if (!ship || ship.atSea) return false;
  const need = Math.min(80, Math.max(0, ship.bunkerCap - ship.bunkers)) * bunkerTonPrice(ship);
  return need >= 10 * bunkerTonPrice(ship) && s.cash < need;
}

/** True when no owned hull can bunker or sail, and the desk will not lend. */
export function isStranded(s: GameState): boolean {
  if (s.phase === "title" || s.phase === "end") return false;
  const debtNet = s.cash - (s.debt ?? 0);
  const working = s.fleet.filter((sh) => sh.charter !== "out");
  if (!working.length) return debtNet < -4e5;
  if ((s.legs ?? []).some((v) => working.some((sh) => sh.id === v.shipId))) return false;
  if (canTakeLoan(s)) return false;
  if (working.some((sh) => sh.hold.some((l) => l.dest === sh.port))) return false;
  return working.every((sh) => !canAffordMinBunker(s, sh) && !canReachAnyPort(sh));
}

function canAffordMinBunker(s: GameState, ship: Ship): boolean {
  if (ship.atSea) return false;
  const port = getPort(ship.port);
  const room = Math.max(0, ship.bunkerCap - ship.bunkers);
  if (room < 10) return true;
  if (ship.fuel === "lng" && !port.lng) {
    const q = bargeQuote(s, ship);
    return Boolean(q && q.canPay);
  }
  return s.cash >= 10 * bunkerTonPrice(ship);
}

function canReachAnyPort(ship: Ship): boolean {
  if (ship.atSea) return true;
  const burn = burnPerNm(ship);
  for (const p of PORTS) {
    if (p.id === ship.port) continue;
    const nm = seaRoute(ship.port, p.id).nm;
    if (nm > 0 && ship.bunkers >= burn * nm * 1.08) return true;
  }
  return false;
}

export function cheaperOffer(s: GameState, ship: Ship): MarketOffer | null {
  const val = hullValue(ship);
  const offers = (s.market ?? []).filter((o) => o.price < val * 0.72 && o.price <= s.cash + val);
  return offers.sort((a, b) => a.price - b.price)[0] ?? null;
}

export function fromHull(h: Hull, condition = 80): Ship {
  return {
    id: "preview",
    name: h.name,
    hullId: h.id,
    year: h.year,
    ceu: h.ceu,
    hhCap: h.hhCap,
    burn: h.burn,
    fuel: h.fuel,
    ice: h.ice,
    speed: h.speed,
    opex: h.opex,
    condition,
    bunkers: Math.round(h.bunkerCap * 0.45),
    bunkerCap: h.bunkerCap,
    lastDrydock: 0,
    upgrades: h.ice ? ["ice"] : [],
    hold: [],
    port: "zeebrugge",
    atSea: false,
    etsAcc: 0,
    charter: null,
  };
}

export function withUpgrade(ship: Ship, id: UpgradeId): Ship {
  if ((ship.upgrades ?? []).includes(id)) return ship;
  const def = UPGRADES.find((u) => u.id === id);
  return {
    ...ship,
    upgrades: [...(ship.upgrades ?? []), id],
    ice: id === "ice" ? true : ship.ice,
    hhCap: ship.hhCap + (def?.hhBonus ?? 0),
  };
}

export function etsFactor(ship: Ship): number {
  if (ship.fuel === "lng") return 0.35;
  if ((ship.upgrades ?? []).includes("scrubber")) return 0.72;
  return 1;
}

export function burnPerNm(ship: Ship): number {
  let b = ship.burn;
  const u = ship.upgrades ?? [];
  if (u.includes("prop")) b *= 0.88;
  if (u.includes("fuelopt")) b *= 0.9;
  if (u.includes("tankcoat")) b *= 0.94;
  return b;
}

export function co2PerNm(ship: Ship): number {
  const factor = ship.fuel === "lng" ? 2.75 : 3.2;
  return burnPerNm(ship) * factor * etsFactor(ship);
}

export function burnPerKceu(ship: Ship): number {
  return burnPerNm(ship) / Math.max(1, ship.ceu);
}

export function opexPerKceu(ship: Ship): number {
  return ship.opex / Math.max(1, ship.ceu / 1000);
}

export function rangeNm(ship: Ship): number {
  return ship.bunkers / Math.max(0.0001, burnPerNm(ship));
}

/** Distance this hull can sail on a full tank, 8% weather margin included. */
export function fullTankRangeNm(ship: Pick<Ship, "bunkerCap" | "burn" | "upgrades">): number {
  return ship.bunkerCap / Math.max(0.0001, burnPerNm(ship as Ship)) / 1.08;
}

export function fleetReachNm(s: GameState): number {
  const ships = s.fleet.filter((sh) => sh.charter !== "out");
  if (!ships.length) {
    const h = HULLS[0]!;
    return h.bunkerCap / Math.max(0.0001, h.burn) / 1.08;
  }
  return Math.max(...ships.map((sh) => fullTankRangeNm(sh)));
}

export function lotInRange(ship: Ship, dest: string): boolean {
  if (!dest || dest === ship.port) return true;
  const nm = seaRoute(ship.port, dest).nm;
  return nm * 1.08 <= fullTankRangeNm(ship) + 20;
}

export type BunkerPlan = {
  extraTons: number;
  cost: number;
  canFill: boolean;
  hullTooShort: boolean;
  noLng: boolean;
  noCash: boolean;
  nm: number;
};

/** What it takes to leave for `dest` with a 8% weather margin. */
export function bunkerPlanFor(s: GameState, dest: string): BunkerPlan {
  const ship = activeShip(s);
  const zero: BunkerPlan = {
    extraTons: 0,
    cost: 0,
    canFill: true,
    hullTooShort: false,
    noLng: false,
    noCash: false,
    nm: 0,
  };
  if (!ship || !dest || dest === ship.port) return zero;
  const nm = seaRoute(ship.port, dest).nm;
  const need = burnPerNm(ship) * nm * 1.08;
  const extraRaw = Math.max(0, need - ship.bunkers);
  const extra = extraRaw < 0.2 ? 0 : extraRaw;
  const room = Math.max(0, ship.bunkerCap - ship.bunkers);
  const port = getPort(ship.port);
  const hullTooShort = need > ship.bunkerCap + 0.05;
  const take = extra < 0.2 ? 0 : Math.min(Math.max(1, Math.ceil(extra)), Math.floor(room));
  const noLng = take >= 1 && ship.fuel === "lng" && !port.lng;
  const cost = Math.round(take * bunkerTonPrice(ship));
  const noCash = take >= 1 && s.cash < cost;
  return {
    extraTons: take,
    cost,
    canFill: take < 1 || (!hullTooShort && !noLng && !noCash),
    hullTooShort,
    noLng,
    noCash,
    nm,
  };
}

export function lotPay(l: Lot): number {
  return Math.round(l.ceu * l.rate);
}

export function destSummary(hold: Lot[]): { dest: string; ceu: number; pay: number }[] {
  const m = new Map<string, { dest: string; ceu: number; pay: number }>();
  for (const l of hold) {
    const cur = m.get(l.dest) ?? { dest: l.dest, ceu: 0, pay: 0 };
    cur.ceu += l.ceu;
    cur.pay += lotPay(l);
    m.set(l.dest, cur);
  }
  return [...m.values()].sort((a, b) => b.pay - a.pay);
}

export function suggestedDestId(ship: Ship | null, lots: Lot[]): string | null {
  if (!ship) return lots[0]?.dest ?? null;
  const fromHold = destSummary(ship.hold)[0]?.dest;
  if (fromHold) return fromHold;
  const quay = lots.filter((l) => remainingCeu(ship) >= l.ceu * 0.3);
  const q = quay.sort((a, b) => (b.contract ? 1 : 0) - (a.contract ? 1 : 0) || b.rate - a.rate)[0];
  return q?.dest ?? (ship.port === "zeebrugge" ? "goteborg" : "zeebrugge");
}

export function canDrydock(portId: string): boolean {
  return getPort(portId).yard;
}

export function lotFitsDeck(ship: Ship, lot: Lot): boolean {
  return remainingCeu(ship) >= lot.ceu && remainingHh(ship) >= (lot.hh ?? 0);
}

export function canLoadLot(ship: Ship, lot: Lot): boolean {
  if (ship.charter === "out") return false;
  return lotFitsDeck(ship, lot) && lotInRange(ship, lot.dest);
}

export type ShipPos = { lon: number; lat: number; heading: number };

export function shipWorldPos(ship: Ship, leg: Voyage | null): ShipPos {
  if (leg && leg.path.length) {
    const pos = pointOnPathStepped(leg.path, leg.travelled, leg.nm);
    const prog = leg.nm <= 0 ? 1 : leg.travelled / leg.nm;
    const a = pointOnPath(leg.path, Math.max(0, prog - 0.02));
    const b = pointOnPath(leg.path, Math.min(1, prog + 0.02));
    const heading = Math.atan2(b.lat - a.lat, b.lon - a.lon);
    return { lon: pos.lon, lat: pos.lat, heading };
  }
  const p = getPort(ship.port);
  return { lon: p.lon, lat: p.lat, heading: -0.4 };
}
