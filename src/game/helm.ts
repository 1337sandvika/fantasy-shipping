// Port of the grok.me helm generator.
import { getPort } from "./data/ports";
import type { HelmJob, Ship } from "./types";

export type HelmCraft = {
  x: number; y: number; heading: number; speed: number;
  length: number; beam: number; maxSpeed: number; turnRate: number;
};
export type HarborKind = "straight" | "dogleg" | "narrow" | "lock" | "piers" | "island" | "offset" | "basin";
export type Seg = { y0: number; y1: number; x: number; w: number };
export type Wall = { x: number; y: number; w: number; h: number };
export type Prop = { kind: string; x: number; y: number; w: number; h: number; color: number };
export type Car = { x: number; y: number; w: number; h: number; color: number; rot: number };
export type Road = { x: number; y: number; w: number; h: number; vert: boolean };
export type Traffic = HelmCraft & { dir: number };
export type Harbor = {
  id: string; name: string; kind: HarborKind; briefKey: string;
  chan: number; berth: number; current: number; wind: number; hub: boolean;
  offset: number; spawnX: number; berthX: number; berthY: number; berthHeading: number;
  buoys: { x: number; y: number; port: boolean }[];
  walls: Wall[]; segs: Seg[]; cranes: { x: number; y: number }[];
  props: Prop[]; cars: Car[]; roads: Road[]; traffic: Traffic[];
  seaY: number; span: number; water: number; palette: number;
  minX: number; maxX: number; minY: number; maxY: number;
};
export type HelmActions = { throttle: number; steer: number };
export type HelmHit = false | "scrape" | "sink";
const KINDS: HarborKind[] = ["straight", "dogleg", "narrow", "lock", "piers", "island", "offset", "basin"];
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
export function pilotFee(ship: Pick<Ship, "ceu" | "hold">, portId: string, kind: HelmJob["kind"], heat = 0): number {
  const port = getPort(portId);
  return Math.round((7200 + ship.ceu * 1.15) * (port.hub ? 1.35 : 1) * (kind === "arrive" ? 1.18 : 1) * (ship.hold.some((l) => l.grey) ? 1.22 : 1) * (1 + Math.min(0.35, heat / 220)));
}
function segsFor(kind: HarborKind, chan: number, seaY: number, r: () => number): Seg[] {
  const i = chan;
  if (kind === "dogleg") {
    const e = 7 + r() * 5;
    return [{ y0: -12, y1: 26, x: 0, w: i + 1.2 }, { y0: 24, y1: 50, x: e * 0.55, w: i + 0.4 }, { y0: 48, y1: seaY + 18, x: e, w: i }];
  }
  if (kind === "narrow") return [{ y0: -12, y1: seaY + 18, x: 0, w: Math.max(9.2, i - 4.2) }];
  if (kind === "lock") {
    const e = Math.max(9.4, i - 5.5);
    return [{ y0: -12, y1: 30, x: 0, w: i + 3 }, { y0: 28, y1: 54, x: 0, w: e }, { y0: 52, y1: seaY + 18, x: 0, w: i + 1 }];
  }
  if (kind === "piers") return [{ y0: -12, y1: seaY + 18, x: 0, w: i + 3.5 }];
  if (kind === "island") return [{ y0: -12, y1: seaY + 18, x: 0, w: i + 6 }];
  if (kind === "offset") return [{ y0: -12, y1: 28, x: (9 + r() * 3) * 0.45, w: i + 10 }, { y0: 26, y1: seaY + 18, x: 0, w: i }];
  if (kind === "basin") return [{ y0: -12, y1: 38, x: 0, w: i + 10 }, { y0: 36, y1: seaY + 18, x: 0, w: Math.max(11, i - 1.5) }];
  return [{ y0: -12, y1: seaY + 18, x: 0, w: i }];
}
function wallsFrom(segs: Seg[], span: number): Wall[] {
  const n: Wall[] = [{ x: -span, y: -28, w: span * 2, h: 16 }];
  for (const r of segs) {
    const L = r.x - r.w / 2, R = r.x + r.w / 2;
    n.push({ x: -span, y: r.y0, w: L + span, h: r.y1 - r.y0 });
    n.push({ x: R, y: r.y0, w: span - R, h: r.y1 - r.y0 });
  }
  return n;
}
export function makeHarbor(portId: string, ship: Pick<Ship, "ceu">): Harbor {
  const port = getPort(portId);
  const r = rng(hash(portId));
  const i = hash(portId);
  const kind = KINDS[i % KINDS.length]!;
  const seaY = 92, span = 88;
  const chan0 = (port.hub ? 13.4 : 16.6) - Math.min(3.2, ship.ceu / 4200);
  const berth = 9 + r() * 2.4;
  const current = (r() - 0.48) * (kind === "dogleg" || kind === "offset" ? 1.8 : 1.2);
  const wind = (r() - 0.5) * (kind === "narrow" ? 2.1 : 1.4);
  const segs = segsFor(kind, chan0, seaY, r);
  const walls = wallsFrom(segs, span);
  if (kind === "piers") {
    const e = segs[0]!;
    for (let t = 0; t < 3; t++) {
      const n = 22 + t * 22, a = 4.2 + r() * 1.4;
      if (t % 2 === 0) walls.push({ x: e.x - e.w / 2, y: n, w: a, h: 2.2 });
      else walls.push({ x: e.x + e.w / 2 - a, y: n, w: a, h: 2.2 });
    }
  }
  if (kind === "island") {
    const e = segs[0]!;
    walls.push({ x: e.x - 2.6, y: 38, w: 5.2, h: 16 }, { x: e.x - 3.4, y: 40, w: 6.8, h: 12 });
  }
  if (kind === "lock") {
    const e = segs[1] ?? segs[0]!;
    walls.push({ x: e.x - e.w / 2 - 1.2, y: 28, w: 1.4, h: 3.2 }, { x: e.x + e.w / 2 - 0.2, y: 28, w: 1.4, h: 3.2 });
    walls.push({ x: e.x - e.w / 2 - 1.2, y: 50, w: 1.4, h: 3.2 }, { x: e.x + e.w / 2 - 0.2, y: 50, w: 1.4, h: 3.2 });
  }
  const m = segs[0]!;
  const spawnX = kind === "offset" ? m.x + 4 : m.x;
  const berthX = m.x;
  const chan = Math.max(...segs.map((e) => e.w));
  const buoys: Harbor["buoys"] = [];
  for (const e of segs) for (let t = e.y0 + 10; t < e.y1 - 6; t += 18) {
    buoys.push({ x: e.x - e.w / 2 + 1.05, y: t, port: true }, { x: e.x + e.w / 2 - 1.05, y: t, port: false });
  }
  const cranes = [{ x: berthX - berth * 0.35, y: 2.4 }, { x: berthX + berth * 0.3, y: 3.1 }];
  if (port.hub) cranes.push({ x: berthX - 1.4, y: 11 });
  return {
    id: portId, name: port.name, kind, briefKey: "helm.layout." + kind,
    chan, berth, current, wind, hub: port.hub,
    offset: 0, spawnX, berthX, berthY: 4, berthHeading: 0,
    buoys, walls, segs, cranes, props: [], cars: [], roads: [], traffic: [],
    seaY, span: 52, water: i % 3, palette: Math.abs(Math.floor(port.lat / 12)) % 4,
    minX: -span, maxX: span, minY: -28, maxY: seaY + 24,
  };
}
export function spawnCraft(kind: HelmJob["kind"], ship: Pick<Ship, "ceu" | "condition">, harbor: Harbor): HelmCraft {
  const length = 6.4 + Math.min(9.2, ship.ceu / 2100);
  const beam = 2.2 + Math.min(1.7, ship.ceu / 8500);
  const cond = Math.max(0.55, ship.condition / 100);
  const maxSpeed = (kind === "arrive" ? 6.4 : 7.4) * cond;
  const turnRate = (1.55 - length * 0.048) * cond;
  if (kind === "depart") return { x: harbor.spawnX, y: 12, heading: 0, speed: 0, length, beam, maxSpeed, turnRate };
  const last = harbor.segs[harbor.segs.length - 1]!;
  return { x: last.x + ((hash(String(ship.ceu)) % 7) - 3) * 0.4, y: harbor.seaY + 6, heading: Math.PI + 0.06, speed: 2.6, length, beam, maxSpeed, turnRate };
}
function wrapPi(a: number) { let x = a; while (x > Math.PI) x -= Math.PI * 2; while (x < -Math.PI) x += Math.PI * 2; return x; }
export function forward(heading: number) { return { x: -Math.sin(heading), y: Math.cos(heading) }; }
function corners(c: HelmCraft) {
  const f = forward(c.heading), rx = f.y, ry = -f.x, hl = c.length / 2, hb = c.beam / 2;
  return [
    { x: c.x + f.x * hl + rx * hb, y: c.y + f.y * hl + ry * hb },
    { x: c.x + f.x * hl - rx * hb, y: c.y + f.y * hl - ry * hb },
    { x: c.x - f.x * hl - rx * hb, y: c.y - f.y * hl - ry * hb },
    { x: c.x - f.x * hl + rx * hb, y: c.y - f.y * hl + ry * hb },
  ];
}
function inRect(p: { x: number; y: number }, r: Wall) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
export function colliding(c: HelmCraft, harbor: Harbor): boolean {
  const pts = corners(c);
  return pts.some((p) => harbor.walls.some((w) => inRect(p, w))) || pts.some((p) => harbor.buoys.some((b) => Math.hypot(p.x - b.x, p.y - b.y) < 1.05));
}
export function helmWon(c: HelmCraft, kind: HelmJob["kind"], harbor: Harbor): boolean {
  const last = harbor.segs[harbor.segs.length - 1]!;
  if (kind === "depart") return c.y > harbor.seaY + 2 && Math.abs(c.x - last.x) < last.w * 0.7 && c.speed > 1.1;
  const i = Math.abs(wrapPi(c.heading));
  return c.y < 7.4 && Math.abs(c.x - harbor.berthX) < harbor.berth * 0.5 && (i < 0.55 || Math.abs(i - Math.PI) < 0.55) && Math.abs(c.speed) < 2.2;
}
export function stepCraft(c: HelmCraft, a: HelmActions, harbor: Harbor, dt: number): { craft: HelmCraft; hit: HelmHit } {
  const throttle = Math.max(-1, Math.min(1, a.throttle));
  const steer = Math.max(-1, Math.min(1, a.steer));
  let speed = c.speed + throttle * 4.4 * dt;
  speed *= 1 - 0.32 * dt;
  speed = Math.max(-c.maxSpeed * 0.34, Math.min(c.maxSpeed, speed));
  const sf = Math.min(1, Math.abs(speed) / Math.max(1.15, c.maxSpeed * 0.42));
  const rev = speed >= 0 ? 1 : -1;
  const heading = wrapPi(c.heading + steer * c.turnRate * Math.max(0.22, sf) * rev * dt);
  const f = forward(heading);
  const next = { ...c, x: c.x + f.x * speed * dt + harbor.current * 0.55 * dt + harbor.wind * 0.12 * dt, y: c.y + f.y * speed * dt, heading, speed };
  if (!colliding(next, harbor)) return { craft: next, hit: false };
  const bounced = { ...c, speed: -c.speed * 0.28, x: c.x - f.x * 0.35, y: c.y - f.y * 0.35 };
  const v = Math.abs(c.speed);
  const hit: HelmHit = v > 3.6 ? "sink" : v > 2.05 ? "scrape" : false;
  return { craft: colliding(bounced, harbor) ? { ...c, speed: 0 } : bounced, hit };
}
export function actionsFromKeys(keys: Set<string>, probeSteer: number | null): HelmActions {
  let throttle = 0, steer = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) throttle += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) throttle -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
  if (probeSteer != null) steer = probeSteer;
  return { throttle, steer };
}
