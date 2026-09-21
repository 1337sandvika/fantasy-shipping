import { FULL_UNLOCK_PRODUCT_ID, TRIAL_MS } from "./product.ts";

export type TrialSnapshot = {
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: number | null;
};

export type AccessInput = {
  /** Native iOS only. Web and Android stay ungated. */
  gating: boolean;
  unlockedFromStore: boolean;
  trialStartedAt: number | null;
  now?: number;
};

export type Access = TrialSnapshot & {
  isUnlocked: boolean;
  canPlay: boolean;
};

export function trialSnapshot(startedAt: number | null, now = Date.now()): TrialSnapshot {
  if (startedAt == null || !Number.isFinite(startedAt) || startedAt <= 0) {
    return { trialActive: false, trialDaysLeft: 0, trialEndsAt: null };
  }
  const trialEndsAt = startedAt + TRIAL_MS;
  const leftMs = trialEndsAt - now;
  if (leftMs <= 0) {
    return { trialActive: false, trialDaysLeft: 0, trialEndsAt };
  }
  return {
    trialActive: true,
    trialDaysLeft: Math.max(1, Math.ceil(leftMs / 86_400_000)),
    trialEndsAt,
  };
}

/** Web: no StoreKit, no trial clock — the hosted game stays free. */
export function deriveAccess(input: AccessInput): Access {
  const now = input.now ?? Date.now();
  if (!input.gating) {
    return {
      isUnlocked: true,
      trialActive: false,
      trialDaysLeft: 0,
      trialEndsAt: null,
      canPlay: true,
    };
  }
  const trial = trialSnapshot(input.trialStartedAt, now);
  return {
    isUnlocked: input.unlockedFromStore,
    ...trial,
    canPlay: input.unlockedFromStore || trial.trialActive,
  };
}

export type StoreTransaction = {
  productIdentifier?: string;
  transactionId?: string;
  revocationDate?: string | null;
};

/** Unlock only from a current StoreKit transaction for the full-unlock SKU. */
export function transactionGrantsUnlock(
  tx: StoreTransaction | null | undefined,
  productId: string = FULL_UNLOCK_PRODUCT_ID,
): boolean {
  if (!tx) return false;
  if (tx.productIdentifier !== productId) return false;
  if (tx.revocationDate) return false;
  return Boolean(tx.transactionId);
}

export function purchasesGrantUnlock(
  purchases: readonly StoreTransaction[] | null | undefined,
  productId: string = FULL_UNLOCK_PRODUCT_ID,
): boolean {
  return Boolean(purchases?.some((tx) => transactionGrantsUnlock(tx, productId)));
}

export function isUserCancel(err: unknown): boolean {
  const code =
    typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/cancel/i.test(code) || /cancel/i.test(msg)) return true;
  // StoreKit SKError.paymentCancelled
  return code === "1" || code === "SKErrorPaymentCancelled";
}

/** StoreKit / plugin errors when the IAP SKU is missing or still Waiting for Review. */
export function isProductUnavailable(err: unknown): boolean {
  const code =
    typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const blob = `${code} ${msg}`;
  if (
    /productNotAvailable|ITEM_UNAVAILABLE|store_product_not_available|SKErrorStoreProductNotAvailable/i.test(
      blob,
    )
  ) {
    return true;
  }
  return /cannot find product|product not found|product.+(not found|unavailable|invalid|missing)|invalid product|could not find.*product|no products?|empty-products/i.test(
    blob,
  );
}

/**
 * Where this binary is talking to StoreKit.
 * - `sandbox`: TestFlight (and App Review, which uses the same sandbox)
 * - `xcode`: local Products.storekit
 * - `production`: App Store customers
 * - `unknown`: AppTransaction has not resolved yet
 */
export type StoreChannel = "sandbox" | "production" | "xcode" | "unknown";

export function normalizeStoreChannel(raw: string | null | undefined): StoreChannel {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "sandbox") return "sandbox";
  if (value === "production") return "production";
  if (value === "xcode") return "xcode";
  return "unknown";
}

/**
 * Free "continue testing" is only for builds where the SKU is expected to be
 * absent: TestFlight sandbox and the Xcode StoreKit config. Production
 * customers, and any launch where we have not confirmed a sandbox channel,
 * must see the real purchase / retry / restore path instead of a free skip.
 */
export function allowsMissingProductBypass(channel: StoreChannel): boolean {
  return channel === "sandbox" || channel === "xcode";
}

export type ContinueTestingInput = {
  gating: boolean;
  ready: boolean;
  isUnlocked: boolean;
  priceString: string | null;
  error: string | null;
  channel: StoreChannel;
};

/**
 * Native iOS only, and only on TestFlight / Xcode while the full-unlock SKU
 * has no live price or a purchase already failed as missing.
 * App Review and production keep the purchase button, retry, and restore.
 */
export function shouldOfferContinueTesting(input: ContinueTestingInput): boolean {
  if (!input.gating || !input.ready || input.isUnlocked) return false;
  if (!allowsMissingProductBypass(input.channel)) return false;
  if (!input.priceString) return true;
  return input.error === "unavailable";
}
