import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, type MsgKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { useSocial } from "../social/store";

const PAGES: { title: MsgKey; body: MsgKey[] }[] = [
  { title: "guide.p0.title", body: ["guide.p0.a", "guide.p0.b"] },
  { title: "guide.p1.title", body: ["guide.p1.a", "guide.p1.b"] },
  { title: "guide.p2.title", body: ["guide.p2.a", "guide.p2.b"] },
  { title: "guide.p3.title", body: ["guide.p3.a", "guide.p3.b", "guide.p3.c"] },
];

export function HelpButton({ className }: { className?: string }) {
  const t = useT();
  const setGuide = useSocial((s) => s.setGuide);
  return (
    <button
      type="button"
      onClick={() => setGuide(true, 0)}
      className={cn("icon-btn", className)}
      aria-label={t("title.help")}
      title={t("title.help")}
    >
      <HelpCircle className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export function OnboardingGuide() {
  const t = useT();
  const page = useSocial((s) => s.guidePage);
  const setGuide = useSocial((s) => s.setGuide);
  const skipGuide = useSocial((s) => s.skipGuide);
  const finishGuide = useSocial((s) => s.finishGuide);
  const last = page >= PAGES.length - 1;
  const spec = PAGES[page] ?? PAGES[0]!;

  return (
    <div className="scrim fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="sheet panel relative w-full max-w-lg p-6">
        {page === 0 ? (
          <button type="button" onClick={skipGuide} className="link-quiet absolute right-3 top-3">
            {t("guide.skip")}
          </button>
        ) : (
          <button type="button" onClick={skipGuide} className="link-quiet absolute right-3 top-3">
            {t("guide.close")}
          </button>
        )}
        <p className="kicker">{t("guide.kicker")}</p>
        <p className="mt-1 text-xs text-subtle">
          {t("guide.step", { n: page + 1, of: PAGES.length })}
        </p>
        <h2 id="guide-title" className="mt-3 font-display text-2xl">
          {t(spec.title)}
        </h2>
        {spec.body.map((k) => (
          <p key={k} className="mt-3 text-sm text-muted">
            {t(k)}
          </p>
        ))}
        <div className="mt-5 flex gap-1" aria-hidden>
          {PAGES.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i === page ? "bg-accent" : "bg-border")} />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {page > 0 ? (
            <Button variant="secondary" onClick={() => setGuide(true, page - 1)}>
              {t("guide.back")}
            </Button>
          ) : null}
          {last ? (
            <Button className="flex-1" onClick={finishGuide}>
              {t("guide.done")}
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setGuide(true, page + 1)}>
              {t("guide.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
