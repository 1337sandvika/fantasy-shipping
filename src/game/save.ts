import { hullById } from "./data/ships";
import { refillLots, refreshTc } from "./sim";
import type { CargoKind, Charter, CharterKind, EndKind, GameState, Lot, SaveBlob, Ship, TcOffer, UpgradeId, Voyage } from "./types";

export const SAVE_KEY = "uecc-ports-of-call-v2";
export const SAVE_VERSION = 12;

const KINDS: CargoKind[] = ["cars", "vans", "trucks", "hh"];
const UPGRADES: UpgradeId[] = ["scrubber", "prop", "ice", "lashing", "fuelopt", "tankcoat", "hhdeck"];

function hydrateLot(l: Lot): Lot {
  const kind: CargoKind = KINDS.includes(l.kind) ? l.kind : "cars";
  const hh = l.hh ?? (kind === "hh" ? 12 : kind === "trucks" ? 4 : 0);
  return { ...l, kind, hh, note: l.note };
}

function hydrateShip(sh: Ship): Ship {
  const h = hullById(sh.hullId);
  const upgrades = (sh.upgrades ?? []).filter((u): u is UpgradeId => UPGRADES.includes(u));
  const charter: CharterKind | null = sh.charter === "in" || sh.charter === "out" ? sh.charter : null;
  return {
    ...sh,
    hhCap: sh.hhCap ?? h?.hhCap ?? 40,
    burn: sh.burn ?? h?.burn ?? (sh.fuel === "lng" ? 0.085 : 0.12),
    etsAcc: sh.etsAcc ?? 0,
    upgrades,
    hold: (sh.hold ?? []).map(hydrateLot),
    charter,
    barge:
      sh.barge && typeof sh.barge.eta === "number" && typeof sh.barge.tons === "number"
        ? {
            from: String(sh.barge.from || ""),
            eta: sh.barge.eta,
            tons: sh.barge.tons,
            cost: sh.barge.cost ?? 0,
          }
        : null,
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Legacy = GameState & { voyage?: Voyage | null };

export function hydrate(state: GameState): GameState {
  const raw = state as Legacy;
  const lots: Record<string, Lot[]> = {};
  for (const [k, v] of Object.entries(state.lots ?? {})) {
    lots[k] = (v ?? []).map(hydrateLot);
  }
  const ets = state.ets
    ? { t: state.ets.t, price: state.ets.price, ships: state.ets.ships ?? [] }
    : null;
  const legs: Voyage[] = raw.legs?.length
    ? raw.legs
    : raw.voyage
      ? [raw.voyage]
      : [];
  let phase = state.phase;
  if (phase === "voyage") phase = "port";
  const seed = state.seed ?? (hashStr(state.captain || state.company || "skipper") ^ ((state.day ?? 0) * 997 + 13));
  const tc: TcOffer[] = state.tc ?? [];
  const charters: Charter[] = state.charters ?? [];
  const company = (state.company || state.captain || "").trim();
  const director = (state.director || "").trim();
  return {
    ...state,
    phase,
    captain: company,
    company,
    director,
    fleet: (state.fleet ?? []).map(hydrateShip),
    lots,
    ets,
    lastEtsMonth: state.lastEtsMonth ?? -1,
    market: state.market ?? [],
    marketDay: state.marketDay ?? 0,
    tc,
    tcDay: state.tcDay ?? -99,
    charters,
    seed,
    heat: state.heat ?? 0,
    etsAcc: state.etsAcc ?? 0,
    debt: state.debt ?? 0,
    legs,
    milestones: Array.isArray(state.milestones)
      ? state.milestones.filter((k): k is EndKind =>
          k === "wealth" || k === "green" || k === "broke" || k === "retired",
        )
      : [],
    honours: Array.isArray(state.honours) ? state.honours : [],
    brandOnTime: state.brandOnTime && typeof state.brandOnTime === "object" ? state.brandOnTime : {},
    preferred: Array.isArray(state.preferred) ? state.preferred.map(String) : [],
    onTimeStreak: state.onTimeStreak ?? 0,
    lastGreenMonth: state.lastGreenMonth ?? state.lastEtsMonth ?? -1,
    ceuMarks: Array.isArray(state.ceuMarks) ? state.ceuMarks.filter((n) => typeof n === "number") : [],
    pendingEvent: state.pendingEvent ?? null,
  };
}

export function persist(state: GameState) {
  if (!state || state.phase === "title") return;
  try {
    const blob: SaveBlob = { v: SAVE_VERSION, state };
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

export function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as SaveBlob;
    if (!blob?.state) return null;
    if (blob.v !== 4 && blob.v !== 5 && blob.v !== 6 && blob.v !== 7 && blob.v !== 8 && blob.v !== 9 && blob.v !== 10 && blob.v !== 11 && blob.v !== 12)
      return null;
    let rawState = blob.state;
    if (rawState.phase === "title") {
      const playing = (rawState.fleet?.length ?? 0) > 0 || (rawState.day ?? 0) > 0 || (rawState.log?.length ?? 0) > 0;
      if (!playing) return null;
      rawState = { ...rawState, phase: "port" };
    }
    const state = hydrate(rawState);
    if (blob.v < 9) refillLots(state);
    if (!(state.tc ?? []).length) refreshTc(state, true);
    return state;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSaveFlag(): boolean {
  try {
    return loadSave() != null;
  } catch {
    return false;
  }
}
