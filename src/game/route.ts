import { EDGES, NODES } from "./data/seaways";
import { PORTS } from "./data/ports";
import { haversineNm, isLand, lerpLonLat, segmentHitsLand, wrapLon } from "./geo";

type Pt = { lon: number; lat: number };

const PORT_IDS = new Set(PORTS.map((p) => p.id));

/** Walk a short spiral so a port coordinate in a city sits in the harbour, not 400 nm offshore. */
function seekWater(p: Pt, hint: Pt, maxDeg = 0.9): Pt {
  if (!isLand(p.lon, p.lat)) return p;
  let dLon = hint.lon - p.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dLat = hint.lat - p.lat;
  const len = Math.hypot(dLon, dLat) || 1;
  const ux = dLon / len;
  const uy = dLat / len;
  for (let i = 1; i <= 18; i++) {
    const deg = Math.min(maxDeg, i * 0.045);
    const q = { lon: wrapLon(p.lon + ux * deg), lat: p.lat + uy * deg };
    if (q.lat < -47 || q.lat > 71) continue;
    if (!isLand(q.lon, q.lat)) return q;
  }
  for (let r = 0.05; r <= maxDeg + 1e-6; r += 0.05) {
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const q = { lon: wrapLon(p.lon + Math.cos(ang) * r), lat: p.lat + Math.sin(ang) * r };
      if (q.lat < -47 || q.lat > 71) continue;
      if (!isLand(q.lon, q.lat)) return q;
    }
  }
  return p;
}

const WATER_NODE: Record<string, Pt> = {};
for (const [id, p] of Object.entries(NODES)) {
  WATER_NODE[id] = seekWater(p, { lon: p.lon, lat: Math.min(71, p.lat + 0.25) }, 0.85);
}

const GRAPH: Record<string, { to: string; nm: number }[]> = {};
for (const [a, b] of EDGES) {
  const pa = NODES[a];
  const pb = NODES[b];
  if (!pa || !pb) continue;
  const raw = Math.max(1, haversineNm(pa, pb));
  const wa = WATER_NODE[a] ?? pa;
  const wb = WATER_NODE[b] ?? pb;
  const cuts = segmentHitsLand(wa, wb, 22);
  const nm = raw * (cuts ? 8 : 1);
  (GRAPH[a] ??= []).push({ to: b, nm });
  (GRAPH[b] ??= []).push({ to: a, nm });
}

const CACHE: Record<string, { path: Pt[]; nm: number }> = {};
const WATER_CACHE = new Map<string, Pt[]>();

function namedKey(p: Pt): string {
  return `${p.lon.toFixed(3)},${p.lat.toFixed(3)}`;
}

const NAMED_KEYS = new Set(Object.values(NODES).map(namedKey));

function nearNamed(p: Pt): boolean {
  if (NAMED_KEYS.has(namedKey(p))) return true;
  for (const n of Object.values(NODES)) {
    if (Math.abs(n.lon - p.lon) < 0.4 && Math.abs(n.lat - p.lat) < 0.4) return true;
  }
  return false;
}

/** True for original seaway / port nodes — densified via-points stay off hop dots. */
export function isNamedSeaPoint(p: Pt): boolean {
  return nearNamed(p);
}

function dijkstraIds(from: string, to: string): string[] | null {
  if (from === to) return [from];
  if (!NODES[from] || !NODES[to]) return null;
  const dist: Record<string, number> = {};
  const prev: Record<string, string> = {};
  const q = new Set(Object.keys(NODES));
  for (const k of q) dist[k] = Infinity;
  dist[from] = 0;
  while (q.size) {
    let u: string | null = null;
    let best = Infinity;
    for (const k of q) {
      const d = dist[k] ?? Infinity;
      if (d < best) {
        best = d;
        u = k;
      }
    }
    if (u == null || best === Infinity) break;
    q.delete(u);
    if (u === to) break;
    for (const e of GRAPH[u] ?? []) {
      const alt = best + e.nm;
      if (alt < (dist[e.to] ?? Infinity)) {
        dist[e.to] = alt;
        prev[e.to] = u;
      }
    }
  }
  if ((dist[to] ?? Infinity) === Infinity) return null;
  const ids: string[] = [];
  let cur: string | undefined = to;
  while (cur) {
    ids.push(cur);
    if (cur === from) break;
    cur = prev[cur];
  }
  ids.reverse();
  if (ids[0] !== from) return null;
  return ids;
}

