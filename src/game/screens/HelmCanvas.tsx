// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import {
  actionsFromKeys,
  helmWon,
  makeHarbor,
  spawnCraft,
  stepCraft,
  type Harbor,
  type HelmCraft,
  type HelmHit,
} from "../helm";

const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

export function HelmCanvas({
  helmKind,
  portId,
  ship,
  onWin,
  onCrash,
}: {
  helmKind: "depart" | "arrive";
  portId: string;
  ship: { ceu: number; condition: number; name: string };
  onWin: () => void;
  onCrash: (kind: Exclude<HelmHit, false>) => void;
}) {
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
  winRef.current = onWin;
  crashRef.current = onCrash;
  const [hud, setHud] = useState({ speed: 0, heading: 0, brief: "" });

  useEffect(() => {
    const harbor = makeHarbor(portId, ship);
    harborRef.current = harbor;
    craftRef.current = spawnCraft(helmKind, ship, harbor);
    done.current = false;
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

    const probe = {
      getYaw: () => craftRef.current?.heading ?? 0,
      getSpeed: () => craftRef.current?.speed ?? 0,
      setSteer: (v) => {
        probeSteer.current = v;
      },
      setKeys: (codes) => {
        keys.current = new Set(codes);
        probeSteer.current = null;
      },
    };
    window.__controlsTest = probe;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = 1 / 60;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (!done.current) {
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
            crashRef.current(hit);
            break;
          }
          if (helmWon(craft, helmKind, harbor)) {
            done.current = true;
            winRef.current();
            break;
          }
        }
      }
      fit(canvas);
      drawHarbor(ctx, canvas, craftRef.current, harbor, helmKind, ship.name, now);
      if (craftRef.current && Math.floor(now / 200) !== Math.floor((now - dt * 1000) / 200)) {
        setHud({ speed: craftRef.current.speed, heading: craftRef.current.heading, brief: harbor.briefKey });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onResize = () => fit(canvas);
    fit(canvas);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      window.removeEventListener("resize", onResize);
      delete window.__controlsTest;
    };
  }, [helmKind, portId, ship]);

  return (
    <div className="relative min-h-0 flex-1">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <p className="rounded-md bg-bg/70 px-2 py-1 text-xs tracking-[0.18em] text-accent">{t("helm.kicker")}</p>
        <p className="rounded-md bg-bg/70 px-2 py-1 font-mono text-xs tabular-nums text-muted">
          {hud.speed.toFixed(1)} kn \u00b7 {((hud.heading * 180) / Math.PI).toFixed(0)}\u00b0
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-3 sm:bottom-3">
        <p className="rounded-md bg-bg/80 px-3 py-1.5 text-center text-xs text-fg">
          {t(hud.brief || "helm.layout.straight")}
        </p>
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
    <button
      type="button"
      className="flex size-14 items-center justify-center rounded-md border border-border bg-bg-elevated/90 text-lg text-fg"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}

function fit(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
}

function worldCam(ctx, canvas, harbor) {
  const pad = 8;
  const bw = harbor.maxX - harbor.minX;
  const bh = harbor.maxY - harbor.minY;
  const zoom = Math.min((canvas.width - pad) / bw, (canvas.height - pad) / bh);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, -zoom);
  ctx.translate(-(harbor.minX + harbor.maxX) / 2, -(harbor.minY + harbor.maxY) / 2);
}

function strokeRect(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke || "#111";
  ctx.lineWidth = 0.28;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
}

