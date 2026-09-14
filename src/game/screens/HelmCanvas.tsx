// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { actionsFromKeys, goalOf, helmWon, makeHarbor, spawnCraft, stepCraft } from "../helm";

const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
const SHIP_IMG = "https://palm-river-olive-field.grok.me/game/helm/ship-top.png";
const BOAT_IMG = "https://palm-river-olive-field.grok.me/game/helm/workboat.png";
const SINK_IMG = "https://palm-river-olive-field.grok.me/game/helm/sink.jpg";
const WATER = ["#2a7480", "#1f5f6a", "#2d6e78"];
const LAND = ["#4a7a3e", "#3e6b48", "#5a6a42", "#4a5a3a"];
const ROOF = ["#c45c6a", "#d4a84b", "#4f8a9c", "#7a5c48", "#8b8b78", "#4f7a62", "#9a6b4a", "#6a6a8a"];
const CARS = ["#c43c3c", "#3c5cac", "#d4c43c", "#222220", "#e8e8e4", "#3c8a4c"];
const QUAY = "#8a8a7c";
const ROAD = "#3f3f3c";
const INK = "#141410";

export function HelmCanvas({ helmKind, portId, ship, onWin, onCrash, onHire }) {
  const canvasRef = useRef(null);
  const t = useT();
  const keys = useRef(new Set());
  const probeSteer = useRef(null);
  const levers = useRef({ throttle: 0, steer: 0 });
  const craftRef = useRef(null);
  const harborRef = useRef(null);
  const done = useRef(false);
  const winRef = useRef(onWin);
  const crashRef = useRef(onCrash);
  const imgs = useRef({ ship: null, boat: null });
  const [sinking, setSinking] = useState(false);
  const [hud, setHud] = useState({ speed: 0, heading: 0, throttle: 0, steer: 0, dist: 0, layout: "straight" });
  winRef.current = onWin;
  crashRef.current = onCrash;

  useEffect(() => {
    const a = new Image(); a.crossOrigin = "anonymous"; a.src = SHIP_IMG; a.onload = () => { imgs.current.ship = a; };
    const b = new Image(); b.crossOrigin = "anonymous"; b.src = BOAT_IMG; b.onload = () => { imgs.current.boat = b; };
  }, []);

  useEffect(() => {
    const harbor = makeHarbor(portId, ship);
    harborRef.current = harbor;
    craftRef.current = spawnCraft(helmKind, ship, harbor);
    done.current = false;
    levers.current = { throttle: 0, steer: 0 };
    setSinking(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const onKey = (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.type === "keydown") keys.current.add(e.code);
      else keys.current.delete(e.code);
    };
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    window.__controlsTest = {
      getYaw: () => craftRef.current?.heading ?? 0,
      getSpeed: () => craftRef.current?.speed ?? 0,
      setSteer: (v) => { probeSteer.current = v; },
      setKeys: (codes) => { keys.current = new Set(codes); probeSteer.current = null; },
    };
    let raf = 0, last = performance.now(), acc = 0;
    const step = 1 / 60;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now; acc += dt;
      if (!done.current && harborRef.current) {
        while (acc >= step) {
          acc -= step;
          const cur = craftRef.current;
          if (!cur) break;
          const fromKeys = actionsFromKeys(keys.current, probeSteer.current);
          const a = {
            throttle: fromKeys.throttle !== 0 ? fromKeys.throttle : levers.current.throttle,
            steer: fromKeys.steer !== 0 ? fromKeys.steer : levers.current.steer,
          };
          const out = stepCraft(cur, a, harborRef.current, step);
          craftRef.current = out.craft;
          if (out.harbor) harborRef.current = out.harbor;
          if (out.hit) {
            done.current = true;
            if (out.hit === "sink") setSinking(true);
            crashRef.current(out.hit);
            break;
          }
          if (helmWon(out.craft, helmKind, harborRef.current)) {
            done.current = true;
            winRef.current();
            break;
          }
        }
      } else acc = 0;
      fit(canvas);
      drawWorld(ctx, canvas, craftRef.current, harborRef.current, helmKind, ship.name, now / 1000, imgs.current);
      if (craftRef.current && harborRef.current && Math.floor(now / 200) !== Math.floor((now - dt * 1000) / 200)) {
        const g = goalOf(helmKind, harborRef.current);
        setHud({ speed: craftRef.current.speed, heading: craftRef.current.heading, throttle: levers.current.throttle, steer: levers.current.steer, dist: Math.hypot(craftRef.current.x - g.x, craftRef.current.y - g.y), layout: harborRef.current.layout });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    fit(canvas);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      delete window.__controlsTest;
    };
  }, [helmKind, portId, ship.ceu, ship.condition, ship.name]);

  if (sinking) {
    return (
      <div className="relative min-h-0 flex-1 overflow-hidden bg-bg">
        <img src={SINK_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <p className="absolute left-1/2 top-10 -translate-x-1/2 animate-pulse rounded-md border border-danger bg-danger/85 px-5 py-2 font-display text-lg tracking-[0.35em] text-fg">{t("helm.alarm")}</p>
        <p className="absolute bottom-8 left-0 right-0 text-center font-display text-xl text-fg">M/V {ship.name}</p>
      </div>
    );
  }

  const gears = [
    { v: -1, key: "helm.fullAstern" },
    { v: -0.45, key: "helm.astern" },
    { v: 0, key: "helm.stop" },
    { v: 0.45, key: "helm.ahead" },
    { v: 1, key: "helm.fullAhead" },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <canvas ref={canvasRef} className="min-h-0 w-full flex-1 touch-none" />
      {onHire ? (
        <div className="absolute right-2 top-2 z-10">
          <button type="button" className="rounded-md border border-border bg-bg-elevated/90 px-3 py-1.5 text-xs" onClick={onHire}>{t("helm.pilot")}</button>
        </div>
      ) : null}
      <div className="shrink-0 border-t border-border bg-bg-elevated/95 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.2em] text-accent">{t("helm.kicker")}</p>
            <p className="text-sm font-medium text-fg">{t(helmKind === "depart" ? "helm.taskDepart" : "helm.taskArrive")}</p>
            <p className="text-[11px] text-muted">{t("helm.layout." + hud.layout)} \u00b7 {t(helmKind === "depart" ? "helm.taskDepartHint" : "helm.taskArriveHint")}</p>
          </div>
          <p className="shrink-0 font-mono text-xs tabular-nums text-muted">{Math.round(hud.dist)} m \u00b7 {hud.speed.toFixed(1)} kn</p>
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-bg-elevated/95 px-3 py-2">
        <div className="flex items-center gap-1">
          {gears.map((g) => (
            <button key={g.key} type="button" onPointerDown={(e) => { e.preventDefault(); levers.current.throttle = g.v; setHud((h) => ({ ...h, throttle: g.v })); }}
              className={`min-h-10 min-w-0 flex-1 rounded-md border px-1 text-center text-[10px] sm:text-[11px] ${Math.abs(hud.throttle - g.v) < 0.05 ? "border-accent bg-accent/20 text-fg" : "border-border bg-surface text-muted"}`}>
              {t(g.key)}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-10 shrink-0 text-[10px] uppercase tracking-wider text-subtle">{t("helm.port")}</span>
          <div role="slider" className="relative h-11 min-w-0 flex-1 touch-none rounded-md border border-border bg-surface"
            onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setTiller(e.currentTarget, e.clientX, levers, setHud); }}
            onPointerMove={(e) => { if (e.buttons) setTiller(e.currentTarget, e.clientX, levers, setHud); }}>
            <span className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
            <span className="pointer-events-none absolute top-1.5 h-8 w-3 -translate-x-1/2 rounded-sm bg-accent" style={{ left: `${50 - hud.steer * 46}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[10px] uppercase tracking-wider text-subtle">{t("helm.starboard")}</span>
          <button type="button" className="shrink-0 text-[11px] text-muted underline" onPointerDown={(e) => { e.preventDefault(); levers.current.steer = 0; setHud((h) => ({ ...h, steer: 0 })); }}>{t("helm.midships")}</button>
        </div>
      </div>
    </div>
  );
}

function setTiller(el, clientX, levers, setHud) {
  const n = el.getBoundingClientRect();
  const i = (clientX - n.left) / Math.max(1, n.width);
  const v = Math.max(-1, Math.min(1, (0.5 - i) * 2));
  levers.current.steer = v;
  setHud((h) => ({ ...h, steer: v }));
}

function fit(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
}

function applyCam(ctx, canvas, harbor, kind) {
  const w = canvas.width, h = canvas.height;
  const a = Math.max(90, h - 16);
  const o = harbor.seaY + 20;
  const s = o + 16;
  const c = Math.max(harbor.span || 52, harbor.chan + 32);
  const l = Math.min(w / c, a / s) * 0.92;
  const u = (-16 + o) / 2;
  ctx.translate(w / 2, 8 + a / 2);
  if (kind === "depart") ctx.scale(l, -l);
  else ctx.scale(-l, l);
  ctx.translate(-(harbor.offset || 0), -u);
}

function inkRect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.14; ctx.strokeRect(x, y, w, h);
}

function drawProp(ctx, p) {
  if (p.kind === "park") {
    inkRect(ctx, p.x, p.y, p.w, p.h, "#3d8a3a");
    ctx.fillStyle = "#2a6a28";
    for (let n = 0; n < 4; n++) { ctx.beginPath(); ctx.arc(p.x + 1.2 + (n % 2) * (p.w - 2.4), p.y + 1.4 + Math.floor(n / 2) * (p.h - 2.6), 0.85, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  if (p.kind === "lot") {
    inkRect(ctx, p.x, p.y, p.w, p.h, "#5a5a54");
    ctx.strokeStyle = "rgba(240,240,230,0.35)"; ctx.lineWidth = 0.07;
    for (let n = 1; n < 4; n++) { ctx.beginPath(); ctx.moveTo(p.x + n * (p.w / 4), p.y + 0.2); ctx.lineTo(p.x + n * (p.w / 4), p.y + p.h - 0.2); ctx.stroke(); }
    return;
  }
  if (p.kind === "tank") {
    ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 2.1, 0, Math.PI * 2);
    ctx.fillStyle = "#8a8a82"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.14; ctx.stroke(); return;
  }
  if (p.kind === "silo") {
    ctx.fillStyle = "#b8b09a"; ctx.fillRect(p.x + 0.4, p.y, p.w - 0.8, p.h);
    ctx.fillStyle = "#9a927c"; ctx.fillRect(p.x, p.y + p.h * 0.7, p.w, p.h * 0.3);
    ctx.strokeStyle = INK; ctx.strokeRect(p.x + 0.4, p.y, p.w - 0.8, p.h); return;
  }
  if (p.kind === "container") {
    const cols = ["#c43c3c", "#3c6cac", "#d4a02a", "#3c8a5c"];
    const rw = p.w / 2 - 0.12, rh = p.h / 2 - 0.12;
    for (let a = 0; a < 4; a++) inkRect(ctx, p.x + (a % 2) * (rw + 0.15), p.y + Math.floor(a / 2) * (rh + 0.15), rw, rh, cols[(p.color + a) % 4]);
    return;
  }
  inkRect(ctx, p.x, p.y, p.w, p.h, ROOF[p.color] || ROOF[0]);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(p.x + 0.35, p.y + 0.35, p.w * 0.38, p.h * 0.32);
}

function drawShip(ctx, c, img, scale) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.heading);
  const i = c.beam * scale, a = c.length * scale;
  if (img && img.naturalWidth > 0) { ctx.scale(1, -1); ctx.drawImage(img, -i / 2, -a / 2, i, a); }
  else {
    ctx.fillStyle = "#1a0c04"; ctx.fillRect(-i / 2, -a / 2, i, a);
    ctx.fillStyle = "#d8cbb6"; ctx.fillRect(-i * 0.3, -a * 0.12, i * 0.6, a * 0.32);
    ctx.fillStyle = "#e85d04"; ctx.beginPath(); ctx.moveTo(0, a / 2); ctx.lineTo(-i * 0.42, a / 2 - 1.5); ctx.lineTo(i * 0.42, a / 2 - 1.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, canvas, craft, harbor, kind, name, now, imgs) {
  ctx.fillStyle = "#071820"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!harbor) return;
  ctx.save();
  applyCam(ctx, canvas, harbor, kind);
  ctx.fillStyle = WATER[harbor.water] || WATER[0];
  ctx.fillRect(-140, -50, 280, harbor.seaY + 90);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 10; i++) ctx.fillRect(-140, i * 14 + Math.sin(now * 0.4 + i) * 0.8, 280, 1.1);
  for (const n of harbor.walls) inkRect(ctx, n.x, n.y, n.w, n.h, n.h < 5 || n.w < 8.5 ? QUAY : LAND[harbor.palette] || LAND[0]);
  const seg0 = harbor.segs[0];
  if (seg0) {
    inkRect(ctx, seg0.x - harbor.berth / 2 - 1.4, -10, harbor.berth + 2.8, 16, QUAY);
    ctx.fillStyle = "#c8c4b4"; ctx.fillRect(seg0.x - harbor.berth / 2, 4.6, harbor.berth, 0.5);
  }
  for (const n of harbor.roads || []) {
    inkRect(ctx, n.x, n.y, n.w, n.h, ROAD);
    ctx.strokeStyle = "rgba(232,210,80,0.55)"; ctx.lineWidth = 0.08; ctx.setLineDash([0.9, 0.7]); ctx.beginPath();
    if (n.vert) { ctx.moveTo(n.x + n.w / 2, n.y + 0.3); ctx.lineTo(n.x + n.w / 2, n.y + n.h - 0.3); }
    else { ctx.moveTo(n.x + 0.3, n.y + n.h / 2); ctx.lineTo(n.x + n.w - 0.3, n.y + n.h / 2); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  for (const p of harbor.props || []) drawProp(ctx, p);
  for (const n of harbor.cars || []) {
    ctx.save(); ctx.translate(n.x + n.w / 2, n.y + n.h / 2); ctx.rotate(n.rot);
    ctx.fillStyle = CARS[n.color] || CARS[0]; ctx.fillRect(-n.w / 2, -n.h / 2, n.w, n.h);
    ctx.fillStyle = "rgba(180,220,230,0.5)"; ctx.fillRect(-n.w / 2 + 0.08, -n.h / 2 + 0.12, n.w - 0.16, n.h * 0.28);
    ctx.restore();
  }
  for (const n of harbor.cranes || []) {
    ctx.strokeStyle = "#c45c4a"; ctx.lineWidth = 0.32; ctx.beginPath();
    ctx.moveTo(n.x, n.y); ctx.lineTo(n.x, n.y + 7); ctx.moveTo(n.x - 2.6, n.y + 1.3); ctx.lineTo(n.x + 4.2, n.y + 1.3); ctx.stroke();
  }
  for (const b of harbor.buoys) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 0.62, 0, Math.PI * 2);
    ctx.fillStyle = b.port ? "#c43c3c" : "#3c8a4c"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.1; ctx.stroke();
  }
  const g = goalOf(kind, harbor);
  const last = harbor.segs[harbor.segs.length - 1];
  const gw = kind === "depart" ? last.w * 0.48 : harbor.berth * 0.48;
  const pulse = 0.55 + 0.45 * Math.sin(now * 3.2);
  ctx.fillStyle = "rgba(232,93,4," + (0.16 + pulse * 0.16) + ")"; ctx.fillRect(g.x - gw, g.y - 5, gw * 2, 12);
  ctx.strokeStyle = "rgba(232,93,4," + (0.7 + pulse * 0.3) + ")"; ctx.lineWidth = 0.45; ctx.strokeRect(g.x - gw, g.y - 5, gw * 2, 12);
  for (const n of harbor.traffic || []) drawShip(ctx, n, imgs.boat, 1);
  if (craft) drawShip(ctx, craft, imgs.ship, 0.92);
  ctx.restore();
  ctx.fillStyle = "rgba(237,230,217,0.55)";
  ctx.font = Math.round(canvas.height * 0.018) + 'px "IBM Plex Sans", sans-serif';
  ctx.fillText("M/V " + name + " \u00b7 " + (harbor.name || ""), 16, canvas.height - 14);
}
