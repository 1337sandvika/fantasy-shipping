import { create } from "zustand";
import type { Atlas, EndKind, GameState, Tempo, UiState, UpgradeId } from "./types";
import {
  idleState,
  freshState,
  buyHull,
  buyOffer,
  sellShip,
  setActive,
  renameShip,
  loadLot,
  dischargeHere,
  bunker,
  repair,
  drydock,
  fitUpgrade,
  waitDay,
  payEts,
  setCourse,
  tickVoyage,
  resolveEvent,
  sailCheck,
  endCareer,
  resumeCareer,
  ensureMarket,
  takeLoan,
  repayLoan,
  takeTcIn,
  charterOut,
  offerBarge,
  waitBarge,
} from "./sim";
import { persist, loadSave, hasSaveFlag, clearSave } from "./save";
import { blip, foghorn } from "./audio";
import { activeShip, bunkerPlanFor, fleetHasBarge, fleetValue } from "./fleet";
import { writePendingScore } from "./pending-score";

type Store = {
  state: GameState;
  ui: UiState;
  hasSave: boolean;
  start: (company: string, director: string) => void;
  continueSave: () => void;
  toTitle: () => void;
  setAbout: (v: boolean) => void;
  setSettings: (v: boolean) => void;
  toggleMute: () => void;
  setTempo: (n: Tempo) => void;
  setFollow: (v: boolean) => void;
  setAtlas: (v: Atlas) => void;
  setMapHud: (v: boolean) => void;
  setTab: (tab: GameState["tab"]) => void;
  selectPort: (id: string) => void;
  buy: (hullId: string) => void;
  buyOffer: (offerId: string) => void;
  sell: (shipId: string) => void;
  switchShip: (id: string) => void;
  rename: (id: string, name: string) => void;
  load: (lotId: string) => void;
  discharge: () => void;
  bunker: (tons: number) => void;
  offerBarge: () => void;
  waitBarge: () => void;
  repair: () => void;
  drydock: () => void;
  upgrade: (id: UpgradeId) => void;
  wait: () => void;
  takeLoan: () => void;
  repayLoan: () => void;
  hireIn: (offerId: string) => void;
  hireOut: (shipId: string, days?: number) => void;
  payEts: () => void;
  sail: (dest: string, full?: boolean) => string | null;
  choose: (choice: string) => void;
  retire: () => void;
  resume: () => void;
  fileBankruptcy: () => void;
  markCheckpoint: () => void;
  tick: (dtDays: number) => void;
};

const boot = (() => {
  try {
    const s = loadSave();
    if (s && s.phase !== "title") return { state: ensureMarket(s), hasSave: true };
  } catch {
    /* ignore */
  }
  return { state: idleState(), hasSave: hasSaveFlag() };
})();

