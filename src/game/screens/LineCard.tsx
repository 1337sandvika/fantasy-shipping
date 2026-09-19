import { useT, type MsgKey } from "@/i18n";
import { honourLabel } from "../honour";
import { qty } from "../format";
import type { LineSnapshot } from "../social/types";
import { cn } from "@/lib/utils";

export function LineCard({
  snap,
  mine,
  compact,
}: {
  snap: LineSnapshot;
  mine?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <article className={cn("panel p-4", mine && "border-brass/50")}>
      <p className="kicker">{t("line.kicker")}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl">{snap.company || snap.handle}</h3>
        <p className="text-xs tabular-nums text-muted">
          {t("line.level", { n: snap.level })}
          {mine ? <span className="ml-2 text-accent">{t("board.you")}</span> : null}
        </p>
      </div>
      {snap.director ? <p className="mt-0.5 text-xs text-subtle">{t("end.director", { name: snap.director })}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
        <Stat label={t("end.points")} value={qty(snap.points)} />
        <Stat label={t("end.ceu")} value={`${qty(snap.deliveredCeu)} CEU`} />
        <Stat label={t("hud.rep")} value={String(snap.reputation)} />
        <Stat label={t("hud.fleet")} value={String(snap.fleetSize)} />
      </dl>
      {!compact && snap.onTimeStreak >= 2 ? (
        <p className="mt-2 text-xs text-accent">{t("hud.streak", { n: snap.onTimeStreak })}</p>
      ) : null}
      {snap.honours.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {snap.honours.slice(0, compact ? 3 : 6).map((h, i) => (
            <li key={`${h.kind}-${i}`} className="rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-[11px]">
              {honourLabel(h, t)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-subtle">{t("honour.empty")}</p>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

export function dailyTitle(
  slot: { id: string; target: number; port?: string },
  t: (k: MsgKey, v?: Record<string, string | number>) => string,
  port: (id: string) => string,
) {
  const key = `daily.${slot.id}` as MsgKey;
  return t(key, { n: slot.target, port: slot.port ? port(slot.port) : "" });
}
