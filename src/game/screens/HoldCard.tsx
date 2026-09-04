import { useT, type MsgKey } from "@/i18n";
import { portName } from "../data/ports";
import { destSummary, lotPay, remainingCeu, usedHh, activeShip, activeLeg } from "../fleet";
import { money, qty } from "../format";
import { useGame } from "../store";
import { cn } from "@/lib/utils";
import type { Lot } from "../types";

function kindLabel(l: Lot, t: (k: MsgKey) => string) {
  return t(`cargo.${l.kind}` as MsgKey);
}

export function HoldCard({ variant }: { variant: "bar" | "panel" }) {
  const s = useGame((g) => g.state);
  const t = useT();
  const ship = activeShip(s);
  if (!ship) return null;
  const used = ship.ceu - remainingCeu(ship);
  const free = remainingCeu(ship);
  const hhUsed = usedHh(ship);
  const dests = destSummary(ship.hold);
  const leg = activeLeg(s);
  const fill = ship.ceu > 0 ? Math.min(100, (used / ship.ceu) * 100) : 0;
  const hhFill = ship.hhCap > 0 ? Math.min(100, (hhUsed / ship.hhCap) * 100) : 0;

  return (
    <div
      className={cn(
        "border-b border-border bg-bg-elevated px-3 py-2 text-xs",
        variant === "panel" && "border-b-0 px-0 py-0",
      )}
    >
      <div className={cn("flex flex-wrap items-end gap-x-6 gap-y-2", variant === "panel" && "flex-col items-stretch gap-y-2")}>
        <div className="min-w-[12rem] flex-1">
          {leg ? (
            <p className="text-[10px] font-medium uppercase tracking-wider text-accent">
              {t("voyage.underway")} · {portName(leg.to)} · {qty(Math.round(Math.max(0, leg.nm - leg.travelled)))} nm
            </p>
          ) : (
            <p className="text-[10px] font-medium uppercase tracking-wider text-subtle">{t("hud.cargo")}</p>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="tabular-nums text-fg">
              {qty(used)}/{qty(ship.ceu)} CEU
            </span>
            <span className="text-muted">{t("hold.free", { n: qty(free) })}</span>
          </div>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface">
            <span className="block h-full bg-accent" style={{ width: `${fill}%` }} />
          </span>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-muted">
            <span>
              {t("hud.hh")} {qty(hhUsed)}/{qty(ship.hhCap)}
            </span>
          </div>
          {ship.hhCap > 0 ? (
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface">
              <span className="block h-full bg-warn" style={{ width: `${hhFill}%` }} />
            </span>
          ) : null}
        </div>

        <div className="min-w-[14rem] flex-[2]">
          {ship.hold.length === 0 ? (
            <p className="text-muted">{t("hold.empty")}</p>
          ) : (
            <ul className="space-y-1">
              {ship.hold.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {l.brand} · {kindLabel(l, t)}{" "}
                    <span className="text-accent">{t("hold.for", { port: portName(l.dest) })}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {qty(l.ceu)} · {money(lotPay(l))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {dests.length > 1 ? (
            <ul className="mt-1 space-y-0.5 text-muted">
              {dests.map((d) => (
                <li key={d.dest} className="flex justify-between gap-2">
                  <span>{t("hold.for", { port: portName(d.dest) })}</span>
                  <span className="tabular-nums">
                    {qty(d.ceu)} CEU · {money(d.pay)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
