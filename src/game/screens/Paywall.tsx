import { Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closePaywall, purchase, restore, useIap } from "@/lib/iap";
import { useT } from "@/i18n";

type Props = {
  /** In-career: must unlock or return to title. On the title screen, "Not now" is enough. */
  blocking?: boolean;
  onLeaveToTitle?: () => void;
};

export function Paywall({ blocking = false, onLeaveToTitle }: Props) {
  const t = useT();
  const { busy, error, note, priceString, productTitle, isUnlocked } = useIap();

  const priceLabel = priceString
    ? t("iap.unlock", { price: priceString })
    : t("iap.unlockFallback");

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iap-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-6 shadow-panel">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.22em] text-accent">
          <Anchor className="size-3.5" aria-hidden />
          {t("iap.kicker")}
        </p>
        <h2 id="iap-title" className="font-display text-2xl">
          {t("iap.paywallTitle")}
        </h2>
        <p className="mt-3 text-sm text-muted">{t("iap.paywallBlurb")}</p>
        {productTitle && priceString ? (
          <p className="mt-3 text-sm text-fg">
            {productTitle}
            <span className="text-muted"> · {priceString}</span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-subtle">{t("iap.pricePending")}</p>
        )}

        {note === "unlocked" || isUnlocked ? (
          <p className="mt-3 text-sm text-ok">{t("iap.unlocked")}</p>
        ) : note === "restored" ? (
          <p className="mt-3 text-sm text-ok">{t("iap.restored")}</p>
        ) : null}
        {error === "none" ? <p className="mt-3 text-sm text-warn">{t("iap.none")}</p> : null}
        {error === "fail" ? <p className="mt-3 text-sm text-danger">{t("iap.fail")}</p> : null}

        <div className="mt-5 flex flex-col gap-2">
          <Button disabled={busy || isUnlocked} onClick={() => void purchase()}>
            {busy ? t("iap.buying") : priceLabel}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void restore()}>
            {busy ? t("iap.restoring") : t("iap.restore")}
          </Button>
          {blocking ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                closePaywall();
                onLeaveToTitle?.();
              }}
            >
              {t("iap.toTitle")}
            </Button>
          ) : (
            <Button variant="ghost" disabled={busy} onClick={() => closePaywall()}>
              {t("iap.close")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TrialChip() {
  const t = useT();
  const { gating, ready, isUnlocked, trialActive, trialDaysLeft } = useIap();
  if (!gating || !ready || isUnlocked) return null;
  if (trialActive) {
    return (
      <p className="mt-3 max-w-md text-xs text-accent">
        {trialDaysLeft <= 1 ? t("iap.trialLeftOne") : t("iap.trialLeft", { n: trialDaysLeft })}
      </p>
    );
  }
  return <p className="mt-3 max-w-md text-xs text-warn">{t("iap.trialExpired")}</p>;
}
