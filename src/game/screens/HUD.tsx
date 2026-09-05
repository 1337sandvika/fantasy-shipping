import { useT } from "@/i18n";
import { formatDate, money, qty, qty3 } from "../format";
import { activeLeg, activeShip, remainingCeu, destSummary, burnPerNm, co2PerNm } from "../fleet";
import { portName } from "../data/ports";
import { useGame } from "../store";

export function HUD() {
  const s = useGame((g) => g.state);
  const ship = activeShip(s);
  const leg = activeLeg(s);
  const t = useT();
  const etsEst = Math.round(s.etsAcc * 80);
  return (
    <header className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border bg-bg-elevated/95 px-3 py-1.5 text-xs sm:gap-x-4 sm:py-2">
      <p className="max-w-44 truncate font-display text-sm tracking-wide text-accent" title={s.company || s.captain || t("brand.short")}>
        {s.company || s.captain || t("brand.short")}
      </p>
      <p className="tabular-nums text-muted">{formatDate(s.day)}</p>
      <p className="tabular-nums text-muted">
        {t("hud.cash")}{" "}
        <span className={s.cash < 0 ? "text-danger" : "text-fg"}>{money(s.cash)}</span>
      </p>
      {(s.debt ?? 0) > 0 ? (
        <p className="tabular-nums text-warn">
          {t("hud.debt")} <span>{money(s.debt)}</span>
        </p>
      ) : null}
      <p className="hidden tabular-nums text-muted sm:block">
        {t("hud.rep")} <span className="text-fg">{s.reputation}</span>
      </p>
      <p className="hidden tabular-nums text-muted sm:block">
        {t("hud.co2")} <span className="text-fg">{qty(s.co2t)} t</span>
      </p>
      {etsEst > 0 ? (
        <p className="hidden tabular-nums text-muted sm:block">
          {t("hud.ets")} <span className={etsEst > 8000 ? "text-warn" : "text-fg"}>{money(etsEst)}</span>
        </p>
      ) : null}
      {ship ? (
        <p className="hidden tabular-nums text-muted sm:block">
          {t("hud.burn")} <span className="text-fg">{qty3(burnPerNm(ship))}</span>
          <span className="text-subtle"> {t("hud.perNm")}</span>
        </p>
      ) : null}
      {ship ? (
        <p className="hidden tabular-nums text-muted sm:block">
          {t("hud.co2nm")} <span className="text-fg">{qty3(co2PerNm(ship))}</span>
          <span className="text-subtle"> {t("hud.perNm")}</span>
        </p>
      ) : null}
      {s.heat >= 10 ? (
        <p className="hidden tabular-nums text-warn sm:block">
          {t("hud.heat")} {s.heat}
        </p>
      ) : null}
      {(s.onTimeStreak ?? 0) >= 2 ? (
        <p className="hidden tabular-nums text-accent sm:block">{t("hud.streak", { n: s.onTimeStreak })}</p>
      ) : null}
      {(s.preferred ?? []).length ? (
        <p className="hidden max-w-40 truncate tabular-nums text-accent sm:block" title={(s.preferred ?? []).join(", ")}>
          {t("hud.preferred", { n: s.preferred.length })}
        </p>
      ) : null}
      {s.fleet.length > 1 ? (
        <p className="hidden tabular-nums text-muted sm:block">
          {t("hud.fleet")} <span className="text-fg">{s.fleet.length}</span>
        </p>
      ) : null}
      {!ship ? <p className="text-warn">{t("hud.noShip")}</p> : null}
      {ship ? (
        <p className="hidden tabular-nums text-muted sm:block">
          {t("hud.cargo")}{" "}
          <span className="text-fg">
            {qty(ship.ceu - remainingCeu(ship))}/{qty(ship.ceu)}
          </span>
          <span className="text-subtle"> · {t("hold.free", { n: qty(remainingCeu(ship)) })}</span>
        </p>
      ) : null}
      {ship
        ? destSummary(ship.hold).map((d) => (
            <p key={d.dest} className="hidden tabular-nums text-accent sm:block">
              {t("hold.for", { port: portName(d.dest) })} {qty(d.ceu)} CEU
            </p>
          ))
        : null}
      {leg ? <p className="text-accent">{t("hud.bound", { port: portName(leg.to) })}</p> : null}
    </header>
  );
}