export function seaRoute(from: string, to: string): { path: Pt[]; nm: number } {
  if (from === to) return { path: [quayPoint(from)], nm: 0 };
  const key = `${from}>${to}`;
  const hit = CACHE[key];
  if (hit) return hit;
  const ids = dijkstraIds(from, to);
  let nodes: Pt[];
  if (!ids) {
    const a = NODES[from] ?? { lon: 0, lat: 0 };
    const b = NODES[to] ?? { lon: 0, lat: 0 };
    nodes = [a, b];
  } else {
    nodes = ids.map((id) => NODES[id]!).filter(Boolean);
    if (PORT_IDS.has(from) && nodes[0]) nodes[0] = quayPoint(from);
    if (PORT_IDS.has(to) && nodes.length) nodes[nodes.length - 1] = quayPoint(to);
  }
  const path = followWater(nodes);
  const { total } = pathLengths(path);
  const result = { path, nm: Math.max(1, total) };
  CACHE[key] = result;
  return result;
}

export function pathLengths(path: Pt[]): { segs: number[]; total: number } {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.max(0, haversineNm(path[i]!, path[i + 1]!));
    segs.push(d);
    total += d;
  }
  return { segs, total };
}

/** Sit on a long seaway hop, then ease to the next — skip dwell on short coastal vias. */
export const HOP_DWELL = 0.4;

export type Hop = {
  i: number;
  n: number;
  u: number;
  e: number;
  moving: boolean;
  from: Pt;
  to: Pt;
};

function hopDwell(segNm: number): number {
  if (segNm > 90) return HOP_DWELL;
  if (segNm > 28) return 0.12;
  return 0;
}

export function hopProgress(path: Pt[], travelled: number, nm: number): Hop {
  const fallback = path[0] ?? { lon: 0, lat: 0 };
  const last = path[path.length - 1] ?? fallback;
  if (path.length < 2) {
    return { i: 0, n: 1, u: 1, e: 1, moving: false, from: last, to: last };
  }
  const { segs, total } = pathLengths(path);
  const budget = nm > 0 ? nm : total;
  const t = budget <= 0 ? 1 : Math.min(1, Math.max(0, travelled / budget));
  if (t >= 1 || total <= 0) {
    return {
      i: Math.max(0, segs.length - 1),
      n: segs.length,
      u: 1,
      e: 1,
      moving: false,
      from: last,
      to: last,
    };
  }
  let remain = t * total;
  for (let i = 0; i < segs.length; i++) {
    const d = segs[i]!;
    const lastSeg = i === segs.length - 1;
    if (remain <= d || lastSeg) {
      const u = d <= 0 ? 1 : Math.min(1, Math.max(0, remain / d));
      const dwell = hopDwell(d);
      const e =
        dwell <= 0
          ? u
          : u < dwell
            ? 0
            : easeInOutCubic((u - dwell) / (1 - dwell));
      const from = path[i]!;
      const to = path[i + 1] ?? path[i]!;
      return {
        i,
        n: segs.length,
        u,
        e,
        moving: e > 0.02 && e < 0.98,
        from,
        to,
      };
    }
    remain -= d;
  }
  return { i: segs.length - 1, n: segs.length, u: 1, e: 1, moving: false, from: last, to: last };
}

export function pointOnPathStepped(path: Pt[], travelled: number, nm: number): Pt {
  if (path.length === 0) return { lon: 0, lat: 0 };
  if (path.length === 1) return path[0]!;
  const budget = nm > 0 ? nm : pathLengths(path).total;
  const t = budget <= 0 ? 1 : travelled / budget;
  if (t <= 0) return path[0]!;
  if (t >= 1) return path[path.length - 1]!;
  const hop = hopProgress(path, travelled, nm);
  return lerpLonLat(hop.from, hop.to, hop.e);
}

