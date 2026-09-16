import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { maybeT } from "@/i18n";
import { cn } from "@/lib/utils";
import { money, qty } from "../format";
import { greyOnBoardCeu, lawyerCost, lawyerRadius, verdictEffects, type LawyerTier } from "../court";
import { blip, chime, foghorn } from "../audio";
import { useGame } from "../store";

const BG = "#071018";
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
      const R = Math.min(w, h) * 0.38;
      const tier = (trial?.lawyer ?? 0) as LawyerTier;
      const bull = lawyerRadius(tier);
      ctx.save();
      ctx.translate(cx, cy);
      drawCabinet(ctx, R);
      drawSisal(ctx, R);
      ctx.beginPath();
      ctx.arc(0, 0, bull * R * 2.0, 0, Math.PI * 2);
      ctx.strokeStyle = WARN;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, bull * R, 0, Math.PI * 2);
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(4, bull * R * 0.28), 0, Math.PI * 2);
      ctx.fillStyle = ACCENT;
      ctx.fill();
      const speed = reduced.current ? 1.2 : 2.55;
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
        <div className="flex w-full shrink-0 flex-col justify-center gap-3 overflow-y-auto border-t border-border bg-bg-elevated p-4 sm:w-96 sm:border-l sm:border-t-0 sm:p-5">
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
            <VerdictSheet trial={trial} cash={s.cash} seized={greyOnBoardCeu(s)} onContinue={settle} />
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

function VerdictSheet({
  trial,
  cash,
  seized,
  onContinue,
}: {
  trial: NonNullable<ReturnType<typeof useGame.getState>["state"]["trial"]>;
  cash: number;
  seized: number;
  onContinue: () => void;
}) {
  const fx = verdictEffects(trial);
  const take = fx.seize ? seized : 0;
  const after = cash - fx.fine;
  return (
    <>
      <h3 className="animate-stamp font-display text-xl">{maybeT(`court.${fx.verdict}`)}</h3>
      <p className="text-sm italic text-fg">{maybeT(`court.quote.${fx.verdict}`)}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-2 text-xs">
        <dt className="text-muted">{maybeT("court.row.stake")}</dt>
        <dd className="tabular-nums">{money(trial.stake)}</dd>
        <dt className="text-muted">{maybeT("court.row.fine")}</dt>
        <dd className="tabular-nums text-danger">{money(fx.fine)}</dd>
        <dt className="text-muted">{maybeT("court.row.days")}</dt>
        <dd className="tabular-nums">{fx.days}</dd>
        <dt className="text-muted">{maybeT("court.row.seize")}</dt>
        <dd className="tabular-nums">{qty(take)} CEU</dd>
        <dt className="text-muted">{maybeT("court.row.heat")}</dt>
        <dd className="tabular-nums">{fx.heatAfter}</dd>
        <dt className="text-muted">{maybeT("court.row.rep")}</dt>
        <dd className="tabular-nums">{fx.repHit > 0 ? `+${fx.repHit}` : fx.repHit}</dd>
        <dt className="text-muted">{maybeT("court.row.cash")}</dt>
        <dd className={cn("tabular-nums", after < 0 ? "text-danger" : "text-fg")}>{money(after)}</dd>
      </dl>
      <p className="text-xs text-muted">
        {maybeT(`court.next.${fx.verdict}`, { n: money(fx.fine), days: fx.days, ceu: qty(take) })}
      </p>
      {after < 0 ? <p className="text-xs text-warn">{maybeT("court.next.credit")}</p> : null}
      <Button className="w-full" onClick={onContinue}>
        {maybeT("court.continue")}
      </Button>
    </>
  );
}

function drawCabinet(ctx: CanvasRenderingContext2D, R: number) {
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.26, 0, Math.PI * 2);
  ctx.fillStyle = "#2a1a0e";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.2, 0, Math.PI * 2);
  const wood = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 1.2);
  wood.addColorStop(0, "#5a3a1c");
  wood.addColorStop(0.7, "#3a2414");
  wood.addColorStop(1, "#1a1008");
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = "rgba(201,160,106,0.35)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(-R * 0.08, R * 0.06, R * (1.04 + i * 0.022), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.14, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1008";
  ctx.fill();
  ctx.strokeStyle = "#c9a06a";
  ctx.lineWidth = 3;
  ctx.stroke();
}

const DART_NUMS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function drawSisal(ctx: CanvasRenderingContext2D, R: number) {
  const dark = "#1a3a22";
  const pale = "#cfc6b4";
  const red = "#9a2e24";
  const green = "#2a6b38";
  const start = -Math.PI / 2 - Math.PI / 20;
  for (let i = 0; i < 20; i++) {
    const a0 = start + (i / 20) * Math.PI * 2;
    const a1 = start + ((i + 1) / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? dark : pale;
    ctx.fill();
  }
  for (const [outer, inner] of [
    [1, 0.93],
    [0.64, 0.57],
  ] as const) {
    for (let i = 0; i < 20; i++) {
      const a0 = start + (i / 20) * Math.PI * 2;
      const a1 = start + ((i + 1) / 20) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, outer * R, a0, a1);
      ctx.arc(0, 0, inner * R, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? red : green;
      ctx.fill();
    }
  }
  ctx.strokeStyle = WIRE;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const a = start + (i / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.stroke();
  }
  for (const r of [1, 0.93, 0.64, 0.57, 0.12]) {
    ctx.beginPath();
    ctx.arc(0, 0, r * R, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 0.12 * R, 0, Math.PI * 2);
  ctx.fillStyle = "#6b1c14";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 0.05 * R, 0, Math.PI * 2);
  ctx.fillStyle = "#c45c4a";
  ctx.fill();
  ctx.fillStyle = WIRE;
  ctx.font = `${Math.max(11, Math.round(R * 0.1))}px "IBM Plex Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i / 20) * Math.PI * 2;
    ctx.fillText(String(DART_NUMS[i]!), Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12);
  }
}

function drawDart(ctx: CanvasRenderingContext2D, x: number, y: number, p: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.72);
  ctx.globalAlpha = Math.min(1, 0.25 + p);
  ctx.fillStyle = "rgba(7,16,24,0.35)";
  ctx.beginPath();
  ctx.ellipse(4, 6, 7, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FG;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(4.2, 5);
  ctx.lineTo(0, 2);
  ctx.lineTo(-4.2, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(2.2, -2);
  ctx.lineTo(-2.2, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a8a7c";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(0, 18);
  ctx.stroke();
  ctx.fillStyle = DANGER;
  ctx.beginPath();
  ctx.moveTo(-3.2, 18);
  ctx.lineTo(0, 22);
  ctx.lineTo(3.2, 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
