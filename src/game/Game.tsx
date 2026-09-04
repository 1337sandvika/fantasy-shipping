import { useEffect } from "react";
import { ChevronsDown, ChevronsUp, Settings } from "lucide-react";
import { useT } from "@/i18n";
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
import { TitleScreen } from "./screens/TitleScreen";
import { hydrateSaveFlag, useGame } from "./store";
import { setMuted } from "./audio";
import { activeShip, drydockLeft } from "./fleet";

const DAYS_PER_MIN = 12;

export function Game() {
  const phase = useGame((s) => s.state.phase);
  const settings = useGame((s) => s.ui.settings);
  const muted = useGame((s) => s.ui.muted);
  const mapHud = useGame((s) => s.ui.mapHud) !== false;
  const setSettings = useGame((s) => s.setSettings);
  const setMapHud = useGame((s) => s.setMapHud);
  const tick = useGame((s) => s.tick);
  const t = useT();

  useEffect(() => {
    hydrateSaveFlag();
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
        !g.ui.settings
      ) {
        const tempo = g.ui.tempo;
        if (tempo > 0 && g.state.legs.length) {
          tick((dt * DAYS_PER_MIN * tempo) / 60);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onHide = () => {
      const st = useGame.getState().state;
      if (st.phase !== "title") persist(st);
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

  return (
    <div className="safe-pad relative flex h-dvh min-h-0 flex-col overflow-hidden bg-bg text-fg">
      <HUD />
      <FleetBar />
      <div className="hidden sm:block">
        <HoldCard variant="bar" />
      </div>
      <StatusBanners />
      <div className="relative flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="relative h-[36vh] shrink-0 sm:h-auto sm:min-h-0 sm:flex-1">
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:w-[380px] sm:max-w-[42vw] sm:flex-none">
          <PortPanel />
        </div>
      </div>
      {phase === "event" ? <EventModal /> : null}
      <EtsModal />
      {settings ? <SettingsSheet /> : null}
    </div>
  );
}

function StatusBanners() {
  const s = useGame((g) => g.state);
  const ship = activeShip(s);
  const t = useT();
  if (s.phase === "event") return null;
  const left = ship ? drydockLeft(ship, s.day) : 99;
  const heat = s.heat ?? 0;
  const ddWarn = Boolean(ship) && left <= 40;
  const heatWarn = heat >= 22;
  const etsWarn = Boolean(s.ets) || (s.etsAcc ?? 0) > 80;
  if (!ddWarn && !heatWarn && !etsWarn) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-border bg-surface px-3 py-1 text-xs">
      {ddWarn ? (
        <span className={left < 0 ? "text-danger" : "text-warn"}>{t("hud.drydock", { n: Math.round(left) })}</span>
      ) : null}
      {heatWarn ? <span className="text-warn">{t("lot.grey")}</span> : null}
      {etsWarn ? <span className="text-warn">{t("ets.title")}</span> : null}
    </div>
  );
}
