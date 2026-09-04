import { useEffect, useRef } from "react";
import { PORTS } from "./data/ports";
import { EDGES, NODES } from "./data/seaways";
import { EUROPE, LAND, VIEW_NM, frameBox, project } from "./geo";
import { hopProgress, pointOnPath, seaRoute } from "./route";
import { activeShip, destSummary, shipLeg, shipWorldPos } from "./fleet";
import { useGame } from "./store";
import { countryName, t } from "@/i18n";
import { qty } from "./format";
import type { Ship, Voyage } from "./types";

let shipImg: HTMLImageElement | null = null;
function getShipImg(): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (!shipImg) {
    shipImg = new Image();
    shipImg.crossOrigin = "anonymous";
    shipImg.src = "/game/ship-top.png?v=3";
  }
  return shipImg;
}

let landPath: Path2D | null = null;
let landKey = "";
function getLandPath(w: number, h: number): Path2D {
  const k = `${w}x${h}`;
  if (landPath && landKey === k) return landPath;
  const p = new Path2D();
  for (const ring of LAND) {
    ring.forEach((pt, i) => {
      const { x, y } = project(pt.lon, pt.lat, w, h);
      if (i === 0) p.moveTo(x, y);
      else if (Math.abs(pt.lon - ring[i - 1]!.lon) > 150) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
    p.closePath();
  }
  landPath = p;
  landKey = k;
  return p;
}

type Cam = { x: number; y: number; z: number; ready: boolean };

function vp(lon: number, lat: number, w: number, h: number, cam: Cam) {
  const p = project(lon, lat, w, h);
  return { x: (p.x - cam.x) * cam.z + w / 2, y: (p.y - cam.y) * cam.z + h / 2 };
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  pts: { lon: number; lat: number }[],
  w: number,
  h: number,
) {
  pts.forEach((p, i) => {
    const { x, y } = project(p.lon, p.lat, w, h);
    if (i === 0) ctx.moveTo(x, y);
    else if (Math.abs(p.lon - pts[i - 1]!.lon) > 150) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function frameHop(
  a: { x: number; y: number },
  b: { x: number; y: number },
  w: number,
  h: number,
): { x: number; y: number; z: number } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = Math.max(36, Math.abs(b.x - a.x));
  const dy = Math.max(36, Math.abs(b.y - a.y));
  const z = Math.min(8.2, Math.max(2.4, Math.min((w * 0.5) / dx, (h * 0.5) / dy)));
  return { x: mx, y: my, z };
}

function canvasHeading(leg: Voyage, w: number, h: number): number {
  const hop = hopProgress(leg.path, leg.travelled, leg.nm);
  const A = project(hop.from.lon, hop.from.lat, w, h);
  const B = project(hop.to.lon, hop.to.lat, w, h);
  if (Math.abs(B.x - A.x) + Math.abs(B.y - A.y) < 0.5) {
    const prog = leg.nm <= 0 ? 1 : leg.travelled / leg.nm;
    const a = pointOnPath(leg.path, Math.max(0, prog - 0.02));
    const b = pointOnPath(leg.path, Math.min(1, prog + 0.02));
    const P = project(a.lon, a.lat, w, h);
    const Q = project(b.lon, b.lat, w, h);
    return Math.atan2(Q.y - P.y, Q.x - P.x);
  }
  return Math.atan2(B.y - A.y, B.x - A.x);
}

function drawHull(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  active: boolean,
  atSea: boolean,
  zoom: number,
) {
  const img = getShipImg();
  const aspect = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.28;
  const L = Math.max(10, (active ? 12 : 9) + Math.min(zoom, 8) * 3.1);
  const Ht = L * aspect;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (atSea) {
    ctx.fillStyle = active ? "rgba(232,93,4,0.32)" : "rgba(237,230,217,0.18)";
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-L / 2 - i * (5 + zoom), 0, 3 + i * 1.1, 1.6 + i * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, -L / 2, -Ht / 2, L, Ht);
  } else {
    ctx.fillStyle = active ? "#f3ece2" : "#d9d0c2";
    ctx.beginPath();
    ctx.moveTo(L / 2, 0);
    ctx.lineTo(L / 2 - L * 0.12, -Ht / 2);
    ctx.lineTo(-L / 2 + 4, -Ht / 2);
    ctx.lineTo(-L / 2, -Ht / 5);
    ctx.lineTo(-L / 2, Ht / 5);
    ctx.lineTo(-L / 2 + 4, Ht / 2);
    ctx.lineTo(L / 2 - L * 0.12, Ht / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e85d04";
    ctx.fillRect(-L / 2 + 8, -Ht * 0.18, L * 0.58, Ht * 0.36);
    ctx.fillStyle = "#24323e";
    ctx.fillRect(-L / 2 + 2, -Ht * 0.3, L * 0.2, Ht * 0.6);
  }
  ctx.restore();
  if (active) {
    ctx.strokeStyle = "rgba(232,93,4,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, L * 0.42 + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

type DrawnShip = { id: string; x: number; y: number; r: number };

function layoutShips(fleet: Ship[], legs: Voyage[], w: number, h: number, cam: Cam): DrawnShip[] {
  const portIndex: Record<string, number> = {};
  const out: DrawnShip[] = [];
  for (const sh of fleet) {
    const leg = legs.find((v) => v.shipId === sh.id) ?? null;
    const world = shipWorldPos(sh, leg);
    let { x, y } = vp(world.lon, world.lat, w, h, cam);
    if (!sh.atSea) {
      const n = portIndex[sh.port] ?? 0;
      portIndex[sh.port] = n + 1;
      const ang = -0.9 + n * 0.7;
      const off = 10 + cam.z * 4;
      x += Math.cos(ang) * off;
      y += Math.sin(ang) * off;
    }
    out.push({ id: sh.id, x, y, r: 16 + cam.z * 6 });
  }
  return out;
}

export function MapCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const selected = useGame((s) => s.state.selectedPort);
  const selectPort = useGame((s) => s.selectPort);
  const setTab = useGame((s) => s.setTab);
  const switchShip = useGame((s) => s.switchShip);
  const drawn = useRef<DrawnShip[]>([]);
  const cam = useRef<Cam>({ x: 0, y: 0, z: 1, ready: false });
  const hopCam = useRef<{ x: number; y: number; z: number; key: string } | null>(null);
  const lastId = useRef<string | null>(null);
  const lastView = useRef("");

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const parent = c.parentElement;
    if (!parent) return;
    let raf = 0;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w < 8 || h < 8) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const st = useGame.getState().state;
      const ui = useGame.getState().ui;
      const selected = st.selectedPort;
      const ship = activeShip(st);
      const dests = ship ? destSummary(ship.hold) : [];
      const destCeu = new Map(dests.map((d) => [d.dest, d.ceu]));
      const destIds = new Set(dests.map((d) => d.dest));

      const sea = ctx.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, "#08151f");
      sea.addColorStop(0.45, "#0e2436");
      sea.addColorStop(1, "#143044");
      ctx.fillStyle = sea;
      ctx.fillRect(0, 0, w, h);

      const world = ship ? shipWorldPos(ship, shipLeg(st, ship.id)) : null;
      const activeLeg = ship ? shipLeg(st, ship.id) : null;
      const hop = activeLeg ? hopProgress(activeLeg.path, activeLeg.travelled, activeLeg.nm) : null;
      let want = frameBox(EUROPE, w, h);
      if (ui.follow && ship && world) {
        const focus = project(world.lon, world.lat, w, h);
        if (ship.atSea && hop) {
          const A = project(hop.from.lon, hop.from.lat, w, h);
          const B = project(hop.to.lon, hop.to.lat, w, h);
          const framed = frameHop(A, B, w, h);
          const key = `${st.activeId}-${hop.i}`;
          if (hop.moving) {
            if (!hopCam.current || hopCam.current.key !== key) hopCam.current = { ...framed, key };
            want = { x: hopCam.current.x, y: hopCam.current.y, z: hopCam.current.z };
          } else {
            hopCam.current = null;
            want = framed;
          }
        } else {
          hopCam.current = null;
          want = { x: focus.x, y: focus.y, z: 7.1 };
        }
      } else {
        hopCam.current = null;
        want = ui.atlas === "world" ? { x: w / 2, y: h / 2, z: 1 } : frameBox(EUROPE, w, h);
      }
      const snap = lastId.current !== st.activeId;
      lastId.current = st.activeId;
      const viewKey = ui.follow ? "follow" : ui.atlas;
      const viewChanged = lastView.current !== viewKey;
      lastView.current = viewKey;
      if (!cam.current.ready || viewChanged) {
        cam.current = { ...want, ready: true };
      } else {
        const moving = Boolean(ship?.atSea && hop?.moving && ui.follow);
        const k = snap ? 0.45 : moving ? 0 : 0.14;
        if (k > 0) {
          cam.current.x += (want.x - cam.current.x) * k;
          cam.current.y += (want.y - cam.current.y) * k;
          cam.current.z += (want.z - cam.current.z) * k;
        }
      }
      const camNow = cam.current;
      const lw = 1 / camNow.z;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(camNow.z, camNow.z);
      ctx.translate(-camNow.x, -camNow.y);

      ctx.strokeStyle = "rgba(237,230,217,0.055)";
      ctx.lineWidth = lw;
      const step = camNow.z > 5 ? 10 : camNow.z > 2.2 ? 20 : 30;
      for (let lon = -150; lon <= 180; lon += step) {
        const { x } = project(lon, 40, w, h);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let lat = -40; lat <= 70; lat += step) {
        const { y } = project(0, lat, w, h);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(141,163,181,0.22)";
      ctx.lineWidth = 1.1 * lw;
      ctx.setLineDash([4 * lw, 7 * lw]);
      for (const [a, b] of EDGES) {
        const pa = NODES[a];
        const pb = NODES[b];
        if (!pa || !pb) continue;
        if (Math.abs(pa.lon - pb.lon) > 150) continue;
        ctx.beginPath();
        const A = project(pa.lon, pa.lat, w, h);
        const B = project(pb.lon, pb.lat, w, h);
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const land = getLandPath(w, h);
      ctx.fillStyle = "#3a4942";
      ctx.fill(land);
      ctx.strokeStyle = "#1c2824";
      ctx.lineWidth = 2.2 * lw;
      ctx.stroke(land);
      ctx.strokeStyle = "rgba(196,181,160,0.35)";
      ctx.lineWidth = 0.8 * lw;
      ctx.stroke(land);

      if (ship && !ship.atSea) {
        const previewTo =
          selected !== ship.port ? selected : dests[0] && dests[0].dest !== ship.port ? dests[0].dest : null;
        if (previewTo) {
          const preview = seaRoute(ship.port, previewTo);
          if (preview.path.length > 1) {
            ctx.strokeStyle = "rgba(232,93,4,0.55)";
            ctx.lineWidth = 2.2 * lw;
            ctx.setLineDash([6 * lw, 5 * lw]);
            ctx.beginPath();
            drawPolyline(ctx, preview.path, w, h);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      for (const leg of st.legs) {
        const on = leg.shipId === st.activeId;
        const hopNow = hopProgress(leg.path, leg.travelled, leg.nm);
        ctx.strokeStyle = on ? "rgba(232,93,4,0.32)" : "rgba(237,230,217,0.2)";
        ctx.lineWidth = (on ? 2.4 : 1.6) * lw;
        ctx.setLineDash([5 * lw, 6 * lw]);
        ctx.beginPath();
        drawPolyline(ctx, leg.path, w, h);
        ctx.stroke();
        ctx.setLineDash([]);
        if (hopNow.i > 0 || hopNow.e > 0) {
          const done = leg.path.slice(0, hopNow.i + 1);
          ctx.strokeStyle = on ? "rgba(232,93,4,0.95)" : "rgba(196,181,160,0.7)";
          ctx.lineWidth = (on ? 3.4 : 2) * lw;
          ctx.lineJoin = "round";
          ctx.beginPath();
          drawPolyline(ctx, done, w, h);
          ctx.stroke();
        }
        const A = project(hopNow.from.lon, hopNow.from.lat, w, h);
        const B = project(hopNow.to.lon, hopNow.to.lat, w, h);
        ctx.strokeStyle = on ? "#e85d04" : "rgba(232,93,4,0.55)";
        ctx.lineWidth = (on ? 4.6 : 2.6) * lw;
        ctx.lineCap = "round";
        ctx.setLineDash([7 * lw, 5 * lw]);
        ctx.lineDashOffset = -hopNow.e * 22 * lw;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(A.x + (B.x - A.x) * Math.max(0.08, hopNow.e), A.y + (B.y - A.y) * Math.max(0.08, hopNow.e));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 180);
        for (let i = 0; i < leg.path.length; i++) {
          const pt = project(leg.path[i]!.lon, leg.path[i]!.lat, w, h);
          const passed = i < hopNow.i || (i === hopNow.i && hopNow.e > 0.02);
          const current = i === hopNow.i;
          const next = i === hopNow.i + 1;
          ctx.beginPath();
          ctx.fillStyle = next ? "#e85d04" : passed ? "#e85d04" : "rgba(237,230,217,0.4)";
          const r = (next ? 5.2 * pulse : current ? 4.6 : passed ? 3.2 : 2.2) * lw;
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
          if (next) {
            ctx.strokeStyle = "rgba(232,93,4,0.85)";
            ctx.lineWidth = 1.6 * lw;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 8 * lw * pulse, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      for (const p of PORTS) {
        const pt = project(p.lon, p.lat, w, h);
        const on = p.id === selected;
        const cargo = destIds.has(p.id);
        const lngMark = Boolean(ship?.fuel === "lng" && p.lng);
        ctx.beginPath();
        ctx.fillStyle = on ? "#e85d04" : cargo ? "#c4a574" : lngMark ? "#7d9b76" : "#ede6d9";
        ctx.arc(pt.x, pt.y, (on ? 5.5 : cargo ? 5.2 : lngMark ? 4.8 : p.hub ? 4.2 : 3.4) * lw, 0, Math.PI * 2);
        ctx.fill();
        if (on || cargo || lngMark) {
          ctx.strokeStyle = on ? "rgba(232,93,4,0.7)" : cargo ? "rgba(196,165,116,0.85)" : "rgba(125,155,118,0.9)";
          ctx.lineWidth = 1.4 * lw;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 9 * lw, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();

      const placed: { x: number; y: number; w: number }[] = [];
      const ordered = [...PORTS].sort((p, q) => {
        const lngBoost = (x: (typeof PORTS)[number]) => (ship?.fuel === "lng" && x.lng ? 1 : 0);
        const ps = (p.id === selected ? 3 : 0) + (destIds.has(p.id) ? 2 : 0) + (p.hub ? 1 : 0) + lngBoost(p);
        const qs = (q.id === selected ? 3 : 0) + (destIds.has(q.id) ? 2 : 0) + (q.hub ? 1 : 0) + lngBoost(q);
        return qs - ps;
      });
      for (const p of ordered) {
        const on = p.id === selected;
        const cargo = destIds.has(p.id);
        const lngMark = Boolean(ship?.fuel === "lng" && p.lng);
        const show = on || cargo || p.hub || camNow.z > 4.8 || lngMark;
        if (!show) continue;
        const pt = vp(p.lon, p.lat, w, h, camNow);
        if (pt.x < -40 || pt.x > w + 40 || pt.y < -20 || pt.y > h + 20) continue;
        const ceuHere = destCeu.get(p.id);
        const label =
          ceuHere != null ? `${p.name} · ${qty(ceuHere)} CEU` : lngMark ? `${p.name} · LNG` : p.name;
        ctx.font = `${on ? 13 : 11}px "IBM Plex Sans", sans-serif`;
        const tw = ctx.measureText(label).width;
        let lx = pt.x + 8;
        let ly = pt.y + 4;
        for (let k = 0; k < 6; k++) {
          let hit = false;
          for (const q of placed) {
            if (Math.abs(lx - q.x) < (tw + q.w) / 2 + 6 && Math.abs(ly - q.y) < 12) {
              ly += 11;
              lx += 4;
              hit = true;
              break;
            }
          }
          if (!hit) break;
        }
        ctx.fillStyle = on ? "#ede6d9" : cargo ? "#c4a574" : lngMark ? "#a8c4a2" : "rgba(237,230,217,0.88)";
        ctx.fillText(label, lx, ly);
        placed.push({ x: lx + tw / 2, y: ly, w: tw });
      }

      const marks = layoutShips(st.fleet, st.legs, w, h, camNow);
      drawn.current = marks;
      for (const sh of st.fleet) {
        const mark = marks.find((m) => m.id === sh.id);
        if (!mark) continue;
        const leg = shipLeg(st, sh.id);
        const rot = leg ? canvasHeading(leg, w, h) : -0.35;
        drawHull(ctx, mark.x, mark.y, rot, sh.id === st.activeId, sh.atSea, camNow.z);
        ctx.font = '11px "IBM Plex Sans", sans-serif';
        const name = `M/V ${sh.name}`;
        const destLine = (() => {
          const cargo = destSummary(sh.hold)[0];
          if (cargo) return `→ ${PORTS.find((p) => p.id === cargo.dest)?.name ?? cargo.dest}`;
          if (leg) return `→ ${PORTS.find((p) => p.id === leg.to)?.name ?? leg.to}`;
          return "";
        })();
        const nw = Math.max(ctx.measureText(name).width, destLine ? ctx.measureText(destLine).width : 0);
        const boxH = destLine ? 28 : 16;
        ctx.fillStyle = "rgba(7,16,24,0.78)";
        ctx.fillRect(mark.x + 10, mark.y - 22, nw + 8, boxH);
        ctx.fillStyle = sh.id === st.activeId ? "#ede6d9" : "rgba(237,230,217,0.85)";
        ctx.fillText(name, mark.x + 14, mark.y - 10);
        if (destLine) {
          ctx.fillStyle = "#e85d04";
          ctx.fillText(destLine, mark.x + 14, mark.y + 3);
        }
        if (leg && sh.id === st.activeId) {
          const hp = hopProgress(leg.path, leg.travelled, leg.nm);
          const step = `${hp.i + 1}/${hp.n}`;
          ctx.fillStyle = "rgba(7,16,24,0.72)";
          ctx.font = '10px "IBM Plex Sans", sans-serif';
          const sw = ctx.measureText(step).width;
          ctx.fillRect(mark.x - sw / 2 - 4, mark.y + 16, sw + 8, 14);
          ctx.fillStyle = "#e85d04";
          ctx.fillText(step, mark.x - sw / 2, mark.y + 26);
        }
      }

      ctx.fillStyle = "rgba(237,230,217,0.45)";
      ctx.font = '10px "IBM Plex Sans", sans-serif';
      const barNm = camNow.z > 6 ? 200 : camNow.z > 3 ? 500 : camNow.z > 1.6 ? 1500 : 4000;
      const barPx = (barNm / VIEW_NM) * w * camNow.z;
      const bx = Math.max(12, w - 16 - Math.max(24, barPx));
      const by = h - 16;
      ctx.fillRect(bx, by, Math.max(24, barPx), 2);
      ctx.fillText(`${barNm} nm`, bx, by - 4);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const phase = useGame.getState().state.phase;
    if (phase === "event" || phase === "title" || phase === "end") return;
    const c = ref.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let bestShip: { id: string; d: number } | null = null;
    for (const m of drawn.current) {
      const d = (m.x - x) ** 2 + (m.y - y) ** 2;
      if (d < m.r * m.r && (!bestShip || d < bestShip.d)) bestShip = { id: m.id, d };
    }
    if (bestShip) {
      switchShip(bestShip.id);
      return;
    }
    const w = r.width;
    const h = r.height;
    const camNow = cam.current;
    const wx = (x - w / 2) / camNow.z + camNow.x;
    const wy = (y - h / 2) / camNow.z + camNow.y;
    let best: { id: string; d: number } | null = null;
    for (const p of PORTS) {
      const pt = project(p.lon, p.lat, w, h);
      const d = (pt.x - wx) ** 2 + (pt.y - wy) ** 2;
      if (!best || d < best.d) best = { id: p.id, d };
    }
    const thresh = (26 / camNow.z) ** 2;
    if (best && best.d < thresh) {
      selectPort(best.id);
      setTab("cargo");
    }
  }

  const here = PORTS.find((p) => p.id === selected);

  return (
    <div className="absolute inset-0">
      <canvas
        ref={ref}
        className="h-full w-full touch-none"
        onClick={onClick}
        aria-label={here ? `${here.name}, ${countryName(here.country)}` : t("brand.game")}
      />
    </div>
  );
}
