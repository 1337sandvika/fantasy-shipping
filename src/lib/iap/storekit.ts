import type { PluginListenerHandle } from "@capacitor/core";
import { FULL_UNLOCK_PRODUCT_ID } from "./product";
import {
  normalizeStoreChannel,
  purchasesGrantUnlock,
  transactionGrantsUnlock,
  type StoreChannel,
  type StoreTransaction,
} from "./access";

export type StoreQuery = {
  unlocked: boolean;
  queried: boolean;
  billingSupported: boolean;
  priceString: string | null;
  productTitle: string | null;
  channel: StoreChannel;
  /** Set when the catalog request failed or returned no full-unlock product. */
  loadError: string | null;
};

const PRODUCT_ATTEMPTS = 3;
const PRODUCT_TIMEOUT_MS = 8_000;

type NativePurchasesApi = {
  isBillingSupported: () => Promise<{ isBillingSupported: boolean }>;
  getProducts: (opts: {
    productIdentifiers: string[];
    productType?: string;
  }) => Promise<{ products: Array<{ identifier: string; title: string; priceString: string }> }>;
  getPurchases: (opts?: {
    productType?: string;
    onlyCurrentEntitlements?: boolean;
  }) => Promise<{ purchases: StoreTransaction[] }>;
  purchaseProduct: (opts: {
    productIdentifier: string;
    productType?: string;
  }) => Promise<StoreTransaction>;
  restorePurchases: () => Promise<void>;
  getAppTransaction?: () => Promise<{
    appTransaction?: { environment?: string | null };
  }>;
  addListener: (
    event: "transactionUpdated",
    fn: (tx: StoreTransaction) => void,
  ) => Promise<PluginListenerHandle>;
};

let listener: PluginListenerHandle | null = null;

export async function isIosNative(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

async function loadPlugin(): Promise<{
  NativePurchases: NativePurchasesApi;
  PURCHASE_TYPE: { INAPP: string };
}> {
  const { NativePurchases, PURCHASE_TYPE } = await import("@capgo/native-purchases");
  return { NativePurchases: NativePurchases as unknown as NativePurchasesApi, PURCHASE_TYPE };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function queryStore(): Promise<StoreQuery> {
  const empty: StoreQuery = {
    unlocked: false,
    queried: false,
    billingSupported: false,
    priceString: null,
    productTitle: null,
    channel: "unknown",
    loadError: "plugin",
  };
  try {
    const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();
    let billingSupported = false;
    try {
      billingSupported = Boolean((await NativePurchases.isBillingSupported()).isBillingSupported);
    } catch {
      billingSupported = false;
    }

    const [catalog, channel, unlocked] = await Promise.all([
      loadFullUnlockProduct(NativePurchases, PURCHASE_TYPE.INAPP),
      readStoreChannel(NativePurchases),
      withTimeout(readUnlockFromStore(NativePurchases, PURCHASE_TYPE.INAPP), 8_000).catch(() => ({
        unlocked: false,
        queried: false,
      })),
    ]);

    return {
      unlocked: unlocked.unlocked,
      queried: unlocked.queried,
      billingSupported,
      priceString: catalog.priceString,
      productTitle: catalog.productTitle,
      channel,
      loadError: catalog.priceString ? null : catalog.loadError,
    };
  } catch (err) {
    return { ...empty, loadError: err instanceof Error ? err.message : "plugin" };
  }
}

async function loadFullUnlockProduct(
  NativePurchases: NativePurchasesApi,
  productType: string,
): Promise<{ priceString: string | null; productTitle: string | null; loadError: string | null }> {
  let loadError: string | null = "empty-products";
  for (let attempt = 0; attempt < PRODUCT_ATTEMPTS; attempt++) {
    try {
      const { products } = await withTimeout(
        NativePurchases.getProducts({
          productIdentifiers: [FULL_UNLOCK_PRODUCT_ID],
          productType,
        }),
        PRODUCT_TIMEOUT_MS,
      );
      const product = products.find((p) => p.identifier === FULL_UNLOCK_PRODUCT_ID) ?? products[0];
      const priceString = product?.priceString?.trim() || null;
      const productTitle = product?.title?.trim() || null;
      if (priceString) return { priceString, productTitle, loadError: null };
      loadError = "empty-products";
    } catch (err) {
      loadError = err instanceof Error ? err.message : "product-query";
    }
    if (attempt < PRODUCT_ATTEMPTS - 1) await delay(450 * (attempt + 1));
  }
  return { priceString: null, productTitle: null, loadError };
}

async function readStoreChannel(NativePurchases: NativePurchasesApi): Promise<StoreChannel> {
  if (!NativePurchases.getAppTransaction) return "unknown";
  try {
    const result = await withTimeout(NativePurchases.getAppTransaction(), 8_000);
    return normalizeStoreChannel(result.appTransaction?.environment);
  } catch {
    return "unknown";
  }
}

async function readUnlockFromStore(
  NativePurchases: NativePurchasesApi,
  productType: string,
): Promise<{ unlocked: boolean; queried: boolean }> {
  try {
    const current = await NativePurchases.getPurchases({
      productType,
      onlyCurrentEntitlements: true,
    });
    if (purchasesGrantUnlock(current.purchases)) return { unlocked: true, queried: true };
    const all = await NativePurchases.getPurchases({ productType });
    return { unlocked: purchasesGrantUnlock(all.purchases), queried: true };
  } catch {
    return { unlocked: false, queried: false };
  }
}

export async function purchaseFullUnlock(): Promise<StoreTransaction> {
  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();
  return NativePurchases.purchaseProduct({
    productIdentifier: FULL_UNLOCK_PRODUCT_ID,
    productType: PURCHASE_TYPE.INAPP,
  });
}

export async function restoreFullUnlock(): Promise<{ unlocked: boolean; queried: boolean }> {
  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();
  await NativePurchases.restorePurchases();
  return readUnlockFromStore(NativePurchases, PURCHASE_TYPE.INAPP);
}

export async function listenForUnlock(onUnlock: () => void): Promise<void> {
  if (listener) return;
  try {
    const { NativePurchases } = await loadPlugin();
    listener = await NativePurchases.addListener("transactionUpdated", (tx) => {
      if (transactionGrantsUnlock(tx)) onUnlock();
    });
  } catch {
    /* plugin not linked yet */
  }
}
