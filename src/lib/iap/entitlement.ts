import { create } from "zustand";
import { deriveAccess, isUserCancel, transactionGrantsUnlock, trialSnapshot } from "./access";
import { ensureTrialStart, readTrialStart, readUnlockCache, writeUnlockCache } from "./persist";
import {
  isIosNative,
  listenForUnlock,
  purchaseFullUnlock,
  queryStore,
  restoreFullUnlock,
} from "./storekit";

export type IapState = {
  ready: boolean;
  gating: boolean;
  isUnlocked: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: number | null;
  canPlay: boolean;
  priceString: string | null;
  productTitle: string | null;
  billingSupported: boolean;
  busy: boolean;
  error: string | null;
  note: string | null;
  paywallOpen: boolean;
};

const idle: IapState = {
  ready: false,
  gating: false,
  isUnlocked: true,
  trialActive: false,
  trialDaysLeft: 0,
  trialEndsAt: null,
  canPlay: true,
  priceString: null,
  productTitle: null,
  billingSupported: false,
  busy: false,
  error: null,
  note: null,
  paywallOpen: false,
};

export const useIap = create<IapState>(() => ({ ...idle }));

function apply(partial: Partial<IapState> & { unlockedFromStore: boolean; gating: boolean }) {
  const { unlockedFromStore, ...rest } = partial;
  const trialStartedAt = rest.gating ? (readTrialStart() ?? ensureTrialStart()) : null;
  const access = deriveAccess({
    gating: rest.gating,
    unlockedFromStore,
    trialStartedAt,
  });
  useIap.setState({
    ...access,
    ...rest,
    paywallOpen: access.canPlay ? false : (rest.paywallOpen ?? useIap.getState().paywallOpen),
  });
}

export function refreshTrialClock(): void {
  const s = useIap.getState();
  if (!s.gating) return;
  apply({
    gating: true,
    unlockedFromStore: s.isUnlocked,
    ready: s.ready,
    priceString: s.priceString,
    productTitle: s.productTitle,
    billingSupported: s.billingSupported,
  });
}

let hydrating: Promise<void> | null = null;

export function hydrateIap(): Promise<void> {
  hydrating ??= doHydrate().finally(() => {
    hydrating = null;
  });
  return hydrating;
}

async function doHydrate(): Promise<void> {
  const gating = await isIosNative();
  if (!gating) {
    useIap.setState({ ...idle, ready: true, gating: false, isUnlocked: true, canPlay: true });
    return;
  }

  ensureTrialStart();
  apply({
    gating: true,
    unlockedFromStore: readUnlockCache(),
    ready: false,
  });

  try {
    const store = await queryStore();
    if (store.queried) writeUnlockCache(store.unlocked);
    apply({
      gating: true,
      unlockedFromStore: store.queried ? store.unlocked : readUnlockCache(),
      ready: true,
      priceString: store.priceString,
      productTitle: store.productTitle,
      billingSupported: store.billingSupported,
    });
  } catch {
    useIap.setState({ ready: true });
  }

  void listenForUnlock(() => {
    writeUnlockCache(true);
    apply({ gating: true, unlockedFromStore: true, ready: true, paywallOpen: false });
  });
}

export function openPaywall(): void {
  if (!useIap.getState().gating) return;
  useIap.setState({ paywallOpen: true, error: null, note: null });
}

export function closePaywall(): void {
  useIap.setState({ paywallOpen: false, error: null, note: null });
}

/** Run `fn` if the career is playable; otherwise open the paywall. */
export function requirePlay(fn: () => void): boolean {
  const s = useIap.getState();
  if (!s.gating || s.canPlay) {
    fn();
    return true;
  }
  openPaywall();
  return false;
}

export type PurchaseResult = "ok" | "cancel" | "fail";

export async function purchase(): Promise<PurchaseResult> {
  const s = useIap.getState();
  if (!s.gating) return "ok";
  if (s.busy) return "fail";
  useIap.setState({ busy: true, error: null, note: null });
  try {
    const tx = await purchaseFullUnlock();
    if (transactionGrantsUnlock(tx)) {
      writeUnlockCache(true);
      apply({ gating: true, unlockedFromStore: true, ready: true, busy: false, note: "unlocked" });
      return "ok";
    }
    const store = await queryStore();
    if (store.queried) writeUnlockCache(store.unlocked);
    apply({
      gating: true,
      unlockedFromStore: store.unlocked,
      ready: true,
      busy: false,
      priceString: store.priceString ?? s.priceString,
      productTitle: store.productTitle ?? s.productTitle,
      note: store.unlocked ? "unlocked" : null,
      error: store.unlocked ? null : "fail",
    });
    return store.unlocked ? "ok" : "fail";
  } catch (err) {
    if (isUserCancel(err)) {
      useIap.setState({ busy: false, error: null });
      return "cancel";
    }
    useIap.setState({ busy: false, error: "fail" });
    return "fail";
  }
}

export async function restore(): Promise<PurchaseResult> {
  const s = useIap.getState();
  if (!s.gating) return "ok";
  if (s.busy) return "fail";
  useIap.setState({ busy: true, error: null, note: null });
  try {
    const result = await restoreFullUnlock();
    if (result.queried) writeUnlockCache(result.unlocked);
    apply({
      gating: true,
      unlockedFromStore: result.unlocked,
      ready: true,
      busy: false,
      note: result.unlocked ? "restored" : null,
      error: result.unlocked ? null : "none",
    });
    return result.unlocked ? "ok" : "fail";
  } catch {
    useIap.setState({ busy: false, error: "fail" });
    return "fail";
  }
}

export function iapCanPlay(): boolean {
  const s = useIap.getState();
  if (!s.gating) return true;
  if (s.isUnlocked) return true;
  return trialSnapshot(readTrialStart()).trialActive;
}
