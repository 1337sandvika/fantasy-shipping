import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { maybeT, useT } from "@/i18n";
import { requirePlay } from "@/lib/iap";
import { portName } from "../data/ports";
import { activeShip, cheapestBuyPrice } from "../fleet";
import { money, qty } from "../format";
import type { HelmCrashCause, HelmHit } from "../helm";
import { pilotFee } from "../helm";
import { blip, foghorn } from "../audio";
import { useGame } from "../store";
import { wreckBranch } from "../wreck";
import { HelmCanvas } from "./HelmCanvas";
import { SinkSequence } from "./SinkSequence";

type Mode = "choice" | "play" | "crash" | "sinking" | "wreck";

export function HelmOverlay() {
  const helm = useGame((g) => g.state.helm);
  const s = useGame((g) => g.state);
  const hire = useGame((g) => g.hirePilot);
  const finish = useGame((g) => g.finishHelm);
  const scrape = useGame((g) => g.scrapeHelm);
  const sink = useGame((g) => g.sinkHelm);
  const resolveWreck = useGame((g) => g.resolveWreck);
  const start = useGame((g) => g.start);
  const t = useT();
  const navigate = useNavigate();
  const ship = helm ? (s.fleet.find((x) => x.id === helm.shipId) ?? activeShip(s)) : null;
  const [mode, setMode] = useState<Mode>(() => (helm?.wreck ? "sinking" : "choice"));
  const fee = ship && helm ? Math.round(pilotFee(ship, helm.port, helm.kind, s.heat) * (helm.bump || mode === "crash" ? 1.35 : 1)) : 0;
  const dear = s.cash < fee;
  const lost = Boolean(helm?.lost);
  const wreckCeu = helm?.lostCeu ?? 0;
  const salvage = helm?.salvage ?? 0;
  const hullBill = helm?.hullBill ?? 0;
  const tcWreck = Boolean(helm?.tcWreck);
  const wreckBill = salvage + hullBill;
  const branch = wreckBranch(s);
  const replacement = cheapestBuyPrice(s);

  useEffect(() => {
    setMode(helm?.wreck ? "sinking" : "choice");
  }, [helm?.kind, helm?.shipId, helm?.port]);

  if (!helm) return null;
  const title = helm.kind === "depart" ? t("helm.departTitle", { port: portName(helm.port) }) : t("helm.arriveTitle", { port: portName(helm.port) });
  const wreckTitle = lost
    ? branch === "broke"
      ? "wreck.broke.title"
      : "wreck.lost.title"
    : tcWreck
      ? "helm.lostTcTitle"
      : "helm.sinkTitle";
  const wreckBody = lost
    ? branch === "broke"
      ? "wreck.broke.body"
      : "wreck.lost.body"
    : tcWreck
      ? "helm.lostTcBody"
      : "helm.sinkBody";

  const cinematic = mode === "sinking" || mode === "wreck";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg text-fg select-none"
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none", userSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {mode === "play" ? (
        <HelmCanvas
          helmKind={helm.kind}
          portId={helm.port}
          ship={ship ?? { ceu: 2000, condition: 80, name: helm.shipName ?? "-" }}
          onHire={() => hire()}
          onWin={() => {
            blip(330, 0.12);
            finish();
          }}
          onCrash={(kind: Exclude<HelmHit, false>, cause?: HelmCrashCause) => {
            if (kind === "sink") {
              foghorn();
              sink(cause);
              setMode("sinking");
              return;
            }
            foghorn();
            scrape();
            setMode("crash");
          }}
        />
      ) : cinematic ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <SinkSequence playing={mode === "sinking"} onDone={() => setMode("wreck")} />
          {mode === "wreck" ? (
            <div className="scrim absolute inset-0 z-30 grid place-items-center p-4">
              <div className="sheet panel w-full max-w-lg overflow-hidden">
                <div className="p-5">
                  <p className="kicker">{t("wreck.kicker")}</p>
                  <h2 className="mt-1 font-display text-2xl">{maybeT(wreckTitle)}</h2>
                  <p className="mt-3 text-sm text-muted">
                    {maybeT(wreckBody, {
                      name: helm.shipName ?? ship?.name ?? helm.shipId,
                      port: portName(helm.port),
                      n: money(wreckBill || salvage),
                      hull: money(hullBill),
                      salvage: money(salvage),
                      ceu: qty(wreckCeu),
                    })}
                  </p>
                  {lost && tcWreck ? (
                    <p className="mt-2 text-xs italic text-subtle">
                      {maybeT(s.cash < 0 ? "helm.lostTcBrokeBody" : "helm.lostTcBody", {
                        name: helm.shipName ?? ship?.name ?? helm.shipId,
                        port: portName(helm.port),
                        n: money(wreckBill || salvage),
                        hull: money(hullBill),
                        salvage: money(salvage),
                        ceu: qty(wreckCeu),
                      })}
                    </p>
                  ) : null}
                  <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-2 text-xs">
                    <dt className="text-muted">{t("wreck.lost.saldo")}</dt>
                    <dd className={`tabular-nums ${s.cash < 0 ? "text-danger" : "text-fg"}`}>{money(s.cash)}</dd>
                    {lost && branch !== "broke" ? (
                      <>
                        <dt className="text-muted">{t("wreck.lost.replacement")}</dt>
                        <dd className="tabular-nums text-fg">{money(replacement)}</dd>
                      </>
                    ) : null}
                  </dl>
                  <div className="mt-5 flex flex-col gap-2">
                    {branch === "broke" ? (
                      <>
                        <Button onClick={() => requirePlay(() => start(s.company || s.captain, s.director || ""))}>
                          {t("wreck.broke.restart")}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            resolveWreck("broke");
                            void navigate({ to: "/scoreboard" });
                          }}
                        >
                          {t("wreck.broke.score")}
                        </Button>
                      </>
                    ) : branch === "buy" ? (
                      <>
                        <Button onClick={() => resolveWreck("yard")}>{t("wreck.lost.buy", { price: money(replacement) })}</Button>
                        <p className="text-center text-[11px] italic text-subtle">{t("wreck.lost.buyHint")}</p>
                        {s.fleet.length > 0 ? (
                          <Button variant="secondary" onClick={() => resolveWreck()}>
                            {t("wreck.lost.continue")}
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <Button onClick={() => resolveWreck()}>{t("wreck.lost.continue")}</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <div className="sheet panel w-full max-w-lg p-5">
            <p className="kicker">{t("helm.kicker")}</p>
            <h2 className="mt-1 font-display text-2xl">{mode === "crash" ? t("helm.crashTitle") : title}</h2>
            <p className="mt-3 text-sm text-muted">
              {mode === "crash"
                ? t("helm.crashBody")
                : helm.kind === "depart"
                  ? t("helm.departBody", { name: ship?.name ?? "" })
                  : t("helm.arriveBody", { name: ship?.name ?? "" })}
            </p>
            <p className="mt-2 text-xs text-subtle">{t("helm.controls")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => setMode("play")}>{mode === "crash" ? t("helm.retry") : t("helm.take")}</Button>
              <Button variant="secondary" disabled={dear || !ship} onClick={() => hire()}>
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
