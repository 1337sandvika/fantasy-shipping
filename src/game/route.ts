import { EDGES, NODES } from "./data/seaways";
import { haversineNm } from "./geo";

type Pt = { lon: number; lat: number };

const GRAPH: Record<string, { to: string; nm: number }[]> = {};
for (const [a, b] of EDGES) {
  const pa = NODES[a];
  const pb = NODES[b];
  if (!pa || !pb) continue;
  const nm = Math.max(1, haversineNm(pa, pb));
  (GRAPH[a] ??= []).push({ to: b, nm });
  (GRAPH[b] ??= []).push({ to: a, nm });
}

const CACHE: Record<string, { path: Pt[]; nm: number }> = {};

function unwrapLerp(a: Pt, b: Pt, e: number): Pt {
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  let lon = a.lon + dLon * e;
  if (lon > 192) lon -= 360;
  if (lon < -168) lon += 360;
  return { lon, lat: a.lat + (b.lat - a.lat) * e };
}

export function seaRoute(from: string, to: string): { path: Pt[]; nm: number } {
  if (from === to) return { path: [NODES[from] ?? { lon: 0, lat: 0 }], nm: 0 };
  const key = `${from}>${to}`;
  const hit = CACHE[key];
  if (hit) return hit;
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
  const ids: string[] = [];
  let cur: string | undefined = to;
  while (cur) {
    ids.push(cur);
    if (cur === from) break;
    cur = prev[cur];
  }
  ids.reverse();
  let result: { path: Pt[]; nm: number };
  if (ids[0] !== from) {
    const a = NODES[from] ?? { lon: 0, lat: 0 };
    const b = NODES[to] ?? { lon: 0, lat: 0 };
    result = { path: [a, b], nm: Math.max(1, haversineNm(a, b)) };
  } else {
    const path = ids.map((id) => NODES[id]!).filter(Boolean);
    result = { path, nm: dist[to] ?? 0 };
  }
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

/** Sit on a seaway node, then ease to the next — readable hops, not a smear. */
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

export function hopProgress(path: Pt[], travelled: number, nm: number): Hop {
  const fallback = path[0] ?? { lon: 0, lat: 0 };
  if (path.length < 2) {
    return { i: 0, n: 1, u: 1, e: 1, moving: false, from: fallback, to: fallback };
  }
  const { segs, total } = pathLengths(path);
  const dist = nm > 0 ? nm : total;
  let remain = Math.min(Math.max(0, travelled), dist);
  for (let i = 0; i < segs.length; i++) {
    const d = segs[i]!;
    if (remain <= d || i === segs.length - 1) {
      const u = d <= 0 ? 1 : Math.min(1, remain / d);
      const e = u < HOP_DWELL ? 0 : easeInOutCubic((u - HOP_DWELL) / (1 - HOP_DWELL));
      return {
        i,
        n: segs.length,
        u,
        e,
        moving: e > 0.02 && e < 0.98,
        from: path[i]!,
        to: path[i + 1] ?? path[i]!,
      };
    }
    remain -= d;
  }
  const last = path[path.length - 1]!;
  return { i: segs.length, n: segs.length, u: 1, e: 1, moving: false, from: last, to: last };
}

export function pointOnPathStepped(path: Pt[], travelled: number, nm: number): Pt {
  if (path.length === 0) return { lon: 0, lat: 0 };
  if (path.length === 1 || travelled <= 0) return path[0]!;
  const hop = hopProgress(path, travelled, nm);
  return unwrapLerp(hop.from, hop.to, hop.e);
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
  let remain = t * (total || 1);
  for (let i = 0; i < segs.length; i++) {
    const d = segs[i]!;
    if (remain <= d || i === segs.length - 1) {
      const u = d <= 0 ? 1 : remain / d;
      return unwrapLerp(path[i]!, path[i + 1] ?? path[i]!, u);
    }
    remain -= d;
  }
  return path[path.length - 1]!;
}
