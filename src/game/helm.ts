import { getPort } from "./data/ports";
import type { HelmJob, Ship } from "./types";

export type HelmCraft = {
  x: number;
  y: number;
  heading: number;
  speed: number;
  length: number;
  beam: number;
  maxSpeed: number;
  turnRate: number;
};

export type Harbor = {
  chan: number;
  berth: number;
  current: number;
  hub: boolean;
  buoys: { x: number; y: number; port: boolean }[];
  walls: { x: number; y: number; w: number; h: number }[];
  seaY: number;
};

export type HelmActions = {
  throttle: number;
  steer: number;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pilotFee(ship: Pick<Ship, "ceu" | "hold">, portId: string, kind: HelmJob["kind"], heat = 0): number {
  const port = getPort(portId);
  const base = 7200 + ship.ceu * 1.15;
  const hub = port.hub ? 1.35 : 1;
  const arrive = kind === "arrive" ? 1.18 : 1;
  const grey = ship.hold.some((l) => l.grey) ? 1.22 : 1;
  const heatMul = 1 + Math.min(0.35, heat / 220);
  return Math.round(base * hub * arrive * grey * heatMul);
}

export function makeHarbor(portId: string, ship: Pick<Ship, "ceu">): Harbor {
  const port = getPort(portId);
  const r = (hash(portId) % 1000) / 1000;
  const chan = (port.hub ? 13.5 : 16.5) - Math.min(3.2, ship.ceu / 4500);
  const berth = 9 + r * 2;
  const current = (r - 0.45) * 1.15;
  const seaY = 118;
  const half = chan / 2;
  const walls: Harbor["walls"] = [
    { x: -42, y: -10, w: 42 - half, h: seaY + 4 },
    { x: half, y: -10, w: 42 - half, h: seaY + 4 },
    { x: -berth / 2 - 18, y: -14, w: 18, h: 18 },
    { x: berth / 2, y: -14, w: 18, h: 18 },
  ];
  const buoys: Harbor["buoys"] = [22, 48, 76, 102].map((y, i) => ({
    x: i % 2 === 0 ? -half + 0.9 : half - 0.9,
    y,
    port: i % 2 === 0,
  }));
  return { chan, berth, current, hub: port.hub, buoys, walls, seaY };
}

export function spawnCraft(kind: HelmJob["kind"], ship: Pick<Ship, "ceu" | "condition">, harbor: Harbor): HelmCraft {
  const length = 6.2 + Math.min(9, ship.ceu / 2200);
  const beam = 2.15 + Math.min(1.6, ship.ceu / 9000);
  const cond = Math.max(0.55, ship.condition / 100);
  const maxSpeed = (kind === "arrive" ? 7.2 : 8.6) * cond;
  const turnRate = (1.85 - length * 0.055) * cond;
  if (kind === "depart") {
    return { x: 0, y: 4, heading: 0, speed: 0, length, beam, maxSpeed, turnRate };
  }
  return {
    x: (hash(String(ship.ceu)) % 7) - 3,
    y: harbor.seaY + 8,
    heading: Math.PI + 0.08,
    speed: 3.2,
    length,
    beam,
    maxSpeed,
    turnRate,
  };
}

function wrapPi(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/** Forward in world: heading 0 = +Y (out to sea). +heading = toward −X = left on a bow-up chase cam. */
export function forward(heading: number): { x: number; y: number } {
  return { x: -Math.sin(heading), y: Math.cos(heading) };
}

function shipCorners(c: HelmCraft): { x: number; y: number }[] {
  const f = forward(c.heading);
  const rx = f.y;
  const ry = -f.x;
  const hl = c.length / 2;
  const hb = c.beam / 2;
  return [
    { x: c.x + f.x * hl + rx * hb, y: c.y + f.y * hl + ry * hb },
    { x: c.x + f.x * hl - rx * hb, y: c.y + f.y * hl - ry * hb },
    { x: c.x - f.x * hl - rx * hb, y: c.y - f.y * hl - ry * hb },
    { x: c.x - f.x * hl + rx * hb, y: c.y - f.y * hl + ry * hb },
  ];
}

function inRect(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function colliding(c: HelmCraft, harbor: Harbor): boolean {
  const pts = shipCorners(c);
  if (pts.some((p) => harbor.walls.some((w) => inRect(p, w)))) return true;
  if (pts.some((p) => harbor.buoys.some((b) => Math.hypot(p.x - b.x, p.y - b.y) < 1.05))) return true;
  return false;
}

export function helmWon(c: HelmCraft, kind: HelmJob["kind"], harbor: Harbor): boolean {
  if (kind === "depart") {
    return c.y > harbor.seaY + 2 && Math.abs(c.x) < harbor.chan + 6 && c.speed > 1.2;
  }
  return c.y < 7.5 && Math.abs(c.x) < harbor.berth * 0.42 && Math.abs(wrapPi(c.heading)) < 0.42 && Math.abs(c.speed) < 2.4;
}

export function stepCraft(c: HelmCraft, a: HelmActions, harbor: Harbor, dt: number): { craft: HelmCraft; hit: boolean } {
  const throttle = Math.max(-1, Math.min(1, a.throttle));
  const steer = Math.max(-1, Math.min(1, a.steer));
  let speed = c.speed + throttle * 5.8 * dt;
  speed *= 1 - 0.28 * dt;
  speed = Math.max(-c.maxSpeed * 0.38, Math.min(c.maxSpeed, speed));
  const speedFactor = Math.min(1, Math.abs(speed) / Math.max(1.2, c.maxSpeed * 0.45));
  const reverse = speed >= 0 ? 1 : -1;
  let heading = c.heading + steer * c.turnRate * Math.max(0.22, speedFactor) * reverse * dt;
  heading = wrapPi(heading);
  const f = forward(heading);
  let x = c.x + f.x * speed * dt + harbor.current * 0.55 * dt;
  let y = c.y + f.y * speed * dt;
  const next = { ...c, x, y, heading, speed };
  if (!colliding(next, harbor)) return { craft: next, hit: false };
  const bounced = { ...c, speed: -c.speed * 0.28, x: c.x - f.x * 0.35, y: c.y - f.y * 0.35 };
  return { craft: colliding(bounced, harbor) ? { ...c, speed: 0 } : bounced, hit: Math.abs(c.speed) > 2.05 };
}

export function actionsFromKeys(keys: Set<string>, probeSteer: number | null): HelmActions {
  let throttle = 0;
  let steer = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) throttle += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) throttle -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
  if (probeSteer != null) steer = probeSteer;
  return { throttle, steer };
}
