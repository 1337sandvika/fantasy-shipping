import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { PORTS, portName } from "../data/ports";
import { remainingCeu, destSummary, shipLeg } from "../fleet";
import { qty } from "../format";
import { useGame } from "../store";

export function FleetBar() {
  const s = useGame((g) => g.state);
  const switchShip = useGame((g) => g.switchShip);
  const t = useT();
  if (!s.fleet.length) return null;
  return (
    <div className="flex min-w-0 w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain border-b border-border bg-bg-elevated px-2 py-1.5 sm:py-2">
      {s.fleet.map((sh) => {
        const on = sh.id === s.activeId;
        const leg = shipLeg(s, sh.id);
        const pct = leg && leg.nm > 0 ? Math.round((leg.travelled / leg.nm) * 100) : 0;
        const loc = sh.barge && s.day < sh.barge.eta
          ? t("fleet.barge", { port: PORTS.find((p) => p.id === sh.port)?.name ?? sh.port })
          : sh.atSea && leg
          ? t("fleet.atSea", { port: portName(leg.to), pct })
          : t("fleet.inPort", { port: PORTS.find((p) => p.id === sh.port)?.name ?? sh.port });
        const used = sh.ceu - remainingCeu(sh);
        const dests = destSummary(sh.hold);
        return (
          <button
            key={sh.id}
            type="button"
            onClick={() => switchShip(sh.id)}
            className={cn(
              "min-h-11 min-w-[9.5rem] shrink-0 rounded-md border px-2.5 py-1 text-left sm:min-w-[12rem] sm:px-3 sm:py-1.5",
              on ? "border-accent bg-surface" : "border-border bg-bg hover:border-muted",
            )}
          >
            <p className="truncate text-xs font-medium">
              M/V {sh.name}
              {sh.charter === "in" ? ` · ${t("fleet.tcIn")}` : sh.charter === "out" ? ` · ${t("fleet.tcOut")}` : ""}
            </p>
            <p className="truncate text-xs text-muted">
              {sh.charter === "out" ? t("fleet.tcOut") : loc}
            </p>
            <p className="tabular-nums text-[10px] text-subtle">
              {qty(used)}/{qty(sh.ceu)} CEU · {t("hold.free", { n: qty(remainingCeu(sh)) })}
            </p>
            {dests.length ? (
              <p className="hidden truncate text-[10px] text-accent sm:block">
                {dests.map((d) => t("hold.for", { port: portName(d.dest) }) + ` ${qty(d.ceu)}`).join(" · ")}
              </p>
            ) : (
              <p className="hidden truncate text-[10px] text-subtle sm:block">{t("hold.empty")}</p>
            )}
            {leg ? (
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface">
                <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TempoBar() {
  const tempo = useGame((g) => g.ui.tempo);
  const setTempo = useGame((g) => g.setTempo);
  const follow = useGame((g) => g.ui.follow);
  const atlas = useGame((g) => g.ui.atlas);
  const setFollow = useGame((g) => g.setFollow);
  const setAtlas = useGame((g) => g.setAtlas);
  const legs = useGame((g) => g.state.legs);
  const t = useT();
  const options: { n: 0 | 1 | 2 | 4 | 8; label: string }[] = [
    { n: 0, label: t("tempo.pause") },
    { n: 1, label: "1×" },
    { n: 2, label: "2×" },
    { n: 4, label: "4×" },
    { n: 8, label: "8×" },
  ];
  return (
    <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-elevated/90 p-0.5 sm:gap-1 sm:p-1">
        {options.map((o) => (
          <button
            key={o.n}
            type="button"
            onClick={() => setTempo(o.n)}
            className={cn(
              "min-h-10 min-w-10 rounded-md px-1.5 text-xs font-medium sm:px-2",
              tempo === o.n ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        ))}
        {legs.length > 0 && tempo === 0 ? (
          <span className="hidden px-1 text-[10px] uppercase tracking-wider text-warn sm:inline">{t("tempo.paused")}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-elevated/90 p-0.5 sm:gap-1 sm:p-1">
        <button
          type="button"
          onClick={() => setFollow(true)}
          className={cn(
            "min-h-10 rounded-md px-2 text-xs font-medium",
            follow ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
          )}
        >
          {t("map.follow")}
        </button>
        <button
          type="button"
          onClick={() => setAtlas("europe")}
          className={cn(
            "min-h-10 rounded-md px-2 text-xs font-medium",
            !follow && atlas === "europe" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
          )}
        >
          {t("map.europe")}
        </button>
        <button
          type="button"
          onClick={() => setAtlas("world")}
          className={cn(
            "min-h-10 rounded-md px-2 text-xs font-medium",
            !follow && atlas === "world" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
          )}
        >
          {t("map.world")}
        </button>
      </div>
    </div>
  );
}