function easeInOutCubic(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function pointOnPath(path: Pt[], t: number): Pt {
  if (path.length === 0) return { lon: 0, lat: 0 };
  if (path.length === 1 || t <= 0) return path[0]!;
  if (t >= 1) return path[path.length - 1]!;
  const { segs, total } = pathLengths(path);
  let remain = Math.min(1, Math.max(0, t)) * (total || 1);
  for (let i = 0; i < segs.length; i++) {
    const d = segs[i]!;
    if (remain <= d || i === segs.length - 1) {
      const u = d <= 0 ? 1 : Math.min(1, Math.max(0, remain / d));
      return lerpLonLat(path[i]!, path[i + 1] ?? path[i]!, u);
    }
    remain -= d;
  }
  return path[path.length - 1]!;
}

function nearestOpenNeighbor(id: string, p: Pt): Pt {
  const edges = GRAPH[id] ?? [];
  let best: Pt | null = null;
  let bestScore = Infinity;
  for (const e of edges) {
    const n = WATER_NODE[e.to] ?? NODES[e.to];
    if (!n) continue;
    const d = haversineNm(p, n);
    const open = !PORT_IDS.has(e.to);
    const score = d - (open ? 25 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  if (best) return best;
  return { lon: p.lon, lat: Math.min(71, p.lat + 0.25) };
}

/** Berth / anchorage in water just off a port, used as the voyage end point. */
export function quayPoint(portId: string): Pt {
  const p = NODES[portId] ?? { lon: 0, lat: 0 };
  return seekWater(p, nearestOpenNeighbor(portId, p), 0.85);
}

function corridorKey(a: Pt, b: Pt): string {
  return `${a.lon.toFixed(3)},${a.lat.toFixed(3)}>${b.lon.toFixed(3)},${b.lat.toFixed(3)}`;
}

const LAND_MEMO = new Map<number, boolean>();
function landCell(lon: number, lat: number): boolean {
  const i = Math.round(lon * 40);
  const j = Math.round(lat * 40);
  const k = i * 100000 + j;
  const hit = LAND_MEMO.get(k);
  if (hit !== undefined) return hit;
  const v = isLand(i / 40, j / 40);
  LAND_MEMO.set(k, v);
  return v;
}

type HeapItem = { f: number; g: number; i: number; j: number };

function heapPush(h: HeapItem[], x: HeapItem) {
  h.push(x);
  let k = h.length - 1;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (h[p]!.f <= h[k]!.f) break;
    const tmp = h[p]!;
    h[p] = h[k]!;
    h[k] = tmp;
    k = p;
  }
}

function heapPop(h: HeapItem[]): HeapItem | undefined {
  const n = h.length;
  if (n === 0) return;
  const top = h[0]!;
  const last = h.pop()!;
  if (n > 1) {
    h[0] = last;
    let k = 0;
    for (;;) {
      let m = k;
      const l = k * 2 + 1;
      const r = l + 1;
      if (l < h.length && h[l]!.f < h[m]!.f) m = l;
      if (r < h.length && h[r]!.f < h[m]!.f) m = r;
      if (m === k) break;
      const tmp = h[k]!;
      h[k] = h[m]!;
      h[m] = tmp;
      k = m;
    }
  }
  return top;
}

function cellPt(i: number, j: number, step: number): Pt {
  return { lon: wrapLon(i * step), lat: j * step };
}

function nearestWaterCell(p: Pt, step: number, west: number, east: number, south: number, north: number): { i: number; j: number } | null {
  const si = Math.round(p.lon / step);
  const sj = Math.round(p.lat / step);
  const reach = Math.max(3, Math.ceil(1.1 / step));
  let best: { i: number; j: number } | null = null;
  let bestD = Infinity;
  for (let di = -reach; di <= reach; di++) {
    for (let dj = -reach; dj <= reach; dj++) {
      const i = si + di;
      const j = sj + dj;
      const q = cellPt(i, j, step);
      if (q.lat < south || q.lat > north) continue;
      if (q.lon < west - 0.2 || q.lon > east + 0.2) continue;
      if (landCell(q.lon, q.lat)) continue;
      const d = haversineNm(p, q) + (di === 0 && dj === 0 ? 0 : 8);
      if (d < bestD) {
        bestD = d;
        best = { i, j };
      }
    }
  }
  return best;
}

function simplifyWater(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [pts[0]!];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && segmentHitsLand(pts[i]!, pts[j]!, 16)) j--;
    out.push(pts[j]!);
    i = j;
  }
  return out;
}

