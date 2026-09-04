import { getPort } from "./data/ports";
import { UPGRADES, hullById, type Hull } from "./data/ships";
import { pointOnPath, pointOnPathStepped } from "./route";
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

export function canLoadLot(ship: Ship, lot: Lot): boolean {
  if (ship.charter === "out") return false;
  return remainingCeu(ship) >= lot.ceu && remainingHh(ship) >= (lot.hh ?? 0);
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
