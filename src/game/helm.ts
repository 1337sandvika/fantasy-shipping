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

export type HarborKind =
  | "straight"
  | "dogleg"
  | "narrow"
  | "lock"
  | "fingers"
  | "island"
  | "side"
  | "basin";

export type HarborProp = {
  kind: "bldg" | "car" | "tank" | "box" | "crane" | "tree" | "road" | "park" | "lot";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
};

export type Harbor = {
  id: string;
  name: string;
  kind: HarborKind;
  briefKey: string;
  chan: number;
  berth: number;
  berthX: number;
  berthY: number;
  berthHeading: number;
  current: number;
  hub: boolean;
  buoys: { x: number; y: number; port: boolean }[];
  walls: { x: number; y: number; w: number; h: number }[];
  props: HarborProp[];
  seaY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type HelmActions = { throttle: number; steer: number };

const KINDS: HarborKind[] = ["straight", "dogleg", "narrow", "lock", "fingers", "island", "side", "basin"];

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 13), 16843009) >>> 0;
    return (s >>> 0) / 4294967296;
  };
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
  const h = hash(portId);
  const r = rng(h);
  const kind = KINDS[h % KINDS.length]!;
  const seaY = 118;
  let chan = (port.hub ? 13.8 : 16.8) - Math.min(3.2, ship.ceu / 4500);
  if (kind === "narrow") chan *= 0.72;
  if (kind === "basin") chan *= 0.78;
  const berth = 9 + r() * 2.2;
  const current = (r() - 0.45) * (kind === "narrow" ? 1.6 : 1.15);
  const walls: Harbor["walls"] = [];
  const buoys: Harbor["buoys"] = [];
  let berthX = 0;
  let berthY = 4;
  let berthHeading = 0;
  const half = chan / 2;

  const bank = (x: number, y: number, w: number, h: number) => walls.push({ x, y, w, h });

  if (kind === "straight" || kind === "narrow") {
    bank(-48, -16, 48 - half, seaY + 20);
    bank(half, -16, 48 - half, seaY + 20);
    bank(-berth / 2 - 20, -16, 20, 16);
    bank(berth / 2, -16, 20, 16);
    for (const y of [24, 50, 76, 102]) {
      buoys.push({ x: -half + 1.1, y, port: true });
      buoys.push({ x: half - 1.1, y, port: false });
    }
  } else if (kind === "dogleg") {
    const mid = 56;
    const shift = 11;
    bank(-48, -16, 48 - half, mid + 6);
    bank(half, -16, 48 - half, mid + 6);
    bank(-48 + shift, mid, 48 - half, seaY - mid + 16);
    bank(half + shift, mid, 48 - half, seaY - mid + 16);
    bank(-berth / 2 - 18, -16, 18, 16);
    bank(berth / 2, -16, 18, 16);
    bank(half - 1, mid - 2, shift + 2, 4);
    bank(-half + shift - 2, mid + 8, 4, 10);
    for (const y of [22, 44]) {
      buoys.push({ x: -half + 1, y, port: true });
      buoys.push({ x: half - 1, y, port: false });
    }
    for (const y of [72, 96]) {
      buoys.push({ x: -half + shift + 1, y, port: true });
      buoys.push({ x: half + shift - 1, y, port: false });
    }
  } else if (kind === "lock") {
    bank(-48, -16, 48 - half, seaY + 20);
    bank(half, -16, 48 - half, seaY + 20);
    bank(-berth / 2 - 18, -16, 18, 16);
    bank(berth / 2, -16, 18, 16);
    bank(-half - 8, 38, half - 1.6 + 8, 3.2);
    bank(1.6, 38, half - 1.6 + 8, 3.2);
    bank(-half - 8, 78, half - 1.6 + 8, 3.2);
    bank(1.6, 78, half - 1.6 + 8, 3.2);
    buoys.push({ x: -1.4, y: 38, port: true }, { x: 1.4, y: 38, port: false });
    buoys.push({ x: -1.4, y: 78, port: true }, { x: 1.4, y: 78, port: false });
  } else if (kind === "fingers") {
    bank(-48, -16, 48 - half, seaY + 20);
    bank(half, -16, 48 - half, seaY + 20);
    bank(-berth / 2 - 18, -16, 18, 16);
    bank(berth / 2, -16, 18, 16);
    bank(-half, 32, 5.5, 2.2);
    bank(half - 5.5, 58, 5.5, 2.2);
    bank(-half, 84, 5.5, 2.2);
    for (const y of [22, 46, 70, 98]) {
      buoys.push({ x: -half + 1.2, y, port: true });
      buoys.push({ x: half - 1.2, y, port: false });
    }
  } else if (kind === "island") {
    bank(-48, -16, 48 - half, seaY + 20);
    bank(half, -16, 48 - half, seaY + 20);
    bank(-berth / 2 - 18, -16, 18, 16);
    bank(berth / 2, -16, 18, 16);
    bank(-4.2, 54, 8.4, 11);
    for (const y of [24, 42, 78, 100]) {
      buoys.push({ x: -half + 1, y, port: true });
      buoys.push({ x: half - 1, y, port: false });
    }
    buoys.push({ x: -5.2, y: 53, port: true }, { x: 5.2, y: 53, port: false });
  } else if (kind === "side") {
    bank(-48, -16, 48 - half, seaY + 20);
    bank(half + 14, -16, 34 - half, seaY + 20);
    bank(half, -16, 14, 28);
    bank(half, 52, 14, seaY);
    berthX = half + 6;
    berthY = 38;
    berthHeading = Math.PI / 2;
    bank(-berth / 2 - 16, -16, 16, 14);
    for (const y of [20, 48, 76, 104]) {
      buoys.push({ x: -half + 1, y, port: true });
      buoys.push({ x: half - 1, y: y === 48 ? 62 : y, port: false });
    }
  } else {
    bank(-52, -16, 52 - half * 1.7, 62);
    bank(half * 1.7, -16, 52 - half * 1.7, 62);
    bank(-48, 58, 48 - half, seaY);
    bank(half, 58, 48 - half, seaY);
    bank(-berth / 2 - 20, -16, 20, 16);
    bank(berth / 2, -16, 20, 16);
    for (const y of [22, 44]) {
      buoys.push({ x: -half * 1.7 + 1, y, port: true });
      buoys.push({ x: half * 1.7 - 1, y, port: false });
    }
    for (const y of [74, 100]) {
      buoys.push({ x: -half + 1, y, port: true });
      buoys.push({ x: half - 1, y, port: false });
    }
  }

  const props = decorate(kind, h, seaY, half);
  return {
    id: portId,
    name: port.name ?? portId,
    kind,
    briefKey: "helm.layout." + kind,
    chan,
    berth,
    berthX,
    berthY,
    berthHeading,
    current,
    hub: port.hub,
    buoys,
    walls,
    props,
    seaY,
    minX: -56,
    maxX: 56,
    minY: -22,
    maxY: seaY + 24,
  };
}