/** Local 8-connected A* on water. Tight bbox so we hug the coast instead of the mid-Atlantic. */
function waterAstar(a: Pt, b: Pt): Pt[] | null {
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  if (Math.abs(dLon) > 150) return [a, b];
  const nm = haversineNm(a, b);
  if (nm < 8) return segmentHitsLand(a, b, 12) ? null : [a, b];
  const step = nm < 90 ? 0.08 : nm < 350 ? 0.1 : 0.14;
  const pad = Math.min(5.5, Math.max(1.35, nm / 60 * 0.22 + 1.25));
  const west = Math.min(a.lon, b.lon) - pad;
  const east = Math.max(a.lon, b.lon) + pad;
  const south = Math.max(-47, Math.min(a.lat, b.lat) - pad);
  const north = Math.min(71, Math.max(a.lat, b.lat) + pad);
  const start = nearestWaterCell(a, step, west, east, south, north);
  const goal = nearestWaterCell(b, step, west, east, south, north);
  if (!start || !goal) return null;
  if (start.i === goal.i && start.j === goal.j) {
    const mid = cellPt(start.i, start.j, step);
    const pts = [a, mid, b].filter((p, idx, arr) => idx === 0 || p.lon !== arr[idx - 1]!.lon || p.lat !== arr[idx - 1]!.lat);
    return segmentHitsLand(a, b, 14) ? simplifyWater(pts) : [a, b];
  }
  const keyOf = (i: number, j: number) => `${i},${j}`;
  const startK = keyOf(start.i, start.j);
  const goalK = keyOf(goal.i, goal.j);
  const gScore = new Map<string, number>([[startK, 0]]);
  const parent = new Map<string, string>();
  const open: HeapItem[] = [];
  const h0 = haversineNm(cellPt(start.i, start.j, step), cellPt(goal.i, goal.j, step));
  heapPush(open, { f: h0, g: 0, i: start.i, j: start.j });
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  let expansions = 0;
  const maxExp = nm < 200 ? 9000 : 16000;
  while (open.length && expansions < maxExp) {
    const cur = heapPop(open);
    if (!cur) break;
    const ck = keyOf(cur.i, cur.j);
    const known = gScore.get(ck);
    if (known != null && cur.g > known + 0.01) continue;
    expansions++;
    if (ck === goalK) {
      const cells: Pt[] = [];
      let k: string | undefined = ck;
      while (k !== undefined) {
        const [is, js] = k.split(",");
        cells.push(cellPt(Number(is), Number(js), step));
        k = parent.get(k);
      }
      cells.reverse();
      const raw = [a, ...cells, b];
      return simplifyWater(raw);
    }
    const from = cellPt(cur.i, cur.j, step);
    for (const [di, dj] of dirs) {
      const ni = cur.i + di;
      const nj = cur.j + dj;
      const to = cellPt(ni, nj, step);
      if (to.lat < south || to.lat > north) continue;
      if (to.lon < west || to.lon > east) continue;
      if (landCell(to.lon, to.lat)) continue;
      const mid = lerpLonLat(from, to, 0.5);
      if (landCell(mid.lon, mid.lat)) continue;
      const nk = keyOf(ni, nj);
      const stepNm = Math.hypot(di, dj) * step * 60;
      const g = cur.g + stepNm;
      const prevG = gScore.get(nk);
      if (prevG != null && g >= prevG - 0.01) continue;
      gScore.set(nk, g);
      parent.set(nk, ck);
      const h = haversineNm(to, cellPt(goal.i, goal.j, step));
      heapPush(open, { f: g + h, g, i: ni, j: nj });
    }
  }
  return null;
}

