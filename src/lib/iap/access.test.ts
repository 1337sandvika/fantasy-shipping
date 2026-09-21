import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveAccess,
  allowsMissingProductBypass,
  isProductUnavailable,
  isUserCancel,
  normalizeStoreChannel,
  purchasesGrantUnlock,
  shouldOfferContinueTesting,
  transactionGrantsUnlock,
  trialSnapshot,
} from "./access.ts";
import { FULL_UNLOCK_PRODUCT_ID, TRIAL_MS } from "./product.ts";

const DAY = 86_400_000;
const t0 = 1_700_000_000_000;

describe("trialSnapshot", () => {
  it("is inactive without a start timestamp", () => {
    assert.deepEqual(trialSnapshot(null, t0), {
      trialActive: false,
      trialDaysLeft: 0,
      trialEndsAt: null,
    });
  });

  it("counts 14 days at first launch", () => {
    const snap = trialSnapshot(t0, t0);
    assert.equal(snap.trialActive, true);
    assert.equal(snap.trialDaysLeft, 14);
    assert.equal(snap.trialEndsAt, t0 + TRIAL_MS);
  });

  it("still has one day left with a few hours remaining", () => {
    const snap = trialSnapshot(t0, t0 + TRIAL_MS - 3 * 60 * 60 * 1000);
    assert.equal(snap.trialActive, true);
    assert.equal(snap.trialDaysLeft, 1);
  });

  it("expires exactly at 14 days", () => {
    const snap = trialSnapshot(t0, t0 + TRIAL_MS);
    assert.equal(snap.trialActive, false);
    assert.equal(snap.trialDaysLeft, 0);
  });

  it("reports 13 days after just over one day", () => {
    const snap = trialSnapshot(t0, t0 + DAY + 1);
    assert.equal(snap.trialDaysLeft, 13);
  });
});

describe("deriveAccess", () => {
  it("leaves the web build fully playable without a trial clock", () => {
    const access = deriveAccess({
      gating: false,
      unlockedFromStore: false,
      trialStartedAt: null,
      now: t0,
    });
    assert.equal(access.canPlay, true);
    assert.equal(access.isUnlocked, true);
    assert.equal(access.trialActive, false);
  });

  it("allows play during the iOS trial", () => {
    const access = deriveAccess({
      gating: true,
      unlockedFromStore: false,
      trialStartedAt: t0,
      now: t0 + 3 * DAY,
    });
    assert.equal(access.canPlay, true);
    assert.equal(access.trialActive, true);
    assert.equal(access.isUnlocked, false);
  });

  it("blocks play after the trial unless StoreKit unlocked", () => {
    const locked = deriveAccess({
      gating: true,
      unlockedFromStore: false,
      trialStartedAt: t0,
      now: t0 + TRIAL_MS + 1,
    });
    assert.equal(locked.canPlay, false);
    const paid = deriveAccess({
      gating: true,
      unlockedFromStore: true,
      trialStartedAt: t0,
      now: t0 + TRIAL_MS + 1,
    });
    assert.equal(paid.canPlay, true);
    assert.equal(paid.isUnlocked, true);
  });
});

describe("StoreKit unlock", () => {
  it("requires the full-unlock product and a transaction id", () => {
    assert.equal(transactionGrantsUnlock({ productIdentifier: FULL_UNLOCK_PRODUCT_ID }), false);
    assert.equal(
      transactionGrantsUnlock({
        productIdentifier: "other.sku",
        transactionId: "1",
      }),
      false,
    );
    assert.equal(
      transactionGrantsUnlock({
        productIdentifier: FULL_UNLOCK_PRODUCT_ID,
        transactionId: "2000001",
      }),
      true,
    );
  });

  it("rejects refunded transactions", () => {
    assert.equal(
      transactionGrantsUnlock({
        productIdentifier: FULL_UNLOCK_PRODUCT_ID,
        transactionId: "2000001",
        revocationDate: "2026-01-01T00:00:00Z",
      }),
      false,
    );
  });

  it("scans a purchase list", () => {
    assert.equal(purchasesGrantUnlock([]), false);
    assert.equal(
      purchasesGrantUnlock([
        { productIdentifier: "x", transactionId: "1" },
        { productIdentifier: FULL_UNLOCK_PRODUCT_ID, transactionId: "2" },
      ]),
      true,
    );
  });
});

