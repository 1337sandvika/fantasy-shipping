import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { portName } from "../data/ports";
import { money } from "../format";
import { activeShip } from "../fleet";
import {
  actionsFromKeys,
  helmWon,
  makeHarbor,
  pilotFee,
  spawnCraft,
  stepCraft,
  type HelmCraft,
} from "../helm";
import { blip, foghorn } from "../audio";
import { useGame } from "../store";

const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

export function HelmOverlay() {
  const helm = useGame((g) => g.state.helm);
  const s = useGame((g) => g.state);
  const hire = useGame((g) => g.hirePilot);
  const finish = useGame((g) => g.finishHelm);
  const scrape = useGame((g) => g.scrapeHelm);
  const t = useT();
  const ship = helm ? s.fleet.find((x) => x.id === helm.shipId) ?? activeShip(s) : null;
  const [mode, setMode] = useState<"choice" | "play" | "crash">("choice");
  const fee = ship && helm ? Math.round(pilotFee(ship, helm.port, helm.kind, s.heat) * (helm.bump || mode === "crash" ? 1.35 : 1)) : 0;
  const dear = s.cash < fee;

  useEffect(() => {
    setMode("choice");
  }, [helm?.kind, helm?.shipId, helm?.port]);

  if (!helm || !ship) return null;
  const title = helm.kind === "depart" ? t("helm.departTitle", { port: portName(helm.port) }) : t("helm.arriveTitle", { port: portName(helm.port) });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
      {mode === "play" ? (
        <HelmCanvas
          helmKind={helm.kind}
          portId={helm.port}
          ship={ship}
          onWin={() => {
            blip(330, 0.12);
            finish();
          }}
          onCrash={() => {
            foghorn();
            scrape();
            setMode("crash");
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-bg-elevated p-5 shadow-panel">
            <p className="text-xs tracking-[0.2em] text-accent">{t("helm.kicker")}</p>
            <h2 className="mt-1 font-display text-2xl">{mode === "crash" ? t("helm.crashTitle") : title}</h2>
            <p className="mt-3 text-sm text-muted">
              {mode === "crash"
                ? t("helm.crashBody")
                : helm.kind === "depart"
                  ? t("helm.departBody", { name: ship.name })
                  : t("helm.arriveBody", { name: ship.name })}
            </p>
            <p className="mt-2 text-xs text-subtle">{t("helm.controls")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => setMode("play")}>{mode === "crash" ? t("helm.retry") : t("helm.take")}</Button>
              <Button variant="secondary" disabled={dear} onClick={() => hire()}>
                {t("helm.pilot")}
                <span className="ml-2 text-xs opacity-70">{dear ? t("helm.noCash") : money(fee)}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HelmCanvas({
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
  onCrash: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = useT();
  const keys = useRef(new Set<string>());
  const probeSteer = useRef<number | null>(null);
  const touch = useRef({ throttle: 0, steer: 0 });
  const craftRef = useRef<HelmCraft | null>(null);
  const done = useRef(false);
  const winRef = useRef(onWin);
  const crashRef = useRef(onCrash);
  winRef.current = onWin;
  crashRef.current = onCrash;
  const [hud, setHud] = useState({ speed: 0, heading: 0 });

  useEffect(() => {
    const harbor = makeHarbor(portId, ship);
    craftRef.current = spawnCraft(helmKind, ship, harbor);
    done.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const onKey = (e: KeyboardEvent) => {
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
      setSteer: (v: number) => {
        probeSteer.current = v;
      },
      setKeys: (codes: string[]) => {
        keys.current = new Set(codes);
        probeSteer.current = null;
      },
    };
    (window as unknown as { __controlsTest?: typeof probe }).__controlsTest = probe;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = 1 / 60;
    const loop = (now: number) => {
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
            crashRef.current();
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
      drawHarbor(ctx, canvas, craftRef.current, harbor, helmKind, ship.name);
      if (craftRef.current && Math.floor(now / 200) !== Math.floor((now - dt * 1000) / 200)) {
        setHud({ speed: craftRef.current.speed, heading: craftRef.current.heading });
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
      delete (window as unknown as { __controlsTest?: unknown }).__controlsTest;
    };
  }, [helmKind, portId, ship]);

  return (
    <div className="relative min-h-0 flex-1">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <p className="rounded-md bg-bg/70 px-2 py-1 text-xs tracking-[0.18em] text-accent">{t("helm.kicker")}</p>
        <p className="rounded-md bg-bg/70 px-2 py-1 font-mono text-xs tabular-nums text-muted">
          {hud.speed.toFixed(1)} kn · {((hud.heading * 180) / Math.PI).toFixed(0)}°
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-3 flex items-end justify-between gap-3 px-3 sm:hidden">
        <div className="flex gap-2">
          <Pad label="◀" onHold={(v) => (touch.current.steer = v ? 1 : 0)} />
          <Pad label="▶" onHold={(v) => (touch.current.steer = v ? -1 : 0)} />
        </div>
        <div className="flex gap-2">
          <Pad label="S" onHold={(v) => (touch.current.throttle = v ? -1 : 0)} />
          <Pad label="W" onHold={(v) => (touch.current.throttle = v ? 1 : 0)} />
        </div>
      </div>
    </div>
  );
}

function Pad({ label, onHold }: { label: string; onHold: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className="flex size-14 items-center justify-center rounded-md border border-border bg-bg-elevated/90 text-lg text-fg"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}

function fit(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
}

function drawHarbor(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  craft: HelmCraft | null,
  harbor: ReturnType<typeof makeHarbor>,
  kind: "depart" | "arrive",
  name: string,
) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#0e2436";
  ctx.fillRect(0, 0, w, h);
  if (!craft) return;
  const zoom = Math.min(w, h) / 72;
  ctx.save();
  ctx.translate(w / 2, h * 0.62);
  ctx.scale(zoom, -zoom);
  ctx.rotate(-craft.heading);
  ctx.translate(-craft.x, -craft.y);

  ctx.fillStyle = "#1a3a2e";
  for (const wall of harbor.walls) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = "#2a3530";
  ctx.fillRect(-harbor.berth / 2 - 1, -8, harbor.berth + 2, 16);
  ctx.fillStyle = "#c9c0ae";
  ctx.fillRect(-harbor.berth / 2, 5.2, harbor.berth, 0.35);

  ctx.strokeStyle = "rgba(237,230,217,0.18)";
  ctx.lineWidth = 0.18;
  ctx.setLineDash([1.2, 1.6]);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, harbor.seaY + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const b of harbor.buoys) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 0.7, 0, Math.PI * 2);
    ctx.fillStyle = b.port ? "#c45c4a" : "#7d9b76";
    ctx.fill();
  }

  if (kind === "depart") {
    ctx.fillStyle = "rgba(232,93,4,0.18)";
    ctx.fillRect(-harbor.chan, harbor.seaY, harbor.chan * 2, 14);
  } else {
    ctx.fillStyle = "rgba(232,93,4,0.22)";
    ctx.fillRect(-harbor.berth * 0.4, -1, harbor.berth * 0.8, 8);
  }

  ctx.save();
  ctx.translate(craft.x, craft.y);
  ctx.rotate(craft.heading);
  ctx.fillStyle = "#1a0c04";
  ctx.fillRect(-craft.beam / 2, -craft.length / 2, craft.beam, craft.length);
  ctx.fillStyle = "#ede6d9";
  ctx.fillRect(-craft.beam * 0.28, -craft.length * 0.08, craft.beam * 0.56, craft.length * 0.28);
  ctx.fillStyle = "#e85d04";
  ctx.beginPath();
  ctx.moveTo(0, craft.length / 2);
  ctx.lineTo(-craft.beam * 0.42, craft.length / 2 - 1.4);
  ctx.lineTo(craft.beam * 0.42, craft.length / 2 - 1.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
  ctx.fillStyle = "rgba(237,230,217,0.55)";
  ctx.font = `${Math.round(canvas.height * 0.018)}px "IBM Plex Sans", sans-serif`;
  ctx.fillText(`M/V ${name}`, 16, canvas.height - 18);
}
