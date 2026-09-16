import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { maybeT } from "@/i18n";
import { cn } from "@/lib/utils";
import { money } from "../format";
import { lawyerCost, lawyerRadius, type LawyerTier } from "../court";
import { blip, chime, foghorn } from "../audio";
import { useGame } from "../store";

const BG = "#071018";
const RING = "#1a3344";
const WIRE = "#c9c0ae";
const ACCENT = "#e85d04";
const FG = "#ede6d9";
const OK = "#7d9b76";
const DANGER = "#c45c4a";
const WARN = "#c4a574";

export function CourtOverlay() {
  const trial = useGame((g) => g.state.trial);
  const s = useGame((g) => g.state);
  const hire = useGame((g) => g.hireCounsel);
  const lock = useGame((g) => g.lockThrow);
  const settle = useGame((g) => g.settleCourt);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sweep = useRef(0);
  const live = useRef({ axis: "x" as "x" | "y" | "fly" | "done", x: 0, y: 0, fly: 0 });
  const [axis, setAxis] = useState<"x" | "y" | "fly" | "done">("x");
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useEffect(() => {
    if (trial?.phase === "throw") {
      live.current = { axis: "x", x: 0, y: 0, fly: 0 };
      setAxis("x");
    }
    if (trial?.phase === "verdict") {
      live.current = { axis: "done", x: trial.x ?? 0, y: trial.y ?? 0, fly: 1 };
      setAxis("done");
    }
  }, [trial?.phase, trial?.x, trial?.y]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      const tier = (trial?.lawyer ?? 0) as LawyerTier;
      const bull = lawyerRadius(tier);
      ctx.save();
      ctx.translate(cx, cy);
      const rings = [1, 0.78, 0.58, 0.36, bull * 2.15, bull];
      rings.forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(0, 0, r * R, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? RING : "#122232";
        ctx.fill();
        ctx.strokeStyle = WIRE;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      ctx.beginPath();
      ctx.arc(0, 0, bull * R, 0, Math.PI * 2);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = ACCENT;
      ctx.fill();
      const speed = reduced.current ? 1.05 : 1.85;
      const st = live.current;
      const aiming = trial?.phase === "throw" && (st.axis === "x" || st.axis === "y");
      if (aiming) {
        const osc = Math.sin(t * speed);
        if (st.axis === "x") st.x = osc;
        else st.y = osc;
      }
      const x = st.axis === "fly" || st.axis === "done" ? st.x : st.axis === "y" ? st.x : st.x;
      const y = st.axis === "fly" || st.axis === "done" ? st.y : st.axis === "y" ? st.y : 0;
      if (aiming) {
        ctx.strokeStyle = FG;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2;
        if (st.axis === "x") {
          ctx.beginPath();
          ctx.moveTo(st.x * R, -R * 1.08);
          ctx.lineTo(st.x * R, R * 1.08);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(-R * 1.08, st.y * R);
          ctx.lineTo(R * 1.08, st.y * R);
          ctx.stroke();
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.moveTo(st.x * R, -R * 1.08);
          ctx.lineTo(st.x * R, R * 1.08);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (st.axis === "fly" || st.axis === "done") {
        const p = st.axis === "done" ? 1 : Math.min(1, st.fly);
        const ease = 1 - (1 - p) * (1 - p);
        const dx = -0.15 + (x + 0.15) * ease;
        const dy = -1.12 + (y + 1.12) * ease;
        drawDart(ctx, dx * R, dy * R, p);
        if (st.axis === "done") {
          ctx.beginPath();
          ctx.arc(x * R, y * R, 10, 0, Math.PI * 2);
          ctx.strokeStyle = trial?.verdict === "acquit" ? OK : trial?.verdict === "miss" ? DANGER : WARN;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    [trial?.lawyer, trial?.verdict, trial?.phase],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      sweep.current += dt;
      if (live.current.axis === "fly") {
        live.current.fly += dt / 0.45;
        if (live.current.fly >= 1) {
          live.current.axis = "done";
          live.current.fly = 1;
          setAxis("done");
          const v = useGame.getState().state.trial?.verdict;
          if (v === "acquit") chime();
          else if (v === "miss" || v === "guilty") foghorn();
          else blip(180, 0.1);
        }
      }
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth ?? 320;
      const cssH = parent?.clientHeight ?? 320;
      const size = Math.max(220, Math.min(cssW, cssH, 420));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.floor(size * dpr) || canvas.height !== Math.floor(size * dpr)) {
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, size, size, sweep.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const onLock = useCallback(() => {
    const st = live.current;
    if (st.axis === "x") {
      st.axis = "y";
      setAxis("y");
      blip(280, 0.07);
      return;
    }
    if (st.axis === "y") {
      const x = st.x;
      const y = st.y;
      st.axis = "fly";
      st.fly = 0;
      setAxis("fly");
      lock(x, y);
      blip(420, 0.1);
    }
  }, [lock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        onLock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLock]);

  if (!trial) return null;
  const stake = trial.stake;
  const silk = lawyerCost(2, stake);
  const desk = lawyerCost(1, stake);
  const phase = trial.phase;
  const verdict = trial.verdict;
  const fine = trial.fine ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg text-fg select-none"
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none", userSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center p-3">
          <canvas
            ref={canvasRef}
            className="touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              if (phase === "throw" && (axis === "x" || axis === "y")) onLock();
            }}
          />
        </div>
        <div className="flex w-full shrink-0 flex-col justify-center gap-3 overflow-y-auto border-t border-border bg-bg-elevated p-4 sm:w-80 sm:border-l sm:border-t-0 sm:p-5">
          <p className="text-xs tracking-[0.2em] text-accent">{maybeT("court.kicker")}</p>
          <h2 className="font-display text-2xl">{maybeT("court.title", { line: s.company || s.captain })}</h2>
          <p className="text-xs tabular-nums text-muted">{maybeT("court.stake", { n: money(stake) })}</p>
          {phase === "counsel" ? (
            <>
              <p className="text-sm text-muted">{maybeT("court.counselBody", { n: money(stake) })}</p>
              <CounselBtn
                label={maybeT("court.public")}
                hint={maybeT("court.publicHint")}
                onClick={() => hire(0)}
              />
              <CounselBtn
                label={maybeT("court.desk")}
                hint={maybeT("court.deskHint", { n: money(desk) })}
                onClick={() => hire(1)}
              />
              <CounselBtn
                label={maybeT("court.silk")}
                hint={maybeT("court.silkHint", { n: money(silk) })}
                primary
                onClick={() => hire(2)}
              />
            </>
          ) : null}
          {axis === "fly" ? <p className="text-sm text-muted">{maybeT("court.flying")}</p> : null}
          {(axis === "x" || axis === "y") && phase === "throw" ? (
            <>
              <p className="text-sm text-muted">{axis === "y" ? maybeT("court.lockHintY") : maybeT("court.lockHintX")}</p>
              <Button className="w-full" onClick={onLock}>
                {axis === "x" ? maybeT("court.lockX") : maybeT("court.lockY")}
              </Button>
            </>
          ) : null}
          {axis === "done" && verdict ? (
            <>
              <h3 className="font-display text-xl">{maybeT(`court.${verdict}`)}</h3>
              <p className="text-sm text-muted">{maybeT(`court.${verdict}Body`, { n: money(fine) })}</p>
              <Button className="w-full" onClick={settle}>
                {maybeT("court.continue")}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CounselBtn({
  label,
  hint,
  onClick,
  primary,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <Button variant={primary ? "default" : "secondary"} className="h-auto min-h-11 w-full flex-col items-start py-2" onClick={onClick}>
      <span>{label}</span>
      <span className={cn("text-xs font-normal opacity-70")}>{hint}</span>
    </Button>
  );
}

function drawDart(ctx: CanvasRenderingContext2D, x: number, y: number, p: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.7);
  ctx.globalAlpha = Math.min(1, 0.3 + p);
  ctx.fillStyle = FG;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(3.5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-3.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.lineTo(0, 16);
  ctx.stroke();
  ctx.restore();
}
