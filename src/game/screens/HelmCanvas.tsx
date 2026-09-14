// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { actionsFromKeys, helmWon, makeHarbor, spawnCraft, stepCraft } from "../helm";

const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
const SHIP_IMG = "https://palm-river-olive-field.grok.me/game/helm/ship-top.png";
const BOAT_IMG = "https://palm-river-olive-field.grok.me/game/helm/workboat.png";
const SINK_IMG = "https://palm-river-olive-field.grok.me/game/helm/sink.jpg";
const WATER = ["#2a7480", "#1f5f6a", "#2d6e78"];
const LAND = ["#4a7a3e", "#3e6b48", "#5a6a42", "#4a5a3a"];
const QUAY = "#8a8a7c";
const INK = "#141410";

export function HelmCanvas({ helmKind, portId, ship, onWin, onCrash }) {
  const canvasRef = useRef(null);
  const t = useT();
  const keys = useRef(new Set());
  const probeSteer = useRef(null);
  const touch = useRef({ throttle: 0, steer: 0 });
  const craftRef = useRef(null);
  const harborRef = useRef(null);
  const done = useRef(false);
  const winRef = useRef(onWin);
  const crashRef = useRef(onCrash);
  const imgs = useRef({ ship: null, boat: null });
  const [sinking, setSinking] = useState(false);
  winRef.current = onWin;
  crashRef.current = onCrash;
  const [hud, setHud] = useState({ speed: 0, heading: 0, brief: "" });

  useEffect(() => {
    const a = new Image();
    a.src = SHIP_IMG;
    a.onload = () => { imgs.current.ship = a; };
    const b = new Image();
    b.src = BOAT_IMG;
    b.onload = () => { imgs.current.boat = b; };
  }, []);

  useEffect(() => {
    const harbor = makeHarbor(portId, ship);
    harborRef.current = harbor;
    craftRef.current = spawnCraft(helmKind, ship, harbor);
    done.current = false;
    setSinking(false);
    setHud((h) => ({ ...h, brief: harbor.briefKey }));
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
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = 1 / 60;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      const harbor = harborRef.current;
      if (!done.current && harbor) {
        while (acc >= step) {
          acc -= step;
          const cur = craftRef.current;
          if (!cur) break;
          const fromKeys = actionsFromKeys(keys.current, probeSteer.current);
          const a = {
            throttle: touch.current.throttle || fromKeys.throttle,
            steer: touch.current.steer || fromKeys.steer,
          };
          const { craft, hit } = stepCraft(cur, a, harbor, step);
          craftRef.current = craft;
          if (hit) {
            done.current = true;
            if (hit === "sink") setSinking(true);
            crashRef.current(hit);
            break;
          }
          if (helmWon(craft, helmKind, harbor)) {
            done.current = true;
            winRef.current();
            break;
          }
        }
      } else acc = 0;
      fit(canvas);
      drawWorld(ctx, canvas, craftRef.current, harborRef.current, helmKind, ship.name, now / 1000, t, imgs.current);
      if (craftRef.current && Math.floor(now / 200) !== Math.floor((now - dt * 1000) / 200)) {
        setHud({ speed: craftRef.current.speed, heading: craftRef.current.heading, brief: harborRef.current?.briefKey || "" });
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
        <p className="absolute left-1/2 top-10 -translate-x-1/2 animate-pulse rounded-md border border-danger bg-danger/85 px-5 py-2 font-display text-lg tracking-[0.35em] text-fg">
          {t("helm.alarm") || "PANIC"}
        </p>
        <p className="absolute bottom-8 left-0 right-0 text-center font-display text-xl text-fg">M/V {ship.name}</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <canvas ref={canvasRef} className="min-h-0 w-full flex-1 touch-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-2 p-3">
        <p className="rounded-md bg-bg/70 px-2 py-1 text-xs tracking-[0.18em] text-accent">{t("helm.kicker")}</p>
        <p className="rounded-md bg-bg/70 px-2 py-1 font-mono text-xs tabular-nums text-muted">
          {hud.speed.toFixed(1)} kn \u00b7 {((hud.heading * 180) / Math.PI).toFixed(0)}\u00b0
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-3 sm:bottom-3">
        <p className="rounded-md bg-bg/80 px-3 py-1.5 text-center text-xs text-fg">{t(hud.brief || "helm.layout.straight")}</p>
      </div>
      <div className="absolute inset-x-0 bottom-3 flex items-end justify-between gap-3 px-3 sm:hidden">
        <div className="flex gap-2">
          <Pad label="\u25c0" onHold={(v) => (touch.current.steer = v ? 1 : 0)} />
          <Pad label="\u25b6" onHold={(v) => (touch.current.steer = v ? -1 : 0)} />
        </div>
        <div className="flex gap-2">
          <Pad label="S" onHold={(v) => (touch.current.throttle = v ? -1 : 0)} />
          <Pad label="W" onHold={(v) => (touch.current.throttle = v ? 1 : 0)} />
        </div>
      </div>
    </div>
  );
}

function Pad({ label, onHold }) {
  return (
    <button type="button" className="flex size-14 items-center justify-center rounded-md border border-border bg-bg-elevated/90 text-lg text-fg"
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); onHold(true); }}
      onPointerUp={() => onHold(false)} onPointerCancel={() => onHold(false)}>{label}</button>
  );
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

