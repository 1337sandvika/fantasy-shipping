import { TRIAL_START_KEY, UNLOCK_CACHE_KEY } from "./product";

/**
 * Persistence rules (iOS WKWebView localStorage — same store as the career save):
 *
 * - `fs-iap-trial-start`: first-launch timestamp (ms). Written once; never moved
 *   forward. Deleting the app or wiping WebView data starts a new trial.
 * - `fs-iap-unlocked`: cache of a StoreKit-confirmed unlock (`"1"`). Used to
 *   avoid a paywall flash. Source of truth is always StoreKit
 *   (`getPurchases` / the purchase transaction). A cache of `"1"` is revoked
 *   when StoreKit successfully reports no current entitlement.
 * - Web never writes these keys (gating is off).
 */

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTrialStart(): number | null {
  const raw = storage()?.getItem(TRIAL_START_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function ensureTrialStart(now = Date.now()): number {
  const existing = readTrialStart();
  if (existing) return existing;
  storage()?.setItem(TRIAL_START_KEY, String(now));
  return now;
}

export function readUnlockCache(): boolean {
  return storage()?.getItem(UNLOCK_CACHE_KEY) === "1";
}

export function writeUnlockCache(unlocked: boolean): void {
  const s = storage();
  if (!s) return;
  if (unlocked) s.setItem(UNLOCK_CACHE_KEY, "1");
  else s.removeItem(UNLOCK_CACHE_KEY);
}
