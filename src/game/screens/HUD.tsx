import { useT } from "@/i18n";
import { formatDate, money, qty, qty3 } from "../format";
import { activeLeg, activeShip, remainingCeu, destSummary, burnPerNm, co2PerNm } from "../fleet";
import { portName } from "../data/ports";
import { useGame } from "../store";
import { HeatMeter } from "./HeatMeter";

export function HUD() {
  const s = useGame((g) => g.state);
  const ship = activeShip(s);
  const leg = activeLeg(s);
  const t = useT();
  const etsEst = Math.round(s.etsAcc * 80);
  return (
    <header className="hud-bar">
      <p className="max-w-44 truncate font-display text-[0.95rem] tracking-wide text-brass" title={s.company || s.captain || t("brand.short")}>
        {s.company || s.captain || t("brand.short")}
      </p>
      <p className="hud-stat tabular-nums text-muted">{formatDate(s.day)}</p>
      <p className="hud-stat tabular-nums text-muted">
        {t("hud.cash")}{" "}
        <span className={s.cash < 0 ? "text-danger" : "text-fg"}>{money(s.cash)}</span>
      </p>
      {(s.debt ?? 0) > 0 ? (
        <p className="hud-stat tabular-nums text-warn">
          {t("hud.debt")} <span>{money(s.debt)}</span>
        </p>
      ) : null}
      <p className="hud-stat hidden tabular-nums text-muted sm:inline-flex">
        {t("hud.rep")} <span className="text-fg">{s.reputation}</span>
      </p>
      <p className="hud-stat hidden tabular-nums text-muted sm:inline-flex">
        {t("hud.co2")} <span className="text-fg">{qty(s.co2t)} t</span>
      </p>
      {etsEst > 0 ? (
        <p className="hud-stat hidden tabular-nums text-muted sm:inline-flex">
          {t("hud.ets")} <span className={etsEst > 8000 ? "text-warn" : "text-fg"}>{money(etsEst)}</span>
        </p>
      ) : null}
      {ship ? (
        <p className="hud-stat hidden tabular-nums text-muted sm:inline-flex">
          {t("hud.burn")} <span className="text-fg">{qty3(burnPerNm(ship))}</span>
          <span className="text-subtle"> {t("hud.perNm")}</span>
        </p>
      ) : null}
      {ship ? (
        <p className="hud-stat hidden tabular-nums text-muted sm:inline-flex">
          {t("hud.co2nm")} <span className="text-fg">{qty3(co2PerNm(ship))}</span>
          <span className="text-subtle"> {t("hud.perNm")}</span>
        </p>
      ) : null}
      {s.heat >= 1 || s.probe || (ship?.hold.some((l) => l.grey) ?? false) ? (
        <div className="hud-stat" title={t("hud.heatHint", { n: s.heat })}>
          <HeatMeter heat={s.heat} probe={s.probe} trial={Boolean(s.trial)} compact />
        </div>
      ) : null}
      {(s.onTimeStreak ?? 0) >= 2 ? (
        <p className="hud-stat hidden tabular-nums text-accent sm:inline-flex">{t("hud.streak", { n: s.onTimeStreak })}</p>
      ) : null}
      {(s.preferred ?? []).length ? (
        <p className="hud-stat hidden max-w-40 truncate tabular-nums text-accent sm:inline-flex" title={(s.preferred ?? []).join(", ")}>
          {t("hud.preferred", { n: s.preferred.length })}
        </p>
      ) : null}
      {s.fleet.length > 1 ? (
        <p className="hud-stat hidden tabular-nums text-muted sm:inline-flex">
          {t("hud.fleet")} <span className="text-fg">{s.fleet.length}</span>
        </p>
      ) : null}
      {!ship ? <p className="hud-stat text-warn">{t("hud.noShip")}</p> : null}
      {ship ? (
        <p className="hud-stat hidden tabular-nums text-muted sm:inline-flex">
          {t("hud.cargo")}{" "}
          <span className="text-fg">
            {qty(ship.ceu - remainingCeu(ship))}/{qty(ship.ceu)}
          </span>
          <span className="text-subtle"> · {t("hold.free", { n: qty(remainingCeu(ship)) })}</span>
        </p>
      ) : null}
      {ship
        ? destSummary(ship.hold).map((d) => (
            <p key={d.dest} className="hud-stat hidden tabular-nums text-accent sm:inline-flex">
              {t("hold.for", { port: portName(d.dest) })} {qty(d.ceu)} CEU
            </p>
          ))
        : null}
      {leg ? <p className="hud-stat text-accent">{t("hud.bound", { port: portName(leg.to) })}</p> : null}
    </header>
  );
}