function drawHarbor(ctx, canvas, craft, harbor, kind, name, now) {
  const w = canvas.width;
  const h = canvas.height;
  const pulse = 0.5 + 0.5 * Math.sin(now / 900);
  ctx.fillStyle = `rgb(${18 + pulse * 8}, ${70 + pulse * 18}, ${88 + pulse * 10})`;
  ctx.fillRect(0, 0, w, h);
  if (!harbor) return;
  ctx.save();
  worldCam(ctx, canvas, harbor);

  ctx.fillStyle = "#1f6b4a";
  ctx.fillRect(harbor.minX, harbor.minY, harbor.maxX - harbor.minX, harbor.maxY - harbor.minY);
  ctx.fillStyle = `rgb(${22 + pulse * 10}, ${86 + pulse * 20}, ${102 + pulse * 12})`;
  ctx.fillRect(-harbor.chan * 1.4, -8, harbor.chan * 2.8, harbor.seaY + 28);

  for (const p of harbor.props) {
    if (p.kind === "road") {
      strokeRect(ctx, p.x, p.y, p.w, p.h, "#3d3d3d", "#111");
      ctx.strokeStyle = "#d4b84a";
      ctx.lineWidth = 0.18;
      ctx.setLineDash([1.4, 1.6]);
      ctx.beginPath();
      ctx.moveTo(p.x + p.w / 2, p.y);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (p.kind === "lot" || p.kind === "park") {
      strokeRect(ctx, p.x, p.y, p.w, p.h, p.color, "#111");
    } else if (p.kind === "bldg") {
      strokeRect(ctx, p.x, p.y, p.w, p.h, p.color, "#0a0a0a");
    } else if (p.kind === "car") {
      strokeRect(ctx, p.x, p.y, p.w, p.h, p.color, "#111");
    } else if (p.kind === "box") {
      strokeRect(ctx, p.x, p.y, p.w, p.h, p.color, "#111");
    } else if (p.kind === "tank") {
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 0.28;
      ctx.stroke();
    } else if (p.kind === "tree") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.w, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 0.2;
      ctx.stroke();
    } else if (p.kind === "crane") {
      strokeRect(ctx, p.x, p.y, 1.4, p.h + 6, "#c9a227", "#111");
      strokeRect(ctx, p.x, p.y + p.h + 4, p.w, 1.2, "#c9a227", "#111");
    }
  }

  ctx.fillStyle = "#6b7280";
  for (const wall of harbor.walls) strokeRect(ctx, wall.x, wall.y, wall.w, wall.h, "#5c6570", "#111");

  strokeRect(ctx, harbor.berthX - harbor.berth / 2, harbor.berthY - 3, harbor.berth, 8, "#8a8474", "#111");
  ctx.fillStyle = "#e2d3a4";
  ctx.fillRect(harbor.berthX - harbor.berth / 2, harbor.berthY + 2.4, harbor.berth, 0.35);

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.2;
  ctx.setLineDash([1.3, 1.5]);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(harbor.kind === "dogleg" ? 11 : 0, harbor.seaY + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const b of harbor.buoys) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 0.75, 0, Math.PI * 2);
    ctx.fillStyle = b.port ? "#d23a2a" : "#2f8a3c";
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 0.22;
    ctx.stroke();
  }

  if (kind === "depart") {
    ctx.fillStyle = "rgba(232,93,4,0.28)";
    ctx.fillRect(-harbor.chan, harbor.seaY, harbor.chan * 2, 12);
  } else {
    ctx.fillStyle = "rgba(232,93,4,0.3)";
    ctx.fillRect(harbor.berthX - harbor.berth * 0.4, harbor.berthY - 1, harbor.berth * 0.8, 7);
  }

  if (craft) {
    ctx.save();
    ctx.translate(craft.x, craft.y);
    ctx.rotate(craft.heading);
    strokeRect(ctx, -craft.beam / 2, -craft.length / 2, craft.beam, craft.length, "#1a0c04", "#111");
    strokeRect(ctx, -craft.beam * 0.28, -craft.length * 0.08, craft.beam * 0.56, craft.length * 0.28, "#ede6d9", "#111");
    ctx.fillStyle = "#e85d04";
    ctx.beginPath();
    ctx.moveTo(0, craft.length / 2);
    ctx.lineTo(-craft.beam * 0.42, craft.length / 2 - 1.4);
    ctx.lineTo(craft.beam * 0.42, craft.length / 2 - 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  ctx.fillStyle = "rgba(237,230,217,0.8)";
  ctx.font = Math.round(canvas.height * 0.018) + 'px "IBM Plex Sans", sans-serif';
  ctx.fillText("M/V " + name + " \u00b7 " + (harbor.name || ""), 16, canvas.height - 18);
}