function nearestNodeId(p: Pt): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [id, n] of Object.entries(NODES)) {
    if (id === "wrapE" || id === "wrapW") continue;
    const d = haversineNm(p, WATER_NODE[id] ?? n);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function graphDetour(a: Pt, b: Pt): Pt[] | null {
  const na = nearestNodeId(a);
  const nb = nearestNodeId(b);
  if (!na || !nb || na === nb) return null;
  const ids = dijkstraIds(na, nb);
  if (!ids || ids.length < 2) return null;
  const mid = ids.map((id) => WATER_NODE[id] ?? NODES[id]!).filter(Boolean);
  const chord = haversineNm(a, b);
  let via = 0;
  for (let i = 0; i < mid.length - 1; i++) via += haversineNm(mid[i]!, mid[i + 1]!);
  via += haversineNm(a, mid[0]!) + haversineNm(mid[mid.length - 1]!, b);
  if (via > Math.max(chord * 3.2, chord + 1800)) return null;
  return [a, ...mid, b];
}

function shortDetour(a: Pt, b: Pt): Pt[] | null {
  if (!segmentHitsLand(a, b, 18)) return [a, b];
  const chord = haversineNm(a, b);
  const mid = lerpLonLat(a, b, 0.5);
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dLat = b.lat - a.lat;
  const len = Math.hypot(dLon, dLat) || 1;
  const ux = dLat / len;
  const uy = -dLon / len;
  const cap = Math.min(2.8, Math.max(0.4, chord / 60 * 0.35));
  for (const deg of [0.2, 0.4, 0.7, 1.1, 1.6, cap]) {
    if (deg > cap + 0.01) break;
    for (const s of [1, -1] as const) {
      const c = { lon: wrapLon(mid.lon + ux * deg * s), lat: mid.lat + uy * deg * s };
      if (c.lat < -47 || c.lat > 71 || isLand(c.lon, c.lat)) continue;
      if (segmentHitsLand(a, c, 14) || segmentHitsLand(c, b, 14)) continue;
      if (haversineNm(a, c) + haversineNm(c, b) > chord * 1.7) continue;
      return [a, c, b];
    }
  }
  return null;
}

function seaCorridor(a: Pt, b: Pt, allowGraph = true): Pt[] {
  const key = `${corridorKey(a, b)}:${allowGraph ? "g" : "l"}`;
  const cached = WATER_CACHE.get(key);
  if (cached) return cached;
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  let pts: Pt[];
  if (Math.abs(dLon) > 150 || !segmentHitsLand(a, b, 22)) {
    pts = [a, b];
  } else {
    const local = shortDetour(a, b) ?? waterAstar(a, b);
    if (local) {
      pts = local;
    } else if (allowGraph) {
      const via = graphDetour(a, b);
      if (via && via.length > 2) {
        const stitched: Pt[] = [via[0]!];
        for (let i = 0; i < via.length - 1; i++) {
          const hop = seaCorridor(via[i]!, via[i + 1]!, false);
          for (let k = 1; k < hop.length; k++) stitched.push(hop[k]!);
        }
        pts = stitched;
      } else {
        pts = [a, b];
      }
    } else {
      pts = [a, b];
    }
  }
  WATER_CACHE.set(key, pts);
  return pts;
}

/** Rewalk a node path so every drawn/interpolated segment stays on water. */
export function followWater(path: Pt[]): Pt[] {
  if (path.length === 0) return path;
  if (path.length === 1) {
    const p = path[0]!;
    return isLand(p.lon, p.lat) ? [seekWater(p, { lon: p.lon, lat: p.lat + 0.4 }, 0.9)] : path;
  }
  const key = path.map(namedKey).join(">");
  const cached = WATER_CACHE.get(`P:${key}`);
  if (cached) return cached;
  const nudged = path.map((p) => (isLand(p.lon, p.lat) ? seekWater(p, { lon: p.lon, lat: p.lat + 0.2 }, 0.85) : p));
  const out: Pt[] = [nudged[0]!];
  for (let i = 0; i < nudged.length - 1; i++) {
    const via = seaCorridor(nudged[i]!, nudged[i + 1]!);
    for (let k = 1; k < via.length; k++) out.push(via[k]!);
  }
  WATER_CACHE.set(`P:${key}`, out);
  return out;
}
