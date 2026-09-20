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
  id: string; name: string; kind: HarborKind; briefKey: string; layout: HarborKind;
  chan: number; berth: number; current: number; wind: number; hub: boolean;
  offset: number; spawnX: number; berthX: number;
  buoys: { x: number; y: number; port: boolean }[];
  walls: Wall[]; segs: Seg[]; cranes: { x: number; y: number }[];
  props: Prop[]; cars: Car[]; roads: Road[]; traffic: Traffic[];
  seaY: number; span: number; water: number; palette: number;
};
export type HelmActions = { throttle: number; steer: number };
export type HelmHit = false | "scrape" | "sink";
export type HelmCrashCause = "traffic" | "wall";
export type HelmStep = { craft: HelmCraft; harbor: Harbor; hit: HelmHit; cause?: HelmCrashCause };
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
  if (kind === "dogleg") {
    const e = 7 + r() * 5;
    return [{ y0: -12, y1: 26, x: 0, w: chan + 1.2 }, { y0: 24, y1: 50, x: e * 0.55, w: chan + 0.4 }, { y0: 48, y1: seaY + 18, x: e, w: chan }];
  }
  if (kind === "narrow") return [{ y0: -12, y1: seaY + 18, x: 0, w: Math.max(9.2, chan - 4.2) }];
  if (kind === "lock") {
    const e = Math.max(9.4, chan - 5.5);
    return [{ y0: -12, y1: 30, x: 0, w: chan + 3 }, { y0: 28, y1: 54, x: 0, w: e }, { y0: 52, y1: seaY + 18, x: 0, w: chan + 1 }];
  }
  if (kind === "piers") return [{ y0: -12, y1: seaY + 18, x: 0, w: chan + 3.5 }];
  if (kind === "island") return [{ y0: -12, y1: seaY + 18, x: 0, w: chan + 6 }];
  if (kind === "offset") return [{ y0: -12, y1: 28, x: (9 + r() * 3) * 0.45, w: chan + 10 }, { y0: 26, y1: seaY + 18, x: 0, w: chan }];
  if (kind === "basin") return [{ y0: -12, y1: 38, x: 0, w: chan + 10 }, { y0: 36, y1: seaY + 18, x: 0, w: Math.max(11, chan - 1.5) }];
  return [{ y0: -12, y1: seaY + 18, x: 0, w: chan }];
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
function decorate(segs: Seg[], span: number, r: () => number, seed: number) {
  const props: Prop[] = [], cars: Car[] = [], roads: Road[] = [];
  const edge = (y: number, side: number) => {
    const s = segs.find((e) => y >= e.y0 && y < e.y1) ?? segs[0]!;
    return side < 0 ? s.x - s.w / 2 : s.x + s.w / 2;
  };
  const kinds = ["park", "lot", "tank", "warehouse", "container", "silo", "block"];
  for (const side of [-1, 1]) {
    roads.push({ x: side < 0 ? -span : edge(40, 1) + 1.2, y: -8, w: side < 0 ? edge(40, -1) + span - 1.4 : span - edge(40, 1) - 1.2, h: 3.2, vert: false });
    for (let l = 0; l < 7; l++) {
      const u = 8 + l * 13.2;
      const d = edge(u + 4, side);
      const f = side < 0 ? d - 22 : d + 2.2;
      roads.push({ x: d + (side < 0 ? -2.4 : 0.4), y: u, w: 2.2, h: 12.4, vert: true });
      for (let s = 0; s < 3; s++) {
        const c = (seed + l * 17 + s * 9 + (side > 0 ? 3 : 0)) % 7;
        const dw = 5.2 + r() * 3.4, ph = 6.4 + r() * 4.2;
        const m = f + s * 7.2 * side + (side < 0 ? -dw : 0);
        const hk = kinds[c]!;
        const g = hk === "tank" || hk === "silo" ? 4.2 + r() * 1.4 : dw;
        const hh = hk === "park" ? ph + 1 : ph;
        if (Math.abs(m + g / 2) > span - 4) continue;
        const y = segs.find((e) => u + 3 >= e.y0 && u + 3 < e.y1) ?? segs[0]!;
        if (Math.abs(m + g / 2 - y.x) < y.w / 2 + 2.4) continue;
        props.push({ kind: hk, x: m, y: u, w: g, h: hh, color: (seed + l + s) % 8 });
        if (hk === "lot") {
          for (let e = 0; e < 6; e++) cars.push({ x: m + 0.5 + (e % 3) * 1.6, y: u + 0.6 + Math.floor(e / 3) * 2.4, w: 0.7, h: 1.5, color: (seed + e + l) % 6, rot: r() > 0.85 ? 0.08 : 0 });
        }
      }
    }
  }
  return { props, cars, roads };
}
export function makeHarbor(portId: string, ship: Pick<Ship, "ceu">): Harbor {
  const port = getPort(portId);
  const r = rng(hash(portId));
  const i = hash(portId);
  const kind = KINDS[i % KINDS.length]!;
  const seaY = 92, span = 88;
  const chan0 = (port.hub ? 12.6 : 15.6) - Math.min(3.6, ship.ceu / 3800);
  const berth = 9 + r() * 2.4;
  const current = (r() - 0.48) * (kind === "dogleg" || kind === "offset" ? 2.55 : 1.9);
  const wind = (r() - 0.5) * (kind === "narrow" ? 2.95 : 2.05);
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
  const xs = segs.map((e) => e.x);
  const offset = (Math.min(...xs) + Math.max(...xs)) / 2;
  const m = segs[0]!;
  const spawnX = kind === "offset" ? m.x + 4 : m.x;
  const berthX = m.x;
  const chan = Math.max(...segs.map((e) => e.w));
  const buoys: Harbor["buoys"] = [];
  for (const e of segs) for (let y = e.y0 + 10; y < e.y1 - 6; y += 18) {
    buoys.push({ x: e.x - e.w / 2 + 1.05, y, port: true }, { x: e.x + e.w / 2 - 1.05, y, port: false });
  }
  const cranes = [{ x: berthX - berth * 0.35, y: 2.4 }, { x: berthX + berth * 0.3, y: 3.1 }];
  if (port.hub) cranes.push({ x: berthX - 1.4, y: 11 });
  const extra = (port.hub ? 2 + +(i % 3 === 0) : 1 + +(r() > 0.35)) + +(kind === "basin" || kind === "piers");
  const traffic: Traffic[] = [];
  for (let e = 0; e < extra; e++) {
    const t = segs[Math.min(segs.length - 1, 1 + (e % segs.length))]!;
    traffic.push({ x: t.x + (e % 2 === 0 ? -1 : 1) * (t.w * 0.22), y: 40 + e * 18 + r() * 8, heading: e % 2 === 0 ? 0 : Math.PI, speed: 1.2 + r() * 1.15, length: 3.8 + r() * 2.4, beam: 1.25, maxSpeed: 4, turnRate: 1, dir: e % 2 === 0 ? 1 : -1 });
  }
  const dec = decorate(segs, span, r, i);
  return { id: portId, name: port.name, kind, layout: kind, briefKey: "helm.layout." + kind, chan, berth, current, wind, hub: port.hub, offset, spawnX, berthX, buoys, walls, segs, cranes, ...dec, traffic, seaY, span: 52, water: i % 3, palette: Math.abs(Math.floor(port.lat / 12)) % 4 };
}
export function spawnCraft(kind: HelmJob["kind"], ship: Pick<Ship, "ceu" | "condition">, harbor: Harbor): HelmCraft {
  const length = 6.4 + Math.min(9.2, ship.ceu / 2100);
  const beam = 2.2 + Math.min(1.7, ship.ceu / 8500);
  const cond = Math.max(0.55, ship.condition / 100);
  const maxSpeed = (kind === "arrive" ? 6.4 : 7.4) * cond;
  const turnRate = (1.55 - length * 0.048) * cond;
  if (kind === "depart") return { x: harbor.spawnX, y: 12, heading: 0, speed: 0, length, beam, maxSpeed, turnRate };
  const last = harbor.segs[harbor.segs.length - 1]!;
  return { x: last.x + ((hash(String(ship.ceu)) % 7) - 3) * 0.4, y: harbor.seaY + 6, heading: Math.PI + 0.06, speed: 3.35, length, beam, maxSpeed, turnRate };
}
function wrapPi(a: number) { let x = a; while (x > Math.PI) x -= Math.PI * 2; while (x < -Math.PI) x += Math.PI * 2; return x; }
export function forward(heading: number) { return { x: -Math.sin(heading), y: Math.cos(heading) }; }
/** Visual ship is a tapered hull at ~0.92 of length/beam. Collision sits inside that. */
function hullPts(c: HelmCraft) {
  const f = forward(c.heading), rx = f.y, ry = -f.x;
  const hl = c.length * 0.40, hb = c.beam * 0.28;
  const rings: [number, number][] = [[1, 0.16], [0.7, 0.62], [0.25, 1], [0, 1], [-0.25, 1], [-0.7, 0.62], [-1, 0.16]];
  const pts: { x: number; y: number }[] = [];
  for (const [along, across] of rings) {
    pts.push({ x: c.x + f.x * hl * along + rx * hb * across, y: c.y + f.y * hl * along + ry * hb * across });
    if (across !== 0) pts.push({ x: c.x + f.x * hl * along - rx * hb * across, y: c.y + f.y * hl * along - ry * hb * across });
  }
  return pts;
}
function inRect(p: { x: number; y: number }, r: Wall, pad = 0) {
  return p.x > r.x + pad && p.x < r.x + r.w - pad && p.y > r.y + pad && p.y < r.y + r.h - pad;
}
function spine(c: Pick<HelmCraft, "x" | "y" | "heading" | "length">) {
  const f = forward(c.heading), hl = c.length * 0.36;
  return [-1, -0.5, 0, 0.5, 1].map((a) => ({ x: c.x + f.x * hl * a, y: c.y + f.y * hl * a }));
}
export function colliding(c: HelmCraft, harbor: Harbor): boolean {
  return hitsWall(c, harbor) || hitsTraffic(c, harbor);
}
function hitsWall(c: HelmCraft, harbor: Harbor): boolean {
  return hullPts(c).some((p) => harbor.walls.some((w) => inRect(p, w, 0.14)));
}
function hitsTraffic(c: HelmCraft, harbor: Harbor): boolean {
  const mine = spine(c);
  const cr = c.beam * 0.26;
  return harbor.traffic.some((t) => {
    const theirs = spine(t);
    const lim = cr + t.beam * 0.26;
    const lim2 = lim * lim;
    return mine.some((p) => theirs.some((q) => {
      const dx = p.x - q.x, dy = p.y - q.y;
      return dx * dx + dy * dy < lim2;
    }));
  });
}
export function helmWon(c: HelmCraft, kind: HelmJob["kind"], harbor: Harbor): boolean {
  const last = harbor.segs[harbor.segs.length - 1]!;
  if (kind === "depart") return c.y > harbor.seaY + 2 && Math.abs(c.x - last.x) < last.w * 0.7 && c.speed > 1.1;
  const i = Math.abs(wrapPi(c.heading));
  return c.y < 7.4 && Math.abs(c.x - harbor.berthX) < harbor.berth * 0.44 && (i < 0.4 || Math.abs(i - Math.PI) < 0.4) && Math.abs(c.speed) < 1.62;
}
export function stepTraffic(h: Harbor, dt: number): Harbor {
  if (!h.traffic.length) return h;
  const traffic = h.traffic.map((n, idx) => {
    const i = forward(n.heading);
    let y = n.y + i.y * n.speed * n.dir * dt;
    let heading = n.heading, dir = n.dir;
    const lo = 26 + (idx % 3) * 4, hi = h.seaY - 8 - (idx % 2) * 6;
    if (y < lo) { y = lo; dir = 1; heading = 0; }
    if (y > hi) { y = hi; dir = -1; heading = Math.PI; }
    return { ...n, x: n.x + h.current * 0.12 * dt, y, heading, dir };
  });
  return { ...h, traffic };
}
export function stepCraft(c: HelmCraft, a: HelmActions, harbor: Harbor, dt: number): HelmStep {
  const nextH = stepTraffic(harbor, dt);
  const throttle = Math.max(-1, Math.min(1, a.throttle));
  const steer = Math.max(-1, Math.min(1, a.steer));
  let speed = c.speed + throttle * 4.4 * dt;
  speed *= 1 - 0.32 * dt;
  speed = Math.max(-c.maxSpeed * 0.34, Math.min(c.maxSpeed, speed));
  const sf = Math.min(1, Math.abs(speed) / Math.max(1.15, c.maxSpeed * 0.42));
  const rev = speed >= 0 ? 1 : -1;
  const heading = wrapPi(c.heading + steer * c.turnRate * Math.max(0.2, sf) * rev * dt);
  const f = forward(heading);
  const next = { ...c, x: c.x + f.x * speed * dt + nextH.current * 0.22 * dt + nextH.wind * 0.1 * dt, y: c.y + f.y * speed * dt, heading, speed };
  if (!colliding(next, nextH)) return { craft: next, harbor: nextH, hit: false };
  if (hitsTraffic(next, nextH)) {
    const bounced = { ...c, speed: -c.speed * 0.22, x: c.x - f.x * 0.4, y: c.y - f.y * 0.4 };
    const v = Math.abs(c.speed);
    const hit: HelmHit = v > 3.8 ? "sink" : v > 2.6 ? "scrape" : false;
    return { craft: colliding(bounced, nextH) ? { ...c, speed: 0 } : bounced, harbor: nextH, hit, cause: "traffic" };
  }
  const onlyX = { ...next, y: c.y };
  const onlyY = { ...next, x: c.x };
  const okX = !hitsWall(onlyX, nextH);
  const okY = !hitsWall(onlyY, nextH);
  const inv = 1 / Math.max(dt, 1 / 120);
  let slid = next;
  let impact = 0;
  if (okX && okY) {
    slid = Math.abs(next.y - c.y) >= Math.abs(next.x - c.x) ? onlyY : onlyX;
  } else if (okX) {
    slid = onlyX;
    impact = Math.abs(next.y - c.y) * inv;
  } else if (okY) {
    slid = onlyY;
    impact = Math.abs(next.x - c.x) * inv;
  } else {
    slid = { ...c, heading, speed: 0 };
    impact = Math.hypot(next.x - c.x, next.y - c.y) * inv;
  }
  const hit: HelmHit = impact > 4.4 ? "sink" : impact > 3.15 ? "scrape" : false;
  if (!hit) return { craft: { ...slid, speed: slid.speed * (okX && okY ? 1 : 0.88) }, harbor: nextH, hit: false };
  const bounced = { ...c, speed: -c.speed * 0.18, x: c.x - f.x * 0.35, y: c.y - f.y * 0.35 };
  return { craft: hitsWall(bounced, nextH) ? { ...c, heading, speed: 0 } : bounced, harbor: nextH, hit, cause: "wall" };
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
export function goalOf(kind: HelmJob["kind"], harbor: Harbor) {
  return kind === "depart" ? { x: harbor.segs[harbor.segs.length - 1]!.x, y: harbor.seaY + 6 } : { x: harbor.berthX, y: 3.2 };
}
