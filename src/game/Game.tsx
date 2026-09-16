import { useEffect, useRef, useState } from "react";
import { ChevronsDown, ChevronsUp, Settings } from "lucide-react";
import { maybeT, useT } from "@/i18n";
import { MapCanvas } from "./MapCanvas";
import { persist } from "./save";
import { EventModal } from "./screens/EventModal";
import { EtsModal } from "./screens/EtsModal";
import { EndScreen } from "./screens/EndScreen";
import { FleetBar, TempoBar } from "./screens/FleetBar";
import { HoldCard } from "./screens/HoldCard";
import { HUD } from "./screens/HUD";
import { PortPanel } from "./screens/PortPanel";
import { SettingsSheet } from "./screens/SettingsSheet";
import { Paywall } from "./screens/Paywall";
import { TitleScreen } from "./screens/TitleScreen";
import { HelmOverlay } from "./screens/HelmOverlay";
import { CourtOverlay } from "./screens/CourtOverlay";
import { hydrateIap, iapCanPlay, refreshTrialClock, useIap } from "@/lib/iap";
import { hydrateSaveFlag, useGame } from "./store";
import { setMuted } from "./audio";
import { activeShip, bargeLeft, drydockLeft, fleetHasBarge } from "./fleet";

const DAYS_PER_MIN = 12;

