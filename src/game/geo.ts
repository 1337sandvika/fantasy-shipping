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
