/** App Store Connect non-consumable. Create this SKU before sandbox testing. */
export const FULL_UNLOCK_PRODUCT_ID = "com.fantasyshipping.app.full_unlock";

/** Client-side trial length. Unlock after this still requires a StoreKit transaction. */
export const TRIAL_DAYS = 14;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export const TRIAL_START_KEY = "fs-iap-trial-start";
export const UNLOCK_CACHE_KEY = "fs-iap-unlocked";
