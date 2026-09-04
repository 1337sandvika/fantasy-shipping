import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { countryName, maybeT, useT, type MsgKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { hullArt } from "../data/art";
import { PORTS, etsLabelKey, etsShare, getPort, lngPorts, portName } from "../data/ports";
import { HULLS, UPGRADES, hullById } from "../data/ships";
import {
  activeLeg,
  activeShip,
  burnPerKceu,
  burnPerNm,
  canLoadLot,
  canTakeLoan,
  cashTight,
  cheaperOffer,
  co2PerNm,
  destSummary,
  fromHull,
  fullTankRangeNm,
  hullValue,
  loanOffer,
  lotFitsDeck,
  lotInRange,
  lotPay,
  opexPerKceu,
  rangeNm,
  remainingCeu,
  remainingHh,
  suggestedDestId,
  usedHh,
  withUpgrade,
  bunkerPlanFor,
} from "../fleet";
import { daysLeft, money, qty, qty1, qty3 } from "../format";
import { inEurope } from "../geo";
import { seaRoute } from "../route";
import { useGame } from "../store";
import type { Lot, Ship, Tab } from "../types";

function lotKind(l: Lot, t: (k: MsgKey) => string) {
  return t(`cargo.${l.kind}` as MsgKey);
}

function etsTone(share: number) {
  if (share >= 1) return "text-muted";
  if (share > 0) return "text-warn";
  return "text-ok";
}

const MOODS = ["trade.mood.0", "trade.mood.1", "trade.mood.2", "trade.mood.3", "trade.mood.4", "trade.mood.5"] as const;

export function PortPanel() {
  const s = useGame((g) => g.state);
  const setTab = useGame((g) => g.setTab);
  const t = useT();
  const port = getPort(s.selectedPort);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabs: [Tab, string][] = [
    ["cargo", t("tab.cargo")],
    ["bunkers", t("tab.bunkers")],
    ["yard", t("tab.yard")],
    ["charter", t("tab.charter")],
    ["log", t("tab.log")],
  ];
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [s.selectedPort]);
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border bg-bg-elevated sm:border-l sm:border-t-0">
      <div className="border-b border-border px-3 py-2 sm:px-4 sm:py-3">
        {(() => {
          const ship = activeShip(s);
          const leg = activeLeg(s);
          return (
            <>
              <p className="text-[10px] font-medium tracking-[0.2em] text-accent">{ship ? `M/V ${ship.name}` : t("dock.call")}</p>
              <h2 className="font-display text-lg sm:text-xl">
                {leg ? (
                  <>
                    {t("voyage.underway")}{" "}
                    <span className="text-sm font-sans text-muted">
                      → {portName(leg.to)}
                      {getPort(leg.to).lng && ship?.fuel === "lng" ? ` · ${t("dock.lng")}` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    {port.name}{" "}
                    <span className="text-sm font-sans text-muted">
                      {countryName(port.country)}
                      {port.hub ? ` · ${t("dock.hub")}` : ""}
                      {port.yard ? ` · ${t("dock.yard")}` : ""}
                      {port.lng ? ` · ${t("dock.lng")}` : ""}
                    </span>
                  </>
                )}
              </h2>
            </>
          );
        })()}
      </div>
      <div className="flex gap-1 border-b border-border p-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("min-h-11 flex-1 rounded-md text-xs font-medium", s.tab === id ? "bg-surface text-fg" : "text-muted")}
          >
            {label}
          </button>
        ))}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {s.tab === "cargo" ? <CargoTab /> : null}
        {s.tab === "bunkers" ? <BunkerTab /> : null}
        {s.tab === "yard" ? <YardTab /> : null}
        {s.tab === "charter" ? <CharterTab /> : null}
        {s.tab === "log" ? <LogTab /> : null}
      </div>
    </div>
  );
}

