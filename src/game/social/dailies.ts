import { PORTS } from "../data/ports";
import type { DailyKind, DailySlot, DailyState } from "./types";

export type DailyDef = {
  id: DailyKind;
  skill: "routing" | "harbour" | "events" | "fleet" | "cargo" | "bunkers" | "green";
  target: (rng: () => number) => number;
  ports?: boolean;
};

const HUBS = PORTS.filter((p) => p.hub).map((p) => p.id);

export const DAILY_CATALOG: DailyDef[] = [
  { id: "ceu", skill: "cargo", target: (r) => 400 + Math.floor(r() * 5) * 200 },
  { id: "ontime", skill: "cargo", target: (r) => 1 + Math.floor(r() * 3) },
  { id: "helm", skill: "harbour", target: (r) => 1 + Math.floor(r() * 2) },
  { id: "voyage", skill: "routing", target: (r) => 1 + Math.floor(r() * 2) },
  { id: "hub", skill: "routing", target: () => 1, ports: true },
  { id: "hh", skill: "cargo", target: () => 1 },
  { id: "lng", skill: "bunkers", target: () => 1 },
  { id: "event", skill: "events", target: (r) => 1 + Math.floor(r() * 2) },
  { id: "ets", skill: "green", target: () => 1 },
  { id: "fleet", skill: "fleet", target: (r) => 1 + Math.floor(r() * 2) },
  { id: "green", skill: "green", target: () => 1 },
  { id: "profit", skill: "cargo", target: (r) => 80_000 + Math.floor(r() * 6) * 20_000 },
  { id: "charter", skill: "fleet", target: () => 1 },
  { id: "ocean", skill: "routing", target: () => 1 },
];

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

function shuffle<T>(list: T[], r: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

export function pickHub(date: string, salt: number): string {
  const r = rng(hashStr(`${date}|hub|${salt}`));
  return HUBS[Math.floor(r() * HUBS.length)] ?? "zeebrugge";
}

export function dailyRewardCash(date: string): number {
  const r = rng(hashStr(`${date}|pay`));
  return 45_000 + Math.floor(r() * 4) * 15_000;
}

/** Three skill-varied jobs for a UTC date. Avoids cloning yesterday's full set. */
export function makeDaily(date: string, yesterdayIds: DailyKind[] = []): DailyState {
  const r = rng(hashStr(`desk|${date}`));
  const order = shuffle(DAILY_CATALOG, r);
  const picked: DailyDef[] = [];
  const usedSkill = new Set<string>();
  for (const def of order) {
    if (picked.length >= 3) break;
    if (usedSkill.has(def.skill) && picked.length < 2) continue;
    picked.push(def);
    usedSkill.add(def.skill);
  }
  while (picked.length < 3) {
    const extra = order.find((d) => !picked.includes(d));
    if (!extra) break;
    picked.push(extra);
  }
  if (yesterdayIds.length === 3 && picked.every((d, i) => d.id === yesterdayIds[i])) {
    const swap = order.find((d) => d.id !== picked[2]?.id);
    if (swap) picked[2] = swap;
  }
  const slots: DailySlot[] = picked.slice(0, 3).map((def, i) => ({
    id: def.id,
    target: def.target(rng(hashStr(`${date}|${def.id}|${i}`))),
    progress: 0,
    done: false,
    port: def.ports ? pickHub(date, i) : undefined,
  }));
  return { date, slots, claimed: false, rewardCash: dailyRewardCash(date) };
}
