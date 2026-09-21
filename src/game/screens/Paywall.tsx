import { Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  closePaywall,
  continueTesting,
  purchase,
  refreshStore,
  restore,
  shouldOfferContinueTesting,
  useIap,
} from "@/lib/iap";
import { useT } from "@/i18n";

type Props = {
  /** In-career: must unlock or return to title. On the title screen, "Not now" is enough. */
  blocking?: boolean;
  onLeaveToTitle?: () => void;
};

export function Paywall({ blocking = false, onLeaveToTitle }: Props) {
  const t = useT();
  const { busy, error, note, priceString, productTitle, isUnlocked, gating, ready, channel } = useIap();

  const priceLabel = priceString
    ? t("iap.unlock", { price: priceString })
    : t("iap.unlockFallback");
  const offerTesting = shouldOfferContinueTesting({
    gating,
    ready,
    isUnlocked,
    priceString,
    error,
    channel,
  });
  const missingPrice = ready && !priceString && !isUnlocked;

  return (
    <div
      className="scrim absolute inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iap-title"
    >
      <div className="safe-pad flex min-h-full items-center justify-center p-4">
      <div className="sheet panel my-auto w-full max-w-md p-6">
        <p className="mb-2 flex items-center gap-2 kicker">
          <Anchor className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t("iap.kicker")}
        </p>
        <h2 id="iap-title" className="font-display text-2xl">
          {t("iap.paywallTitle")}
        </h2>
        <p className="mt-3 text-sm text-muted">{t("iap.paywallBlurb")}</p>
        {!ready ? <p className="mt-3 text-xs text-subtle">{t("iap.pricePending")}</p> : null}
        {productTitle && priceString ? (
          <p className="mt-3 text-sm text-fg">
            {productTitle}
            <span className="text-muted"> · {priceString}</span>
          </p>
        ) : null}
        {missingPrice && error !== "unavailable" && error !== "fail" && error !== "none" ? (
          <p className="mt-3 text-sm text-warn">{t("iap.loadFailed")}</p>
        ) : null}

        {note === "unlocked" || isUnlocked ? (
          <p className="mt-3 text-sm text-ok">{t("iap.unlocked")}</p>
        ) : note === "restored" ? (
          <p className="mt-3 text-sm text-ok">{t("iap.restored")}</p>
        ) : null}
        {note === "testing" ? <p className="mt-3 text-sm text-ok">{t("iap.testing")}</p> : null}
        {error === "none" ? <p className="mt-3 text-sm text-warn">{t("iap.none")}</p> : null}
        {error === "fail" ? <p className="mt-3 text-sm text-danger">{t("iap.fail")}</p> : null}
        {error === "unavailable" ? (
          <p className="mt-3 text-sm text-warn">{t("iap.unavailable")}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <Button disabled={busy || !ready || isUnlocked} onClick={() => void purchase()}>
            {busy ? t("iap.buying") : !ready ? t("iap.pricePending") : priceLabel}
          </Button>
          {missingPrice ? (
            <Button variant="secondary" disabled={busy} onClick={() => void refreshStore()}>
              {t("iap.retry")}
            </Button>
          ) : null}
          {offerTesting ? (
            <>
              <p className="text-xs text-subtle">{t("iap.continueTestingHint")}</p>
              <Button variant="secondary" disabled={busy} onClick={() => continueTesting()}>
                {t("iap.continueTesting")}
              </Button>
            </>
          ) : null}
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
