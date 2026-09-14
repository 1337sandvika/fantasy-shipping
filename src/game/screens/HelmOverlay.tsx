// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { portName } from "../data/ports";
import { money, qty } from "../format";
import { activeShip } from "../fleet";
import {
  actionsFromKeys,
  helmWon,
  makeHarbor,
  pilotFee,
  spawnCraft,
  stepCraft,
  type HelmCraft,
  type HelmHit,
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
  const sink = useGame((g) => g.sinkHelm);
  const resolveWreck = useGame((g) => g.resolveWreck);
  const t = useT();
  const ship = helm ? s.fleet.find((x) => x.id === helm.shipId) ?? activeShip(s) : null;
  const [mode, setMode] = useState<"choice" | "play" | "crash" | "wreck">("choice");
  const fee = ship && helm ? Math.round(pilotFee(ship, helm.port, helm.kind, s.heat) * (helm.bump || mode === "crash" ? 1.35 : 1)) : 0;
  const dear = s.cash < fee;
  const lost = Boolean(helm?.lost);
  const wreckCeu = helm?.lostCeu ?? 0;
  const salvage = helm?.salvage ?? 0;
  const hullBill = helm?.hullBill ?? 0;
  const tcWreck = Boolean(helm?.tcWreck);
  const wreckBill = salvage + hullBill;
  const goingBroke = mode === "wreck" && s.cash < 0;

  useEffect(() => {
    setMode("choice");
  }, [helm?.kind, helm?.shipId, helm?.port]);

  if (!helm) return null;
  const title = helm.kind === "depart" ? t("helm.departTitle", { port: portName(helm.port) }) : t("helm.arriveTitle", { port: portName(helm.port) });
  const wreckTitle = tcWreck
    ? goingBroke ? "helm.lostTcBrokeTitle" : "helm.lostTcTitle"
    : lost ? "helm.lostTitle" : "helm.sinkTitle";
  const wreckBody = tcWreck
    ? goingBroke ? "helm.lostTcBrokeBody" : "helm.lostTcBody"
    : lost ? "helm.lostBody" : "helm.sinkBody";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
      {mode === "play" ? (
        <HelmCanvas
          helmKind={helm.kind}
          portId={helm.port}
          ship={ship ?? { ceu: 2000, condition: 80, name: helm.shipName ?? "\u2014" }}
          onWin={() => {
            blip(330, 0.12);
            finish();
          }}
          onCrash={(kind) => {
            if (kind === "sink") {
              foghorn();
              sink();
              setMode("wreck");
              return;
            }
            foghorn();
            scrape();
            setMode("crash");
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-bg-elevated p-5 shadow-panel">
            <p className="text-xs tracking-[0.2em] text-accent">{mode === "wreck" ? t("helm.wreckKicker") : t("helm.kicker")}</p>
            <h2 className="mt-1 font-display text-2xl">{mode === "wreck" ? t(wreckTitle) : mode === "crash" ? t("helm.crashTitle") : title}</h2>
            <p className="mt-3 text-sm text-muted">
              {mode === "wreck"
                ? t(wreckBody, {
                    name: helm.shipName ?? ship?.name ?? helm.shipId,
                    port: portName(helm.port),
                    n: money(wreckBill || salvage),
                    hull: money(hullBill),
                    salvage: money(salvage),
                    ceu: qty(wreckCeu),
                  })
                : mode === "crash"
                  ? t("helm.crashBody")
                  : helm.kind === "depart"
                    ? t("helm.departBody", { name: ship?.name ?? "" })
                    : t("helm.arriveBody", { name: ship?.name ?? "" })}
            </p>
            {mode !== "wreck" ? <p className="mt-2 text-xs text-subtle">{t("helm.controls")}</p> : null}
            <div className="mt-5 flex flex-col gap-2">
              {mode === "wreck" ? (
                <Button onClick={() => resolveWreck()}>{goingBroke ? t("helm.fileBroke") : t("helm.sinkContinue")}</Button>
              ) : (
                <>
                  <Button onClick={() => setMode("play")}>{mode === "crash" ? t("helm.retry") : t("helm.take")}</Button>
                  <Button variant="secondary" disabled={dear || !ship} onClick={() => hire()}>
                    {t("helm.pilot")}
                    <span className="ml-2 text-xs opacity-70">{dear ? t("helm.noCash") : money(fee)}</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
