import { Button } from "@/components/ui/button";
import { maybeT, useT, type MsgKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { eventArt } from "../data/art";
import { useGame } from "../store";

export function EventModal() {
  const ev = useGame((s) => s.state.event);
  const choose = useGame((s) => s.choose);
  const t = useT();
  if (!ev) return null;
  const art = eventArt(ev.id);
  const capKey = `event.cap.${ev.id}` as MsgKey;
  const cap = maybeT(capKey);
  const verdict = ev.id === "verdict";
  const aLabel = maybeT(ev.a.label, ev.vars);
  const aHint = maybeT(ev.a.hint, ev.vars);
  const bLabel = ev.b ? maybeT(ev.b.label, ev.vars) : "";
  const bHint = ev.b ? maybeT(ev.b.hint, ev.vars) : "";
  const showB = Boolean(ev.b) && ev.b!.id !== ev.a.id && `${bLabel}\0${bHint}` !== `${aLabel}\0${aHint}`;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/80 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-panel">
        {art ? (
          <div className="relative">
            <img
              src={art}
              alt=""
              className="aspect-video w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
            />
            {cap && cap !== capKey ? (
              <p className="absolute inset-x-0 bottom-0 bg-bg/80 px-3 py-2 text-xs italic text-fg">{cap}</p>
            ) : null}
          </div>
        ) : null}
        <div className="p-5">
          <p className="text-xs tracking-[0.2em] text-accent">{t("brand.hq")}</p>
          <h2 className="mt-1 font-display text-2xl">{maybeT(ev.title, ev.vars)}</h2>
          {verdict && ev.vars ? (
            <VerdictBrief vars={ev.vars} />
          ) : (
            <p className="mt-3 text-sm text-muted">{maybeT(ev.body, ev.vars)}</p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => choose(ev.a.id)}>
              {aLabel}
              <span className="ml-2 text-xs opacity-70">{aHint}</span>
            </Button>
            {showB ? (
              <Button variant="secondary" onClick={() => choose(ev.b!.id)}>
                {bLabel}
                <span className="ml-2 text-xs opacity-70">{bHint}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerdictBrief({ vars }: { vars: Record<string, string | number> }) {
  const verdict = String(vars.verdict ?? "guilty");
  const rows: [string, string][] = [
    ["court.row.stake", String(vars.stake ?? "—")],
    ["court.row.fine", String(vars.n ?? "—")],
    ["court.row.days", String(vars.days ?? 0)],
    ["court.row.seize", `${vars.ceu ?? 0} CEU`],
    ["court.row.heat", String(vars.heat ?? "—")],
    ["court.row.rep", String(vars.rep ?? "—")],
    ["court.row.cash", String(vars.cash ?? "—")],
  ];
  if (vars.credit) rows.push(["court.row.credit", String(vars.credit)]);
  return (
    <>
      <p className="mt-3 text-sm italic text-fg">{maybeT(`court.quote.${verdict}`)}</p>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-2 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{maybeT(k)}</dt>
            <dd className={cn("tabular-nums", k === "court.row.fine" || k === "court.row.credit" ? "text-danger" : "text-fg")}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted">{maybeT(`court.next.${verdict}`, vars)}</p>
      <p className="mt-2 text-sm italic text-muted">{maybeT(`event.verdict.body.${verdict}`, vars)}</p>
      {vars.credit ? <p className="mt-2 text-xs text-warn">{maybeT("court.next.credit")}</p> : null}
    </>
  );
}