export const useGame = create<Store>((set, get) => ({
  state: boot.state,
  ui: { muted: false, about: false, settings: false, tempo: 1, lastTempo: 1, follow: true, atlas: "world", viewSeq: 0, mapHud: true },
  hasSave: boot.hasSave,
  start: (company, director) => {
    try {
      const state = freshState(company, director);
      clearSave();
      persist(state);
      set({ state, hasSave: true, ui: { ...get().ui, follow: true, atlas: "world", tempo: 1, viewSeq: (get().ui.viewSeq ?? 0) + 1 } });
      blip(330);
    } catch {
      /* keep the previous career if a new one fails to build */
    }
  },
  continueSave: () => {
    const s = loadSave();
    if (s) set({ state: ensureMarket(s), hasSave: true, ui: { ...get().ui, follow: true, viewSeq: (get().ui.viewSeq ?? 0) + 1 } });
  },
  toTitle: () => {
    const st = get().state;
    if (st.phase !== "title") persist(st);
    set({ state: { ...st, phase: "title" }, hasSave: hasSaveFlag(), ui: { ...get().ui, settings: false } });
  },
  setAbout: (v) => set({ ui: { ...get().ui, about: v } }),
  setSettings: (v) => set({ ui: { ...get().ui, settings: v } }),
  toggleMute: () => set({ ui: { ...get().ui, muted: !get().ui.muted } }),
  setTempo: (tempo) => {
    const ui = get().ui;
    if (tempo === 0) set({ ui: { ...ui, tempo } });
    else set({ ui: { ...ui, tempo, lastTempo: tempo } });
  },
  setFollow: (follow) =>
    set({ ui: { ...get().ui, follow, viewSeq: follow ? (get().ui.viewSeq ?? 0) + 1 : get().ui.viewSeq } }),
  setAtlas: (atlas) =>
    set({ ui: { ...get().ui, atlas, follow: false, viewSeq: (get().ui.viewSeq ?? 0) + 1 } }),
  setMapHud: (mapHud) => set({ ui: { ...get().ui, mapHud } }),
  setTab: (tab) => set({ state: { ...get().state, tab } }),
  selectPort: (id) => {
    const st = get().state;
    if (st.phase === "event" || st.phase === "end" || st.phase === "title") return;
    set({ state: { ...st, selectedPort: id } });
  },
  buy: (hullId) => {
    const state = buyHull(get().state, hullId);
    persist(state);
    const ui = get().ui;
    set({ state, ui: { ...ui, follow: true, viewSeq: (ui.viewSeq ?? 0) + 1 } });
    blip(260);
  },
  buyOffer: (offerId) => {
    const state = buyOffer(get().state, offerId);
    persist(state);
    const ui = get().ui;
    set({ state, ui: { ...ui, follow: true, viewSeq: (ui.viewSeq ?? 0) + 1 } });
    blip(260);
  },
  sell: (shipId) => {
    const state = sellShip(get().state, shipId);
    persist(state);
    set({ state });
    blip(180);
  },
  switchShip: (id) => {
    const state = setActive(get().state, id);
    set({ state, ui: { ...get().ui } });
  },
  rename: (id, name) => {
    const state = renameShip(get().state, id, name);
    persist(state);
    set({ state });
  },
  load: (lotId) => {
    const state = loadLot(get().state, lotId);
    persist(state);
    set({ state });
    blip(300);
  },
  discharge: () => {
    const state = dischargeHere(get().state);
    persist(state);
    set({ state });
    blip(200);
    if (state.phase === "end" && state.endKind === "broke") {
      stash(state);
      foghorn();
    }
  },
  bunker: (tons) => {
    const state = bunker(get().state, tons);
    persist(state);
    set({ state });
  },
  offerBarge: () => {
    const state = offerBarge(get().state);
    persist(state);
    set({ state });
  },
  waitBarge: () => {
    const state = waitBarge(get().state);
    persist(state);
    set({ state });
    if (state.phase === "end") {
      stash(state);
      if (state.endKind === "broke") foghorn();
    }
  },
  repair: () => {
    const state = repair(get().state);
    persist(state);
    set({ state });
  },
  drydock: () => {
    const state = drydock(get().state);
    persist(state);
    set({ state });
  },
  upgrade: (id) => {
    const state = fitUpgrade(get().state, id);
    persist(state);
    set({ state });
  },
  wait: () => {
    const state = waitDay(get().state);
    persist(state);
    set({ state });
    if (state.phase === "end") {
      stash(state);
      if (state.endKind === "broke") foghorn();
    }
  },
  takeLoan: () => {
    const state = takeLoan(get().state);
    persist(state);
    set({ state });
    blip(240);
  },
  repayLoan: () => {
    const state = repayLoan(get().state);
    persist(state);
    set({ state });
    blip(200);
  },
  hireIn: (offerId) => {
    const state = takeTcIn(get().state, offerId);
    persist(state);
    const ui = get().ui;
    set({ state, ui: { ...ui, follow: true, viewSeq: (ui.viewSeq ?? 0) + 1 } });
    blip(260);
  },
  hireOut: (shipId, days) => {
    const state = charterOut(get().state, shipId, days);
    persist(state);
    set({ state });
    blip(220);
  },
  payEts: () => {
    const state = payEts(get().state);
    persist(state);
    set({ state });
    if (state.phase === "end" && state.endKind === "broke") {
      stash(state);
      foghorn();
    }
  },
  sail: (dest, full) => {
    let state = get().state;
    const plan = bunkerPlanFor(state, dest);
    if (plan.hullTooShort) return "course.tooFar";
    if (plan.noLng) {
      const offered = offerBarge(state);
      persist(offered);
      set({ state: offered, ui: { ...get().ui, tempo: 0 } });
      return "bunker.lngNone";
    }
    if (plan.noCash) return "bunker.noCash";
    if (plan.extraTons >= 1) state = bunker(state, plan.extraTons);
    const err = sailCheck(state, dest);
    if (err && err !== "sail.bunkers") return err;
    if (err === "sail.bunkers") return plan.noLng ? "bunker.lngNone" : "bunker.noCash";
    state = setCourse(state, dest, full);
    persist(state);
    const ui = get().ui;
    const tempo = ui.tempo === 0 ? ui.lastTempo || 4 : ui.tempo;
    set({ state, ui: { ...ui, tempo } });
    blip(180);
    return null;
  },
  choose: (choice) => {
    const prev = get().state;
    const state = resolveEvent(prev, choice);
    persist(state);
    const ui = get().ui;
    const startedBarge = !activeShip(prev)?.barge && Boolean(activeShip(state)?.barge);
    if (startedBarge && ui.tempo === 0) {
      set({ state, ui: { ...ui, tempo: ui.lastTempo || 4 } });
    } else {
      set({ state });
    }
    if (state.phase === "end") stash(state);
  },
  retire: () => {
    const state = endCareer(get().state, "retired");
    persist(state);
    set({ state });
    stash(state);
  },
  resume: () => {
    const state = resumeCareer(get().state);
    persist(state);
    set({ state, ui: { ...get().ui, tempo: 0 } });
    blip(260);
  },
  fileBankruptcy: () => {
    const st = get().state;
    if (st.phase === "end" || st.phase === "title") return;
    const state = endCareer(st, "broke");
    persist(state);
    set({ state, ui: { ...get().ui, tempo: 0 } });
    stash(state);
    foghorn();
  },
  markCheckpoint: () => {
    const state = get().state;
    if (state.phase !== "end") return;
    persist(state);
    stash(state);
  },
  tick: (dtDays) => {
    const st = get().state;
    if (st.phase === "event" || st.phase === "end" || st.phase === "title") return;
    if (!st.legs.length) return;
    try {
      const n0 = st.legs.length;
      const barge0 = fleetHasBarge(st);
      const state = tickVoyage(st, dtDays);
      const ui = get().ui;
      const bargeDone = barge0 && !fleetHasBarge(state);
      if (state.legs.length < n0 || bargeDone) {
        const last = ui.tempo === 0 ? ui.lastTempo : ui.tempo;
        set({ state, ui: { ...ui, tempo: 0, lastTempo: last } });
      } else {
        set({ state });
      }
      if (state.phase !== st.phase || !state.legs.length || bargeDone) persist(state);
      else if (Math.floor(state.day) !== Math.floor(st.day)) persist(state);
      if (state.phase === "end") {
        stash(state);
        if (state.endKind === "broke") foghorn();
      }
    } catch {
      /* keep the last good frame */
    }
  },
}));

function stash(s: GameState) {
  const kind = (s.endKind ?? "retired") as EndKind;
  writePendingScore({
    captain: s.company || s.captain,
    endKind: kind,
    day: s.day,
    cash: s.cash,
    netWorth: s.cash + fleetValue(s),
    deliveredCeu: s.deliveredCeu,
    reputation: s.reputation,
    co2t: Math.round(s.co2t),
    voyages: s.voyages,
    fines: s.fines,
    fleetSize: s.fleet.length,
  });
}

export function hydrateSaveFlag() {
  useGame.setState({ hasSave: hasSaveFlag() });
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { __game?: typeof useGame }).__game = useGame;
}