export function Game() {
  const phase = useGame((s) => s.state.phase);
  const muted = useGame((s) => s.ui.muted);
  const tick = useGame((s) => s.tick);

  useEffect(() => {
    hydrateSaveFlag();
    void hydrateIap();
    (window as unknown as { __game?: typeof useGame }).__game = useGame;
  }, []);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const g = useGame.getState();
      if (
        g.state.phase !== "event" &&
        g.state.phase !== "title" &&
        g.state.phase !== "end" &&
        !g.state.helm &&
        !g.state.trial &&
        !g.ui.settings &&
        iapCanPlay()
      ) {
        const tempo = g.ui.tempo;
        if (tempo > 0 && (g.state.legs.length || fleetHasBarge(g.state))) {
          tick((dt * DAYS_PER_MIN * tempo) / 60);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onHide = () => {
      const st = useGame.getState().state;
      if (st.phase !== "title") persist(st);
      refreshTrialClock();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [tick]);

  if (phase === "title") return <TitleScreen />;
  if (phase === "end") return <EndScreen />;

  return <CareerShell />;
}

const MAP_H_KEY = "poc-map-vh";
const PANEL_W_KEY = "poc-panel-w";

function readNum(key: string, fallback: number, min: number, max: number) {
  try {
    const n = Number(localStorage.getItem(key));
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  } catch {
    /* ignore */
  }
  return fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function useMapSplit() {
  const [mapVh, setMapVh] = useState(() => readNum(MAP_H_KEY, 36, 20, 58));
  const [panelW, setPanelW] = useState(() => readNum(PANEL_W_KEY, 380, 260, 560));
  const [stacked, setStacked] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setStacked(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const setSplit = (next: { mapVh?: number; panelW?: number }) => {
    if (next.mapVh != null) {
      const v = clamp(next.mapVh, 20, 58);
      setMapVh(v);
      try {
        localStorage.setItem(MAP_H_KEY, String(v));
      } catch {
        /* ignore */
      }
    }
    if (next.panelW != null) {
      const v = clamp(next.panelW, 260, 560);
      setPanelW(v);
      try {
        localStorage.setItem(PANEL_W_KEY, String(v));
      } catch {
        /* ignore */
      }
    }
  };
  return { mapVh, panelW, stacked, setSplit };
}

function SplitHandle({
  mapVh,
  panelW,
  onSplit,
}: {
  mapVh: number;
  panelW: number;
  onSplit: (next: { mapVh?: number; panelW?: number }) => void;
}) {
  const last = useRef<{ x: number; y: number } | null>(null);
  const stacked = useRef(true);
  const live = useRef({ mapVh, panelW });
  live.current = { mapVh, panelW };
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      stacked.current = !mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return (
    <div
      role="separator"
      aria-label={maybeT("map.resize")}
      aria-orientation="horizontal"
      className="relative z-20 flex h-4 w-full shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-border bg-bg-elevated sm:h-auto sm:w-3.5 sm:cursor-col-resize sm:flex-col sm:border-x sm:border-y-0"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!last.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.preventDefault();
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        if (stacked.current) {
          live.current.mapVh = clamp(live.current.mapVh + (dy / Math.max(120, window.innerHeight)) * 100, 20, 58);
          onSplit({ mapVh: live.current.mapVh });
        } else {
          live.current.panelW = clamp(live.current.panelW - dx, 260, 560);
          onSplit({ panelW: live.current.panelW });
        }
      }}
      onPointerUp={() => {
        last.current = null;
      }}
      onPointerCancel={() => {
        last.current = null;
      }}
      onDoubleClick={() => onSplit({ mapVh: 36, panelW: 380 })}
    >
      <span className="block h-1 w-10 rounded-full bg-muted sm:h-10 sm:w-1" />
    </div>
  );
}

function CareerShell() {
  const phase = useGame((s) => s.state.phase);
  const helm = useGame((s) => s.state.helm);
  const trial = useGame((s) => s.state.trial);
  const settings = useGame((s) => s.ui.settings);
  const mapHud = useGame((s) => s.ui.mapHud) !== false;
  const setSettings = useGame((s) => s.setSettings);
  const setMapHud = useGame((s) => s.setMapHud);
  const toTitle = useGame((s) => s.toTitle);
  const t = useT();
  const locked = useIap((s) => s.gating && s.ready && !s.canPlay);
  const paywallOpen = useIap((s) => s.paywallOpen);
  const { mapVh, panelW, stacked, setSplit } = useMapSplit();

  return (
    <div className="safe-pad relative flex h-dvh min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden overflow-y-hidden bg-bg text-fg">
      <HUD />
      <FleetBar />
      <div className="hidden sm:block">
        <HoldCard variant="bar" />
      </div>
      <StatusBanners />
      <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col sm:flex-row">
        <div
          className="relative w-full min-w-0 shrink-0 sm:h-auto sm:min-h-0 sm:flex-1"
          style={stacked ? { height: `${mapVh}vh` } : undefined}
        >
          <MapCanvas />
          <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setMapHud(!mapHud)}
              className="flex size-11 items-center justify-center rounded-md border border-border bg-bg-elevated/90 text-fg"
              aria-label={t(mapHud ? "map.hideHud" : "map.showHud")}
              title={t(mapHud ? "map.hideHud" : "map.showHud")}
            >
              {mapHud ? <ChevronsDown className="size-4" /> : <ChevronsUp className="size-4" />}
            </button>
            {mapHud ? (
              <button
                type="button"
                onClick={() => setSettings(true)}
                className="flex size-11 items-center justify-center rounded-md border border-border bg-bg-elevated/90 text-fg"
                aria-label={t("set.title")}
              >
                <Settings className="size-4" />
              </button>
            ) : null}
          </div>
          {mapHud ? (
            <div className="absolute bottom-2 left-2 right-2 z-10 sm:right-auto sm:bottom-10">
              <TempoBar />
            </div>
          ) : null}
        </div>
        <SplitHandle mapVh={mapVh} panelW={panelW} onSplit={setSplit} />
        <div
          className="flex min-h-0 min-w-0 w-full flex-1 flex-col sm:max-w-[48vw] sm:flex-none"
          style={stacked ? undefined : { width: panelW }}
        >
          <PortPanel />
        </div>
      </div>
      {phase === "event" && !helm && !trial ? <EventModal /> : null}
      {helm ? <HelmOverlay /> : null}
      {trial && !helm ? <CourtOverlay /> : null}
      <EtsModal />
      {settings ? <SettingsSheet /> : null}
      {locked || paywallOpen ? <Paywall blocking onLeaveToTitle={toTitle} /> : null}
    </div>
  );
}

function StatusBanners() {
  const s = useGame((g) => g.state);
  const setTab = useGame((g) => g.setTab);
  const ship = activeShip(s);
  const t = useT();
  if (s.phase === "event" || s.helm || s.trial) return null;
  const left = ship ? drydockLeft(ship, s.day) : 99;
  const bargeDays = ship ? bargeLeft(ship, s.day) : 0;
  const heat = s.heat ?? 0;
  const ddWarn = Boolean(ship) && left <= 40;
  const heatWarn = heat >= 16 || Boolean(s.probe);
  const etsWarn = Boolean(s.ets) || (s.etsAcc ?? 0) > 80;
  const bargeWarn = bargeDays > 0;
  const tcOverdue = (s.charters ?? []).some((c) => c.kind === "in" && s.day + 1e-6 >= c.untilDay);
  if (!ddWarn && !heatWarn && !etsWarn && !bargeWarn && !tcOverdue) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-border bg-surface px-3 py-1 text-xs">
      {bargeWarn ? (
        <span className="text-warn">{t("hud.barge", { n: bargeDays.toFixed(1) })}</span>
      ) : null}
      {tcOverdue ? <span className="text-warn">{t("tc.overdueLoad")}</span> : null}
      {ddWarn ? (
        <button
          type="button"
          className={left < 0 ? "text-danger underline" : "text-warn underline"}
          onClick={() => setTab("cargo")}
        >
          {t("hud.drydock", { n: Math.round(left) })}
        </button>
      ) : null}
      {heatWarn ? (
        <span className={heat >= 48 || s.probe ? "text-danger" : "text-warn"}>
          {maybeT(`heat.band.${heat >= 48 || s.probe ? "probe" : heat >= 32 ? "watch" : "rumor"}`)}
        </span>
      ) : null}
      {etsWarn ? <span className="text-warn">{t("ets.title")}</span> : null}
    </div>
  );
}