function SailCard({
  destId,
  rec,
  picked,
  ship,
  sail,
  err,
  setErr,
}: {
  destId: string;
  rec: boolean;
  picked: boolean;
  ship: Ship;
  sail: (dest: string, full?: boolean) => string | null;
  err: string | null;
  setErr: (e: string | null) => void;
}) {
  const t = useT();
  const s = useGame((g) => g.state);
  const setTab = useGame((g) => g.setTab);
  const going = destSummary(ship.hold).find((d) => d.dest === destId);
  const plan = bunkerPlanFor(s, destId);
  const nm = Math.round(plan.nm || seaRoute(ship.port, destId).nm);
  const label = rec ? t("course.recommend") : picked ? t("course.picked") : t("course.suggested");
  const dest = getPort(destId);
  const share = etsShare(ship.port, destId);
  const blocked = plan.hullTooShort || plan.noLng || plan.noCash;
  const sailLabel =
    plan.extraTons >= 1 && plan.canFill
      ? t("course.sailFuel", { n: money(plan.cost) })
      : `${t("course.sail")} → ${portName(destId)}`;

  function go(full?: boolean) {
    if (blocked) {
      setErr(null);
      setTab("bunkers");
      return;
    }
    const e = sail(destId, full);
    setErr(e ? maybeT(e) : null);
  }

  return (
    <div className={cn("rounded-md border p-3", rec || picked ? "border-accent/40 bg-accent/10" : "border-border bg-surface")}>
      <p className="text-[10px] uppercase tracking-wider text-accent">{label}</p>
      <p className="font-medium">
        {portName(destId)}
        {dest.lng ? <span className="text-sm font-sans text-muted">{` · ${t("dock.lng")}`}</span> : null}
      </p>
      <p className="text-xs text-muted">
        {qty(nm)} nm
        {going ? ` · ${qty(going.ceu)} CEU · ${money(going.pay)}` : ""}
        {` · ${t("bunker.range", { n: qty(Math.round(rangeNm(ship))) })}`}
      </p>
      <p className={cn("text-xs", etsTone(share))}>{t(etsLabelKey(ship.port, destId))}</p>
      {plan.hullTooShort ? (
        <p className="mt-2 text-xs text-danger">{t("course.tooFar", { port: portName(destId) })}</p>
      ) : plan.noLng ? (
        <p className="mt-2 text-xs text-warn">{t("bunker.lngNone")}</p>
      ) : plan.noCash ? (
        <p className="mt-2 text-xs text-danger">{t("bunker.need", { tons: qty(Math.ceil(plan.extraTons)), port: portName(destId), nm: qty(nm) })}</p>
      ) : plan.extraTons >= 1 ? (
        <p className="mt-1 text-xs text-muted">{t("bunker.need", { tons: qty(Math.ceil(plan.extraTons)), port: portName(destId), nm: qty(nm) })}</p>
      ) : null}
      <div className="mt-2 flex gap-2">
        {plan.hullTooShort ? null : blocked ? (
          <Button className="flex-1" onClick={() => setTab("bunkers")}>
            {t("course.bunker")}
          </Button>
        ) : (
          <>
            <Button className="flex-1" onClick={() => go()}>
              {sailLabel}
            </Button>
            <Button variant="secondary" onClick={() => go(true)}>
              {t("voyage.full")}
            </Button>
          </>
        )}
      </div>
      {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}
    </div>
  );
}

function DistressCard() {
  const s = useGame((g) => g.state);
  const takeLoanAct = useGame((g) => g.takeLoan);
  const repayLoanAct = useGame((g) => g.repayLoan);
  const sell = useGame((g) => g.sell);
  const setTab = useGame((g) => g.setTab);
  const fileBankruptcy = useGame((g) => g.fileBankruptcy);
  const t = useT();
  const ship = activeShip(s);
  const tight = cashTight(s, ship);
  const debt = s.debt ?? 0;
  if (!tight && debt <= 0) return null;
  const offer = loanOffer(s);
  const canLoan = canTakeLoan(s);
  const sale = ship ? Math.round(hullValue(ship) * (ship.hold.length ? 0.92 : 1)) : 0;
  const canSell = Boolean(ship && !ship.atSea && !ship.charter);
  const cheap = ship ? cheaperOffer(s, ship) : null;
  return (
    <div className="rounded-md border border-danger/40 bg-danger/10 p-3">
      {tight ? (
        <>
          <p className="text-[10px] uppercase tracking-wider text-danger">{t("cash.tight")}</p>
          <p className="mt-1 text-sm text-muted">{t("cash.tightBody")}</p>
        </>
      ) : (
        <p className="text-[10px] uppercase tracking-wider text-warn">{t("hud.debt")}</p>
      )}
      {canLoan ? (
        <>
          <Button className="mt-2 w-full" onClick={takeLoanAct}>
            {t("cash.loan", { get: money(offer.principal), owe: money(offer.due) })}
          </Button>
          <p className="mt-1 text-[11px] text-subtle">{t("cash.loanHint")}</p>
        </>
      ) : null}
      {debt > 0 ? (
        <Button variant="secondary" className="mt-2 w-full" disabled={s.cash <= 0} onClick={repayLoanAct}>
          {t("cash.repay", { n: money(debt) })}
        </Button>
      ) : null}
      {ship && !ship.atSea ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted">
            {canSell
              ? ship.hold.length
                ? t("cash.sellDump", { name: ship.name, price: money(sale) })
                : t("cash.sellHint", { name: ship.name, price: money(sale) })
              : t("yard.sellTc")}
          </p>
          {cheap ? <p className="text-xs text-accent">{t("cash.cheaper", { name: cheap.name, price: money(cheap.price) })}</p> : null}
          <div className="mt-2 flex flex-col gap-2">
            {canSell ? (
              <Button variant="secondary" className="w-full" onClick={() => sell(ship.id)}>
                {t("cash.sellReady", { name: ship.name, price: money(sale) })}
              </Button>
            ) : null}
            <Button variant="ghost" className="w-full" onClick={() => setTab("yard")}>
              {t("cash.toYard")}
            </Button>
          </div>
        </div>
      ) : null}
      {tight ? (
        <div className="mt-3 border-t border-danger/20 pt-3">
          <Button variant="secondary" className="w-full border-danger/40 text-danger" onClick={fileBankruptcy}>
            {t("end.file")}
          </Button>
          <p className="mt-1 text-[11px] text-subtle">{t("end.fileHint")}</p>
        </div>
      ) : null}
    </div>
  );
}