describe("isUserCancel", () => {
  it("treats StoreKit cancel codes as non-errors", () => {
    assert.equal(isUserCancel({ code: "1", message: "cancelled" }), true);
    assert.equal(isUserCancel(new Error("User cancelled the purchase")), true);
    assert.equal(isUserCancel({ code: "SKErrorPaymentCancelled" }), true);
    assert.equal(isUserCancel(new Error("network timeout")), false);
  });
});

describe("isProductUnavailable", () => {
  it("detects missing / waiting-for-review StoreKit products", () => {
    assert.equal(isProductUnavailable(new Error("Could not find product matching identifier")), true);
    assert.equal(isProductUnavailable(new Error("Cannot find product for id com.fantasyshipping.app.full_unlock")), true);
    assert.equal(isProductUnavailable({ code: "productNotAvailable" }), true);
    assert.equal(isProductUnavailable(new Error("network timeout")), false);
  });
});

describe("store channel", () => {
  it("normalizes AppTransaction environment strings", () => {
    assert.equal(normalizeStoreChannel("Sandbox"), "sandbox");
    assert.equal(normalizeStoreChannel("Production"), "production");
    assert.equal(normalizeStoreChannel("Xcode"), "xcode");
    assert.equal(normalizeStoreChannel(""), "unknown");
    assert.equal(normalizeStoreChannel(undefined), "unknown");
  });

  it("allows the free bypass only for TestFlight sandbox and Xcode", () => {
    assert.equal(allowsMissingProductBypass("sandbox"), true);
    assert.equal(allowsMissingProductBypass("xcode"), true);
    assert.equal(allowsMissingProductBypass("production"), false);
    assert.equal(allowsMissingProductBypass("unknown"), false);
  });
});

describe("shouldOfferContinueTesting", () => {
  const base = {
    gating: true,
    ready: true,
    isUnlocked: false,
    priceString: null as string | null,
    error: null as string | null,
    channel: "sandbox" as const,
  };

  it("shows on TestFlight when the product price failed to load", () => {
    assert.equal(shouldOfferContinueTesting(base), true);
  });

  it("shows on TestFlight when a purchase failed because the product is missing", () => {
    assert.equal(
      shouldOfferContinueTesting({ ...base, priceString: "$4.99", error: "unavailable" }),
      true,
    );
  });

  it("hides when the live App Store product loaded a price", () => {
    assert.equal(shouldOfferContinueTesting({ ...base, priceString: "$4.99" }), false);
  });

  it("hides on production and before the channel is known, even with a blank price", () => {
    assert.equal(shouldOfferContinueTesting({ ...base, channel: "production" }), false);
    assert.equal(shouldOfferContinueTesting({ ...base, channel: "unknown" }), false);
    assert.equal(
      shouldOfferContinueTesting({ ...base, channel: "production", priceString: "$4.99", error: "unavailable" }),
      false,
    );
  });

  it("hides on web (gating off) and before StoreKit is ready", () => {
    assert.equal(shouldOfferContinueTesting({ ...base, gating: false }), false);
    assert.equal(shouldOfferContinueTesting({ ...base, ready: false }), false);
    assert.equal(shouldOfferContinueTesting({ ...base, isUnlocked: true }), false);
  });
});

describe("renewed trial", () => {
  it("restores canPlay with an active trial and no StoreKit unlock", () => {
    const expired = deriveAccess({
      gating: true,
      unlockedFromStore: false,
      trialStartedAt: t0,
      now: t0 + TRIAL_MS + 1,
    });
    assert.equal(expired.canPlay, false);
    const renewedAt = t0 + TRIAL_MS + 1;
    const renewed = deriveAccess({
      gating: true,
      unlockedFromStore: false,
      trialStartedAt: renewedAt,
      now: renewedAt,
    });
    assert.equal(renewed.canPlay, true);
    assert.equal(renewed.trialActive, true);
    assert.equal(renewed.isUnlocked, false);
    assert.equal(renewed.trialDaysLeft, 14);
  });
});
