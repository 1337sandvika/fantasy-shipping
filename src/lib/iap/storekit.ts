import type { PluginListenerHandle } from "@capacitor/core";
import { FULL_UNLOCK_PRODUCT_ID } from "./product";
import { purchasesGrantUnlock, transactionGrantsUnlock, type StoreTransaction } from "./access";

export type StoreQuery = {
  unlocked: boolean;
  queried: boolean;
  billingSupported: boolean;
  priceString: string | null;
  productTitle: string | null;
};

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

export async function queryStore(): Promise<StoreQuery> {
  const empty: StoreQuery = {
    unlocked: false,
    queried: false,
    billingSupported: false,
    priceString: null,
    productTitle: null,
  };
  try {
    const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();
    let billingSupported = false;
    try {
      billingSupported = Boolean((await NativePurchases.isBillingSupported()).isBillingSupported);
    } catch {
      billingSupported = false;
    }

    let priceString: string | null = null;
    let productTitle: string | null = null;
    try {
      const { products } = await NativePurchases.getProducts({
        productIdentifiers: [FULL_UNLOCK_PRODUCT_ID],
        productType: PURCHASE_TYPE.INAPP,
      });
      const product = products.find((p) => p.identifier === FULL_UNLOCK_PRODUCT_ID) ?? products[0];
      if (product) {
        priceString = product.priceString || null;
        productTitle = product.title || null;
      }
    } catch {
      /* product missing in Connect / StoreKit config */
    }

    const unlocked = await readUnlockFromStore(NativePurchases, PURCHASE_TYPE.INAPP);
    return {
      unlocked: unlocked.unlocked,
      queried: unlocked.queried,
      billingSupported,
      priceString,
      productTitle,
    };
  } catch {
    return empty;
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
