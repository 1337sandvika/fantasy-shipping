import { LAND as RAW } from "./data/land";

export function haversineNm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const R = 3440.065;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  let dLon = toR(b.lon - a.lon);
  if (dLon > Math.PI) dLon -= Math.PI * 2;
  if (dLon < -Math.PI) dLon += Math.PI * 2;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export type LonLatBox = { west: number; east: number; south: number; north: number };

/** World equirectangular box. Pacific routes stay on-chart. */
export const VIEW: LonLatBox = { west: -168, east: 192, south: -48, north: 72 };
export const EUROPE: LonLatBox = { west: -12, east: 32, south: 34, north: 62 };

export function inEurope(lon: number, lat: number): boolean {
  return lon >= EUROPE.west && lon <= EUROPE.east && lat >= EUROPE.south && lat <= EUROPE.north;
}

export function project(lon: number, lat: number, w: number, h: number) {
  const x = ((lon - VIEW.west) / (VIEW.east - VIEW.west)) * w;
  const y = ((VIEW.north - lat) / (VIEW.north - VIEW.south)) * h;
  return { x, y };
}

export function frameBox(box: LonLatBox, w: number, h: number, pad = 0.9): { x: number; y: number; z: number } {
  const nw = project(box.west, box.north, w, h);
  const se = project(box.east, box.south, w, h);
  const x = (nw.x + se.x) / 2;
  const y = (nw.y + se.y) / 2;
  const dx = Math.max(32, Math.abs(se.x - nw.x));
  const dy = Math.max(32, Math.abs(se.y - nw.y));
  const z = Math.min(10, Math.max(1, Math.min((w * pad) / dx, (h * pad) / dy)));
  return { x, y, z };
}

export const VIEW_NM = Math.max(
  1,
  (VIEW.east - VIEW.west) * 60 * Math.cos((40 * Math.PI) / 180),
);

/** Natural Earth land, denser over Europe. */
export const LAND: { lon: number; lat: number }[][] = RAW.map((ring) =>
  ring.map(([lon, lat]) => ({ lon, lat })),
);

type RingBox = {
  pts: { lon: number; lat: number }[];
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

const RING_BOXES: RingBox[] = LAND.map((pts) => {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const p of pts) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return { pts, minLon, maxLon, minLat, maxLat };
});

function pointInRing(lon: number, lat: number, ring: { lon: number; lat: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const crosses = a.lat > lat !== b.lat > lat;
    if (!crosses) continue;
    const x = a.lon + ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat || 1e-12);
    if (lon < x) inside = !inside;
  }
  return inside;
}

/** True when the coordinate sits inside a Natural Earth land ring. */
export function isLand(lon: number, lat: number): boolean {
  for (const ring of RING_BOXES) {
    if (lon < ring.minLon || lon > ring.maxLon || lat < ring.minLat || lat > ring.maxLat) continue;
    if (pointInRing(lon, lat, ring.pts)) return true;
  }
  return false;
}

export function wrapLon(lon: number): number {
  let x = lon;
  if (x > 192) x -= 360;
  if (x < -168) x += 360;
  return x;
}

export function lerpLonLat(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
  e: number,
): { lon: number; lat: number } {
  const t = Math.max(0, Math.min(1, e));
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  return { lon: wrapLon(a.lon + dLon * t), lat: a.lat + (b.lat - a.lat) * t };
}

/** True if the drawn (equirectangular) segment crosses land. Dateline wraps are skipped. */
export function segmentHitsLand(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
  samples = 18,
): boolean {
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  if (Math.abs(dLon) > 150) return false;
  const n = Math.max(6, samples);
  for (let i = 1; i < n; i++) {
    const p = lerpLonLat(a, b, i / n);
    if (isLand(p.lon, p.lat)) return true;
  }
  return false;
}
