import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { money, qty } from "../format";
import { useGame } from "../store";

export function EtsModal() {
  const ets = useGame((s) => s.state.ets);
  const pay = useGame((s) => s.payEts);
  const t = useT();
  if (!ets) return null;
  const amount = ets.t * ets.price;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-5 shadow-panel">
        <h2 className="font-display text-2xl">{t("ets.title")}</h2>
        <p className="mt-3 text-sm text-muted">{t("ets.body", { t: ets.t, price: ets.price, amount: money(amount) })}</p>
        {ets.ships.length ? (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {ets.ships.map((sh) => (
              <li key={sh.name} className="flex justify-between gap-3">
                <span>M/V {sh.name}</span>
                <span className="tabular-nums">
                  {qty(sh.t)} t · {money(sh.t * ets.price)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <Button className="mt-5 w-full" onClick={pay}>
          {t("ets.pay")}
        </Button>
      </div>
    </div>
  );
}