const ROOF = ["#c45c4a", "#d9a441", "#6b8f71", "#4a6fa5", "#b86b3d", "#8b5a7a", "#cfc6b0"];

function decorate(kind: HarborKind, seed: number, seaY: number, half: number): HarborProp[] {
  const r = rng(seed ^ 0x9e3779b9);
  const props: HarborProp[] = [];
  const add = (p: HarborProp) => props.push(p);
  add({ kind: "road", x: -52, y: -20, w: 18, h: seaY + 28, color: "#3a3a3a" });
  add({ kind: "road", x: 34, y: -20, w: 18, h: seaY + 28, color: "#3a3a3a" });
  add({ kind: "lot", x: -50, y: 8, w: 14, h: 22, color: "#2e2e2e" });
  add({ kind: "lot", x: 36, y: 40, w: 14, h: 18, color: "#2e2e2e" });
  for (let i = 0; i < 10; i++) {
    add({
      kind: "car",
      x: -48 + (i % 2) * 5.2,
      y: 10 + Math.floor(i / 2) * 3.6,
      w: 1.6,
      h: 2.8,
      color: ROOF[Math.floor(r() * ROOF.length)!]!,
    });
  }
  for (let i = 0; i < 8; i++) {
    add({
      kind: "bldg",
      x: (r() < 0.5 ? -50 : 36) + r() * 4,
      y: 4 + r() * (seaY - 20),
      w: 4 + r() * 7,
      h: 4 + r() * 8,
      color: ROOF[Math.floor(r() * ROOF.length)!]!,
    });
  }
  for (let i = 0; i < 5; i++) {
    add({ kind: "tank", x: -46 + r() * 6, y: 70 + r() * 30, w: 3.2 + r() * 2, h: 3.2, color: "#8a8f7a" });
  }
  for (let i = 0; i < 6; i++) {
    add({
      kind: "box",
      x: 37 + (i % 3) * 3.2,
      y: 16 + Math.floor(i / 3) * 4.4,
      w: 2.8,
      h: 4,
      color: i % 2 ? "#3d6ea8" : "#b33b2e",
    });
  }
  add({ kind: "crane", x: -half - 10, y: 28, w: 8, h: 3, color: "#c9a227" });
  add({ kind: "crane", x: half + 2, y: 88, w: 8, h: 3, color: "#c9a227" });
  add({ kind: "park", x: -50, y: 96, w: 14, h: 16, color: "#2f6b3a" });
  for (let i = 0; i < 5; i++) {
    add({ kind: "tree", x: -48 + r() * 10, y: 98 + r() * 12, w: 1.6, h: 1.6, color: "#1f4d28" });
  }
  if (kind === "island") add({ kind: "park", x: -4, y: 55, w: 8, h: 9, color: "#3a7a44" });
  return props;
}

