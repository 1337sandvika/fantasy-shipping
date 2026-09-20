import { makeId } from "./codes";
import { emptyCounters } from "./progress";
import { SOCIAL_KEY, SOCIAL_VERSION, type SocialBlob } from "./types";

export function freshBlob(): SocialBlob {
  return {
    v: SOCIAL_VERSION,
    onboardingDone: false,
    selfId: makeId("me", 8),
    selfHandle: "",
    friends: [],
    challenges: [],
    daily: null,
    history: [],
    counters: emptyCounters(),
    counterDate: "",
  };
}

export function loadBlob(): SocialBlob {
  try {
    if (typeof localStorage === "undefined") return freshBlob();
    const raw = localStorage.getItem(SOCIAL_KEY);
    if (!raw) return freshBlob();
    const parsed = JSON.parse(raw) as Partial<SocialBlob>;
    if (!parsed || parsed.v !== SOCIAL_VERSION) return freshBlob();
    const base = freshBlob();
    return {
      ...base,
      ...parsed,
      v: SOCIAL_VERSION,
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 21) : [],
      counters: { ...emptyCounters(), ...(parsed.counters ?? {}) },
      daily: parsed.daily ?? null,
      onboardingDone: Boolean(parsed.onboardingDone),
      selfId: parsed.selfId || base.selfId,
      selfHandle: String(parsed.selfHandle ?? ""),
      counterDate: String(parsed.counterDate ?? ""),
    };
  } catch {
    return freshBlob();
  }
}

export function saveBlob(blob: SocialBlob) {
  try {
    localStorage.setItem(SOCIAL_KEY, JSON.stringify(blob));
  } catch {
    /* quota / private mode */
  }
}
