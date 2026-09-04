import type { CareerPayload } from "./score";

const KEY = "poc-pending-career";

export function writePendingScore(p: CareerPayload) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function readPendingScore(): CareerPayload | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CareerPayload) : null;
  } catch {
    return null;
  }
}

export function clearPendingScore() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