export function spawnCraft(kind: HelmJob["kind"], ship: Pick<Ship, "ceu" | "condition">, harbor: Harbor): HelmCraft {
  const length = 6.2 + Math.min(9, ship.ceu / 2200);
  const beam = 2.15 + Math.min(1.6, ship.ceu / 9000);
  const cond = Math.max(0.55, ship.condition / 100);
  const maxSpeed = (kind === "arrive" ? 7.2 : 8.6) * cond;
  const turnRate = (1.85 - length * 0.055) * cond;
  if (kind === "depart") {
    return {
      x: harbor.berthX,
      y: harbor.berthY,
      heading: harbor.berthHeading,
      speed: 0,
      length,
      beam,
      maxSpeed,
      turnRate,
    };
  }
  const mouthX = harbor.kind === "dogleg" ? 11 : 0;
  return {
    x: mouthX + (hash(String(ship.ceu) + harbor.id) % 7) - 3,
    y: harbor.seaY + 8,
    heading: Math.PI + 0.06,
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
    const mouth = harbor.kind === "dogleg" ? 11 : 0;
    return c.y > harbor.seaY + 2 && Math.abs(c.x - mouth) < harbor.chan + 6 && c.speed > 1.2;
  }
  return (
    Math.hypot(c.x - harbor.berthX, c.y - harbor.berthY) < harbor.berth * 0.55 &&
    Math.abs(wrapPi(c.heading - harbor.berthHeading)) < 0.5 &&
    Math.abs(c.speed) < 2.4
  );
}

export type HelmHit = false | "scrape" | "sink";

export function stepCraft(c: HelmCraft, a: HelmActions, harbor: Harbor, dt: number): { craft: HelmCraft; hit: HelmHit } {
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
  const x = c.x + f.x * speed * dt + harbor.current * 0.55 * dt;
  const y = c.y + f.y * speed * dt;
  const next = { ...c, x, y, heading, speed };
  if (!colliding(next, harbor)) return { craft: next, hit: false };
  const bounced = { ...c, speed: -c.speed * 0.28, x: c.x - f.x * 0.35, y: c.y - f.y * 0.35 };
  const v = Math.abs(c.speed);
  const hit: HelmHit = v > 3.6 ? "sink" : v > 2.05 ? "scrape" : false;
  return { craft: colliding(bounced, harbor) ? { ...c, speed: 0 } : bounced, hit };
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
