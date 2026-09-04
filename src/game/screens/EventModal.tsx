import { Button } from "@/components/ui/button";
import { maybeT, useT, type MsgKey } from "@/i18n";
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
          <h2 className="mt-1 font-display text-2xl">{maybeT(ev.title)}</h2>
          <p className="mt-3 text-sm text-muted">{maybeT(ev.body)}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => choose(ev.a.id)}>
              {maybeT(ev.a.label)}
              <span className="ml-2 text-xs opacity-70">{maybeT(ev.a.hint)}</span>
            </Button>
            <Button variant="secondary" onClick={() => choose(ev.b.id)}>
              {maybeT(ev.b.label)}
              <span className="ml-2 text-xs opacity-70">{maybeT(ev.b.hint)}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
