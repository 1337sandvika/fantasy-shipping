import { maybeT } from "@/i18n";
import { cn } from "@/lib/utils";
import { heatBand } from "../court";

export function HeatMeter({
  heat,
  probe = false,
  trial = false,
  compact = false,
}: {
  heat: number;
  probe?: boolean;
  trial?: boolean;
  compact?: boolean;
}) {
  const n = Math.max(0, Math.min(100, heat));
  const band = heatBand(n, probe, trial);
  const tone =
    band === "quiet" ? "bg-ok" : band === "rumor" ? "bg-warn" : band === "watch" ? "bg-warn" : "bg-danger";
  const label = maybeT(`heat.band.${band}`);
  return (
    <div className={cn("min-w-0", compact ? "flex items-center gap-2" : "space-y-1")}>
      <div
        className={cn("relative overflow-hidden rounded-sm border border-border bg-surface", compact ? "h-2 w-24" : "h-2.5 w-full")}
        role="meter"
        aria-valuenow={Math.round(n)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={cn("h-full", tone)} style={{ width: `${n}%` }} />
        <div className="pointer-events-none absolute inset-y-0 left-1/4 w-px bg-fg/20" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-fg/25" />
        <div className="pointer-events-none absolute inset-y-0 left-3/4 w-px bg-fg/20" />
      </div>
      <p className={cn("tabular-nums", compact ? "text-xs text-warn" : "text-xs text-muted")}>
        {label}
        {compact ? ` · ${Math.round(n)}` : ""}
      </p>
    </div>
  );
}