function CargoTab() {
  const s = useGame((g) => g.state);
  const load = useGame((g) => g.load);
  const discharge = useGame((g) => g.discharge);
  const sail = useGame((g) => g.sail);
  const selectPort = useGame((g) => g.selectPort);
  const wait = useGame((g) => g.wait);
  const switchShip = useGame((g) => g.switchShip);
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const ship = activeShip(s);
  const lots = s.lots[s.selectedPort] ?? [];
  const dest = suggestedDestId(ship, ship ? (s.lots[ship.port] ?? []) : lots);
  const holdHere = ship?.hold.filter((l) => l.dest === ship.port) ?? [];
  const dests = ship ? destSummary(ship.hold) : [];
  const boardPay = ship ? ship.hold.reduce((a, l) => a + lotPay(l), 0) : 0;
  const duePay = holdHere.reduce((a, l) => a + lotPay(l), 0);
  const dueCeu = holdHere.reduce((a, l) => a + l.ceu, 0);
  const atSea = Boolean(ship?.atSea);
  const leg = activeLeg(s);
  const pickedAway = Boolean(ship && !atSea && s.selectedPort !== ship.port);
  const topDest = pickedAway ? s.selectedPort : dest;
  const otherDests = dests.filter((d) => d.dest !== ship?.port && d.dest !== topDest);
  const mood = MOODS[(s.seed >>> 0 || 1) % 6] ?? "trade.mood.0";
  return (
    <div className="space-y-4">
      {!ship ? <p className="text-sm text-warn">{t("hint.buy")}</p> : null}
      <DistressCard />
      <p className="text-xs italic text-subtle">{t(mood)}</p>
      {!pickedAway && ship && remainingCeu(ship) === ship.ceu && lots.length ? <p className="text-xs text-subtle">{t("hint.fill")}</p> : null}
      {!pickedAway && ship && lots.length && lots.filter((l) => !lotFitsDeck(ship, l)).length > lots.length * 0.5 ? (
        <p className="text-xs text-warn">{t("hint.tooSmall")}</p>
      ) : null}
      {atSea && leg ? (
        <div className="rounded-md border border-accent/30 bg-accent/10 p-3 text-sm">
          <p className="text-[10px] uppercase tracking-wider text-accent">{t("voyage.underway")}</p>
          <p className="mt-1 font-medium">
            {portName(leg.to)}
            {getPort(leg.to).lng && ship?.fuel === "lng" ? ` · ${t("dock.lng")}` : ""}
          </p>
          <p className="text-xs text-muted">
            {qty(Math.round(Math.max(0, leg.nm - leg.travelled)))} nm · {qty(Math.max(0, leg.eta - s.day))} d ·{" "}
            {leg.fullRevs ? t("voyage.full") : t("voyage.normal")}
          </p>
          <p className={cn("text-xs", etsTone(etsShare(leg.from, leg.to)))}>{t(etsLabelKey(leg.from, leg.to))}</p>
        </div>
      ) : null}
      {atSea && s.fleet.some((sh) => !sh.atSea) ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-subtle">{t("fleet.others")}</p>
          {s.fleet
            .filter((sh) => !sh.atSea)
            .map((sh) => (
              <Button key={sh.id} variant="secondary" className="w-full" onClick={() => switchShip(sh.id)}>
                {t("fleet.operate")} M/V {sh.name} · {portName(sh.port)}
              </Button>
            ))}
        </div>
      ) : null}
      {!pickedAway && holdHere.length && ship && !atSea ? (
        <Button className="w-full" onClick={discharge}>
          {t("act.discharge")} · {qty(dueCeu)} CEU · {money(duePay)}
        </Button>
      ) : !pickedAway && ship && !atSea && ship.hold.length && getPort(ship.port).hub ? (
        <Button className="w-full" variant="secondary" onClick={discharge}>
          {t("act.transship")}
        </Button>
      ) : null}
      {ship && !atSea && topDest ? (
        <SailCard destId={topDest} rec={topDest === dest} picked={pickedAway} ship={ship} sail={sail} err={err} setErr={setErr} />
      ) : null}
      {ship && !atSea && otherDests.length ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-accent">{t("course.cargoDest")}</p>
          {otherDests
            .sort((a, b) => Number(b.dest === dest) - Number(a.dest === dest))
            .map((d) => (
              <SailCard key={d.dest} destId={d.dest} rec={d.dest === dest} picked={false} ship={ship} sail={sail} err={err} setErr={setErr} />
            ))}
        </div>
      ) : null}
      {ship?.hold.length ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-subtle">{t("hud.cargo")}</p>
          <ul className="mt-1 space-y-1">
            {ship.hold.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span>
                  {l.brand} · {lotKind(l, t)} → {portName(l.dest)}
                  {l.hh > 0 ? ` · ${t("lot.hh", { n: qty(l.hh) })}` : ""}
                  {l.grey ? ` · ${t("lot.grey")}` : ""}
                  {l.contract ? ` · ${t("lot.contract")}` : ""}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted">
                  {qty(l.ceu)} · <span className="text-accent">{money(lotPay(l))}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t("cargo.onBoard", { n: money(boardPay) })}</p>
          {dests.length > 1 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-subtle">
              {dests.map((d) => (
                <li key={d.dest} className="flex justify-between">
                  <span>{portName(d.dest)}</span>
                  <span className="tabular-nums">
                    {qty(d.ceu)} CEU · {money(d.pay)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {!atSea ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-subtle">{t("tab.cargo")}</p>
          <ul className="mt-2 space-y-2">
            {[...lots]
              .sort((a, b) => {
                const loadable = (l: Lot) => (ship ? canLoadLot(ship, l) : false);
                const score = (l: Lot) =>
                  (loadable(l) ? 20 : 0) + (l.grey ? 3 : 0) + (l.kind === "hh" ? 2 : 0) + (l.contract ? 1 : 0) + l.rate / 2e3;
                return score(b) - score(a);
              })
              .map((l) => {
                const can = ship && canLoadLot(ship, l) && ship.port === s.selectedPort;
                const hhBlock = Boolean(ship && remainingHh(ship) < (l.hh ?? 0));
                const ceuBlock = Boolean(ship && remainingCeu(ship) < l.ceu);
                const farBlock = Boolean(ship && !lotInRange(ship, l.dest));
                const nm = Math.round(seaRoute(l.origin, l.dest).nm);
                return (
                  <li
                    key={l.id}
                    className={cn(
                      "rounded-md border px-3 py-2",
                      l.grey ? "border-warn/50 bg-warn/10" : l.kind === "hh" ? "border-accent/40 bg-accent/10" : "border-border bg-surface",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {l.brand} · {lotKind(l, t)} · {qty(l.ceu)} CEU
                        </p>
                        <p className="mt-0.5 font-mono text-sm tabular-nums text-accent">{money(lotPay(l))}</p>
                      </div>
                      <Button size="sm" disabled={!can} onClick={() => load(l.id)}>
                        {hhBlock ? t("lot.noHh") : ceuBlock ? t("lot.noCeu") : farBlock ? t("lot.tooFar") : t("act.load")}
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {portName(l.origin)} →{" "}
                      <button type="button" className="text-accent hover:underline" onClick={() => selectPort(l.dest)}>
                        {portName(l.dest)}
                      </button>{" "}
                      · {qty(nm)} nm · {money(l.rate)}
                      /CEU
                      {l.hh > 0 ? ` · ${t("lot.hh", { n: qty(l.hh) })}` : ""}
                      {l.contract ? ` · ${t("lot.contract")} · ${daysLeft(l.deadline, s.day)}` : ""}
                      {l.grey ? ` · ${t("lot.greyPay")}` : ""}
                    </p>
                    {l.note ? <p className="mt-1 text-[11px] italic text-subtle">{maybeT(`lot.note.${l.note}`)}</p> : null}
                    {ship && !can && (hhBlock || ceuBlock || farBlock) ? (
                      <p className="mt-1 text-[11px] text-danger">
                        {farBlock
                          ? t("lot.needRange", { need: qty(nm), have: qty(Math.round(fullTankRangeNm(ship))) })
                          : hhBlock
                            ? t("lot.needHh", { need: qty(l.hh), have: qty(ship.hhCap) })
                            : t("lot.needCeu", { need: qty(l.ceu), have: qty(ship.ceu) })}
                      </p>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}
      {!atSea ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-subtle">{t("course.title")}</p>
          {(["europe", "world"] as const).map((band) => {
            const list = PORTS.filter((p) => p.id !== s.selectedPort && (band === "europe") === inEurope(p.lon, p.lat));
            if (!list.length) return null;
            return (
              <div key={band} className="mt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">{band === "europe" ? t("course.europe") : t("course.world")}</p>
                <div className="flex flex-wrap gap-1">
                  {list.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPort(p.id)}
                      className={cn(
                        "min-h-10 rounded-md bg-surface px-2 text-xs hover:text-fg",
                        p.lng && ship?.fuel === "lng" ? "text-ok" : "text-muted",
                      )}
                    >
                      {p.name}
                      {p.lng && ship?.fuel === "lng" ? ` · ${t("dock.lng")}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {!atSea ? (
        <Button variant="ghost" className="w-full text-xs" onClick={wait}>
          {t("last.wait")}
        </Button>
      ) : null}
    </div>
  );
}

function BunkerTab() {
  const s = useGame((g) => g.state);
  const bunker = useGame((g) => g.bunker);
  const selectPort = useGame((g) => g.selectPort);
  const setTab = useGame((g) => g.setTab);
  const t = useT();
  const ship = activeShip(s);
  if (!ship) return <p className="text-sm text-muted">{t("hud.noShip")}</p>;
  const port = getPort(ship.port);
  const room = Math.max(0, ship.bunkerCap - ship.bunkers);
  const price = ship.fuel === "lng" ? port.bunker * 0.85 : port.bunker;
  const blocked = ship.fuel === "lng" && !port.lng;
  const afford = price > 0 ? Math.floor(s.cash / price) : 0;
  const fill80 = Math.min(80, room, afford);
  const fillAll = Math.min(room, afford);
  const range = rangeNm(ship);
  const dest = s.selectedPort !== ship.port ? s.selectedPort : suggestedDestId(ship, s.lots[ship.port] ?? []);
  const need = dest ? burnPerNm(ship) * seaRoute(ship.port, dest).nm * 1.08 : 0;
  const atSea = ship.atSea;
  const broke = s.cash < 0 || (fill80 < 10 && room >= 10 && !blocked && !atSea);
  const lngList =
    ship.fuel === "lng"
      ? lngPorts()
          .filter((p) => p.id !== ship.port)
          .map((p) => ({ p, nm: seaRoute(ship.port, p.id).nm }))
          .sort((a, b) => a.nm - b.nm)
          .slice(0, 8)
      : [];
  return (
    <div className="space-y-3">
      <DistressCard />
      {broke ? <p className="text-sm text-danger">{t("bunker.noCash")}</p> : null}
      <p className="text-sm">
        {qty(ship.bunkers)} / {qty(ship.bunkerCap)} t {ship.fuel.toUpperCase()}
      </p>
      <p className="text-xs text-muted">
        {blocked ? "—" : `${money(price)} / t`} · {t("bunker.range", { n: qty(Math.round(range)) })} · {qty1(burnPerNm(ship))} t/nm
      </p>
      {ship.fuel === "lng" ? (
        blocked ? (
          <p className="text-sm text-warn">{t("bunker.lngNone")}</p>
        ) : (
          <p className="text-sm text-ok">{t("bunker.lngHere")}</p>
        )
      ) : null}
      {dest && need > 0 ? (
        <p className="text-xs text-muted">
          {t("bunker.need", { tons: qty(Math.ceil(need)), port: portName(dest), nm: qty(Math.round(seaRoute(ship.port, dest).nm)) })}
        </p>
      ) : null}
      <Button disabled={blocked || fill80 < 10 || atSea} className="w-full" onClick={() => bunker(fill80)}>
        {t("bunker.fill80", { n: money(Math.round(fill80 * price)) })}
      </Button>
      <Button variant="secondary" disabled={blocked || fillAll < 10 || atSea} className="w-full" onClick={() => bunker(fillAll)}>
        {t("bunker.fillTank", { n: money(Math.round(fillAll * price)) })}
      </Button>
      {lngList.length ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-subtle">{t("bunker.lngWhere")}</p>
          <ul className="mt-2 space-y-1">
            {lngList.map(({ p, nm }) => {
              const inRange = range >= nm * 1.08;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-left text-xs hover:text-fg"
                    onClick={() => {
                      selectPort(p.id);
                      setTab("cargo");
                    }}
                  >
                    <span className="font-medium text-fg">{t("bunker.lngGo", { name: p.name, nm: qty(Math.round(nm)) })}</span>
                    <span className={inRange ? "text-ok" : "text-warn"}>{inRange ? t("bunker.inRange") : t("bunker.outRange")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function YardTab() {
  const s = useGame((g) => g.state);
  const buy = useGame((g) => g.buy);
  const buyOffer = useGame((g) => g.buyOffer);
  const sell = useGame((g) => g.sell);
  const switchShip = useGame((g) => g.switchShip);
  const rename = useGame((g) => g.rename);
  const repair = useGame((g) => g.repair);
  const drydock = useGame((g) => g.drydock);
  const upgrade = useGame((g) => g.upgrade);
  const t = useT();
  const [ren, setRen] = useState("");
  const [sellId, setSellId] = useState<string | null>(null);
  const ship = activeShip(s);
  const repairCost = ship ? Math.round((100 - ship.condition) * 2800) : 0;
  const cheapId = ship && cashTight(s, ship) ? cheaperOffer(s, ship)?.id : null;
  const tight = cashTight(s, ship);
  return (
    <div className="space-y-5">
      <DistressCard />
      {s.fleet.length ? (
        <ul className="space-y-2">
          {s.fleet.map((sh) => {
            const val = Math.round(hullValue(sh) * (sh.hold.length ? 0.92 : 1));
            const canSell = !sh.atSea && !sh.charter;
            const asking = sellId === sh.id;
            const dump = sh.hold.length > 0;
            return (
              <li key={sh.id} className="overflow-hidden rounded-md border border-border bg-surface">
                <img src={hullArt(sh.hullId)} alt="" className="aspect-[16/7] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        M/V {sh.name}
                        {sh.charter === "in" ? ` · ${t("tc.inBadge")}` : sh.charter === "out" ? ` · ${t("tc.outBadge")}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {sh.year} · {qty(sh.ceu)} CEU · {t("hud.hh")} {qty(sh.hhCap)} · {sh.fuel.toUpperCase()} · {t("yard.opex", { n: qty(sh.opex) })}
                      </p>
                      <p className="text-xs text-subtle">
                        {t("hud.condition")} {Math.round(sh.condition)}% · {t("yard.sale", { n: money(val) })}
                      </p>
                    </div>
                    {sh.id === s.activeId ? (
                      <span className="text-xs text-accent">{t("yard.active")}</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => switchShip(sh.id)}>
                        {t("yard.switch")}
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={asking || (tight && canSell) ? "secondary" : "ghost"}
                    className="mt-2 w-full"
                    disabled={!canSell}
                    onClick={() => {
                      if (!asking) {
                        setSellId(sh.id);
                        return;
                      }
                      sell(sh.id);
                      setSellId(null);
                    }}
                  >
                    {sh.charter
                      ? t("yard.sellTc")
                      : sh.atSea
                        ? t("yard.sellSea")
                        : asking
                          ? t("yard.sellConfirm", { n: money(val) })
                          : dump
                            ? t("yard.sellDump", { n: money(val) })
                            : `${t("yard.sell")} · ${money(val)}`}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {ship ? (
        <div className="space-y-2">
          <label className="block text-xs text-muted">
            {t("yard.rename")}
            <div className="mt-1 flex gap-2">
              <input
                value={ren}
                onChange={(e) => setRen(e.target.value)}
                maxLength={28}
                className="min-h-11 flex-1 rounded-md border border-border bg-surface px-3 text-sm"
              />
              <Button variant="secondary" onClick={() => rename(ship.id, ren)}>
                {t("yard.save")}
              </Button>
            </div>
          </label>
          <div className="flex gap-2">
            <Button className="flex-1" variant="secondary" disabled={ship.atSea || ship.condition >= 99} onClick={repair}>
              {t("yard.repair")}
              {ship.condition < 99 ? ` · ${money(repairCost)}` : ""}
            </Button>
            <Button className="flex-1" variant="secondary" disabled={ship.atSea || !getPort(ship.port).yard} onClick={drydock}>
              {t("yard.drydock")}
            </Button>
          </div>
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
            <p className="text-[10px] uppercase tracking-wider text-subtle">{t("yard.stats")}</p>
            <p className="mt-1 tabular-nums text-muted">
              {t("hud.burn")} {qty3(burnPerNm(ship))} t/nm · {t("hud.co2nm")} {qty3(co2PerNm(ship))} t/nm
            </p>
            <p className="tabular-nums text-muted">
              {t("yard.eff", { n: qty(Math.round(burnPerKceu(ship) * 1e3)) })} · {t("yard.ceuDay", { n: qty(Math.round(opexPerKceu(ship))) })}
            </p>
            <p className="tabular-nums text-muted">
              {t("hud.hh")} {qty(usedHh(ship))}/{qty(ship.hhCap)} · {t("bunker.range", { n: qty(Math.round(rangeNm(ship))) })}
            </p>
            <p className="text-subtle">
              {ship.fuel.toUpperCase()}
              {ship.fuel === "lng" ? ` · ${t("upg.lngHint")}` : ` · ${t("upg.mgoHint")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {UPGRADES.map((u) => {
              const fitted = (ship.upgrades ?? []).includes(u.id);
              const next = withUpgrade(ship, u.id);
              const burn0 = burnPerNm(ship);
              const burn1 = burnPerNm(next);
              const co20 = co2PerNm(ship);
              const co21 = co2PerNm(next);
              const burnDelta = burn1 < burn0 - 5e-4;
              const co2Delta = co21 < co20 - 5e-4;
              const hhDelta = next.hhCap > ship.hhCap;
              const iceDelta = next.ice && !ship.ice;
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={fitted || s.cash < u.cost || ship.atSea}
                  onClick={() => upgrade(u.id)}
                  className={cn(
                    "min-h-11 max-w-[16rem] rounded-md border px-3 py-2 text-left text-xs",
                    fitted ? "border-accent/40 bg-accent/10 text-fg" : "border-border bg-surface text-fg disabled:opacity-50",
                  )}
                >
                  <p className="font-medium">
                    {t(`upg.${u.id}` as MsgKey)}
                    {fitted ? ` · ${t("yard.fitted")}` : ` · ${money(u.cost)}`}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{t(`upg.${u.id}.hint` as MsgKey)}</p>
                  {!fitted && (burnDelta || co2Delta || hhDelta || iceDelta) ? (
                    <p className="mt-1 text-[11px] leading-snug tabular-nums text-accent">
                      {burnDelta ? `${t("upg.deltaBurn", { from: qty3(burn0), to: qty3(burn1) })} ` : ""}
                      {co2Delta ? `${t("upg.deltaCo2", { from: qty3(co20), to: qty3(co21) })} ` : ""}
                      {hhDelta ? t("upg.deltaHh", { from: qty(ship.hhCap), to: qty(next.hhCap) }) : ""}
                      {iceDelta ? t("upg.iceGain") : ""}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-subtle">{t("yard.buy")}</p>
        <p className="mt-1 text-xs text-subtle">{t("yard.buyHint")}</p>
        <ul className="mt-2 space-y-2">
          {HULLS.map((h) => {
            const dear = s.cash < h.price;
            return (
              <li key={h.id} className="overflow-hidden rounded-md border border-border bg-surface">
                <img src={hullArt(h.id)} alt="" className="aspect-[16/7] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                <div className="flex items-start justify-between gap-2 px-3 py-3">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-muted">
                      {h.year} · {qty(h.ceu)} CEU · {t("hud.hh")} {qty(h.hhCap)} · {h.fuel.toUpperCase()}
                      {h.ice ? " · ice" : ""}
                    </p>
                    <p className="text-xs italic text-subtle">{t(`hull.${h.id}` as MsgKey)}</p>
                    <p className="mt-1 font-mono text-sm">{money(h.price)}</p>
                  </div>
                  <Button disabled={dear} onClick={() => buy(h.id)}>
                    {dear ? t("yard.tooDear") : s.fleet.length ? t("yard.buyAnother") : t("yard.buyOne")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-subtle">{t("yard.market")}</p>
        <p className="mt-1 text-xs text-subtle">{t("yard.marketHint")}</p>
        <ul className="mt-2 space-y-2">
          {(s.market ?? []).map((o) => {
            const h = hullById(o.hullId);
            const dear = s.cash < o.price;
            const sample = h ? fromHull(h, o.condition) : null;
            return (
              <li key={o.id} className={cn("overflow-hidden rounded-md border bg-surface", cheapId === o.id ? "border-accent/50" : "border-border")}>
                <img src={hullArt(o.hullId)} alt="" className="aspect-[16/7] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                <div className="flex items-start justify-between gap-2 px-3 py-3">
                  <div>
                    <p className="font-medium">M/V {o.name}</p>
                    <p className="text-xs text-muted">
                      {o.year} · {h ? `${qty(h.ceu)} CEU · ${t("hud.hh")} ${qty(h.hhCap)} · ${h.fuel.toUpperCase()}` : ""}
                      {h?.ice ? " · ice" : ""} · {t("hud.condition")} {Math.round(o.condition)}%
                    </p>
                    {sample ? (
                      <p className="text-xs text-subtle">
                        {t("hud.burn")} {qty3(burnPerNm(sample))} t/nm · {t("hud.co2nm")} {qty3(co2PerNm(sample))} t/nm ·{" "}
                        {t("yard.eff", { n: qty(Math.round(burnPerKceu(sample) * 1e3)) })}
                      </p>
                    ) : null}
                    {h ? (
                      <p className="text-xs text-subtle">
                        {t("yard.opex", { n: qty(h.opex) })} · {t("yard.ceuDay", { n: qty(Math.round(opexPerKceu(fromHull(h, o.condition)))) })}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-sm">{money(o.price)}</p>
                    {cheapId === o.id ? <p className="mt-1 text-xs text-accent">{t("cash.cheaper", { name: o.name, price: money(o.price) })}</p> : null}
                  </div>
                  <Button disabled={dear} onClick={() => buyOffer(o.id)}>
                    {dear ? t("yard.tooDear") : s.fleet.length ? t("yard.buyAnother") : t("yard.buyOne")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {!(s.market ?? []).length ? <p className="mt-2 text-xs text-muted">{t("yard.marketEmpty")}</p> : null}
      </div>
    </div>
  );
}

function CharterTab() {
  const s = useGame((g) => g.state);
  const hireIn = useGame((g) => g.hireIn);
  const hireOut = useGame((g) => g.hireOut);
  const switchShip = useGame((g) => g.switchShip);
  const t = useT();
  const charters = s.charters ?? [];
  const offers = s.tc ?? [];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-subtle">{t("tc.title")}</p>
        <p className="mt-1 text-sm text-muted">{t("tc.blurb")}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-subtle">{t("tc.your")}</p>
        <ul className="mt-2 space-y-2">
          {s.fleet.map((sh) => {
            const ch = charters.find((c) => c.shipId === sh.id);
            const canOut = !sh.atSea && sh.hold.length === 0 && !sh.charter;
            const left = ch ? Math.max(0, Math.ceil(ch.untilDay - s.day)) : 0;
            return (
              <li key={sh.id} className="overflow-hidden rounded-md border border-border bg-surface">
                <img src={hullArt(sh.hullId)} alt="" className="aspect-[16/7] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                <div className="px-3 py-3">
                  <p className="text-sm font-medium">M/V {sh.name}</p>
                  {ch ? (
                    <p className="mt-1 text-xs text-accent">
                      {ch.kind === "in" ? t("tc.paying", { n: money(ch.rate), d: left }) : t("tc.earning", { n: money(ch.rate), d: left })}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">{t("yard.opex", { n: qty(sh.opex) })}</p>
                  )}
                  {canOut ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Button variant="secondary" onClick={() => hireOut(sh.id, 14)}>
                        {t("tc.fix14")}
                      </Button>
                      <Button variant="secondary" onClick={() => hireOut(sh.id, 21)}>
                        {t("tc.fix21")}
                      </Button>
                      <Button onClick={() => hireOut(sh.id, 30)}>{t("tc.fix30")}</Button>
                    </div>
                  ) : null}
                  {!canOut && !ch ? (
                    <p className="mt-2 text-[11px] text-subtle">{sh.atSea ? t("tc.needPort") : sh.hold.length ? t("tc.needEmpty") : t("tc.needFree")}</p>
                  ) : null}
                  {sh.id !== s.activeId ? (
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => switchShip(sh.id)}>
                      {t("yard.switch")}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {!s.fleet.length ? <p className="mt-2 text-xs text-muted">{t("tc.noFleet")}</p> : null}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-subtle">{t("tc.market")}</p>
        <p className="mt-1 text-xs text-subtle">{t("tc.marketHint")}</p>
        <ul className="mt-2 space-y-2">
          {offers.map((o) => {
            const h = hullById(o.hullId);
            const deposit = o.rate * 7;
            const dear = s.cash < deposit;
            return (
              <li key={o.id} className="overflow-hidden rounded-md border border-border bg-surface">
                <img src={hullArt(o.hullId)} alt="" className="aspect-[16/7] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                <div className="flex items-start justify-between gap-2 px-3 py-3">
                  <div>
                    <p className="font-medium">M/V {o.name}</p>
                    {o.owner ? <p className="text-[11px] text-subtle">{t("tc.owner", { n: o.owner })}</p> : null}
                    <p className="text-xs text-muted">
                      {o.year} · {h ? `${qty(h.ceu)} CEU · ${t("hud.hh")} ${qty(h.hhCap)} · ${h.fuel.toUpperCase()}` : ""} · {t("hud.condition")}{" "}
                      {Math.round(o.condition)}%
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-accent">{t("tc.rateDays", { n: money(o.rate), d: o.days })}</p>
                    <p className="text-xs text-subtle">{t("tc.deposit", { n: money(deposit) })}</p>
                  </div>
                  <Button disabled={dear} onClick={() => hireIn(o.id)}>
                    {dear ? t("yard.tooDear") : t("tc.hire")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {!offers.length ? <p className="mt-2 text-xs text-muted">{t("tc.empty")}</p> : null}
      </div>
    </div>
  );
}

function LogTab() {
  const log = useGame((g) => g.state.log);
  const news = useGame((g) => g.state.news);
  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-xs text-muted">
        {news.map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
      <ol className="space-y-2">
        {log.map((l, i) => (
          <li key={i} className="text-sm">
            <span className="font-mono text-xs text-subtle">{Math.round(l.day)}d</span> {l.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
