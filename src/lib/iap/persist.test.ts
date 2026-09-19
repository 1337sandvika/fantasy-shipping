import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRIAL_MS, UNLOCK_CACHE_KEY } from "./product.ts";
import { deriveAccess } from "./access.ts";
import {
  ensureTrialStart,
  readTrialStart,
  readUnlockCache,
  resetTrialStart,
  writeUnlockCache,
} from "./persist.ts";

const CAREER_SAVE_KEY = "uecc-ports-of-call-v2";
const PENDING_SCORE_KEY = "poc-pending-career";

class MemoryStorage implements Storage {
  #map = new Map<string, string>();
  get length() {
    return this.#map.size;
  }
  clear() {
    this.#map.clear();
  }
  getItem(key: string) {
    return this.#map.has(key) ? this.#map.get(key)! : null;
  }
  key(index: number) {
    return [...this.#map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#map.delete(key);
  }
  setItem(key: string, value: string) {
    this.#map.set(String(key), String(value));
  }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { localStorage: store },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("resetTrialStart", () => {
  it("renews the trial clock without touching career save or unlock cache", () => {
    const firstLaunch = 1_700_000_000_000;
    const careerBlob = JSON.stringify({ v: 14, fleet: "keep-me" });
    store.setItem(CAREER_SAVE_KEY, careerBlob);
    store.setItem(PENDING_SCORE_KEY, "pending");
    ensureTrialStart(firstLaunch);
    assert.equal(readTrialStart(), firstLaunch);
    assert.equal(readUnlockCache(), false);

    const expiredNow = firstLaunch + TRIAL_MS + 1;
    const locked = deriveAccess({
      gating: true,
      unlockedFromStore: readUnlockCache(),
      trialStartedAt: readTrialStart(),
      now: expiredNow,
    });
    assert.equal(locked.canPlay, false);

    const renewedAt = expiredNow;
    resetTrialStart(renewedAt);

    assert.equal(store.getItem(CAREER_SAVE_KEY), careerBlob);
    assert.equal(store.getItem(PENDING_SCORE_KEY), "pending");
    assert.equal(store.getItem(UNLOCK_CACHE_KEY), null);
    assert.equal(readTrialStart(), renewedAt);

    const access = deriveAccess({
      gating: true,
      unlockedFromStore: readUnlockCache(),
      trialStartedAt: readTrialStart(),
      now: renewedAt,
    });
    assert.equal(access.canPlay, true);
    assert.equal(access.trialActive, true);
    assert.equal(access.isUnlocked, false);
  });

  it("does not move an existing trial on ensureTrialStart", () => {
    const t0 = 1_700_000_000_000;
    ensureTrialStart(t0);
    assert.equal(ensureTrialStart(t0 + 5_000), t0);
    writeUnlockCache(true);
    resetTrialStart(t0 + 5_000);
    assert.equal(readTrialStart(), t0 + 5_000);
    assert.equal(readUnlockCache(), true);
  });
});