function strokeRect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.14;
  ctx.strokeRect(x, y, w, h);
}

function drawShip(ctx, c, img, scale) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.heading);
  const i = c.beam * scale, a = c.length * scale;
  if (img && img.naturalWidth > 0) {
    ctx.scale(1, -1);
    ctx.drawImage(img, -i / 2, -a / 2, i, a);
  } else {
    ctx.fillStyle = "#1a0c04";
    ctx.fillRect(-i / 2, -a / 2, i, a);
    ctx.fillStyle = "#d8cbb6";
    ctx.fillRect(-i * 0.3, -a * 0.12, i * 0.6, a * 0.32);
    ctx.fillStyle = "#e85d04";
    ctx.beginPath();
    ctx.moveTo(0, a / 2);
    ctx.lineTo(-i * 0.42, a / 2 - 1.5);
    ctx.lineTo(i * 0.42, a / 2 - 1.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, canvas, craft, harbor, kind, name, now, t, imgs) {
  ctx.fillStyle = "#071820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!harbor) return;
  ctx.save();
  applyCam(ctx, canvas, harbor, kind);
  ctx.fillStyle = WATER[harbor.water] || WATER[0];
  ctx.fillRect(-140, -50, 280, harbor.seaY + 90);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 10; i++) ctx.fillRect(-140, i * 14 + Math.sin(now * 0.4 + i) * 0.8, 280, 1.1);
  for (const n of harbor.walls) {
    const slim = n.h < 5 || n.w < 8.5;
    strokeRect(ctx, n.x, n.y, n.w, n.h, slim ? QUAY : LAND[harbor.palette] || LAND[0]);
  }
  const seg0 = harbor.segs?.[0];
  if (seg0) {
    strokeRect(ctx, seg0.x - harbor.berth / 2 - 1.4, -10, harbor.berth + 2.8, 16, QUAY);
    ctx.fillStyle = "#c8c4b4";
    ctx.fillRect(seg0.x - harbor.berth / 2, 4.6, harbor.berth, 0.5);
  }
  for (const b of harbor.buoys) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 0.62, 0, Math.PI * 2);
    ctx.fillStyle = b.port ? "#c43c3c" : "#3c8a4c";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.1;
    ctx.stroke();
  }
  for (const n of harbor.cranes || []) {
    ctx.strokeStyle = "#c45c4a";
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(n.x, n.y + 7);
    ctx.moveTo(n.x - 2.6, n.y + 1.3);
    ctx.lineTo(n.x + 4.2, n.y + 1.3);
    ctx.stroke();
  }
  const pulse = 0.55 + 0.45 * Math.sin(now * 3.2);
  const last = harbor.segs[harbor.segs.length - 1];
  const gx = kind === "depart" ? last.x : harbor.berthX;
  const gy = kind === "depart" ? harbor.seaY + 6 : 3.2;
  const gw = kind === "depart" ? last.w * 0.48 : harbor.berth * 0.48;
  ctx.fillStyle = "rgba(232,93,4," + (0.16 + pulse * 0.16) + ")";
  ctx.fillRect(gx - gw, gy - 5, gw * 2, 12);
  ctx.strokeStyle = "rgba(232,93,4," + (0.7 + pulse * 0.3) + ")";
  ctx.lineWidth = 0.45;
  ctx.strokeRect(gx - gw, gy - 5, gw * 2, 12);
  if (craft) drawShip(ctx, craft, imgs.ship, 0.92);
  ctx.restore();
  ctx.fillStyle = "#e85d04";
  ctx.font = "600 " + Math.round(Math.max(12, canvas.height * 0.028)) + 'px "IBM Plex Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(kind === "depart" ? (t("helm.goalSea") || "SEA") : (t("helm.goalBerth") || "BERTH"), canvas.width / 2, 22);
  ctx.fillStyle = "rgba(237,230,217,0.55)";
  ctx.font = Math.round(canvas.height * 0.018) + 'px "IBM Plex Sans", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("M/V " + name + " \u00b7 " + (harbor.name || ""), 16, canvas.height - 14);
}
