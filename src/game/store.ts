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
} from "./sim";
import { persist, loadSave, hasSaveFlag, clearSave } from "./save";
import { blip } from "./audio";
import { fleetValue } from "./fleet";
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
  ui: { muted: false, about: false, settings: false, tempo: 1, lastTempo: 1, follow: false, atlas: "europe" },
  hasSave: boot.hasSave,
  start: (company, director) => {
    try {
      const state = freshState(company, director);
      clearSave();
      persist(state);
      set({ state, hasSave: true, ui: { ...get().ui, follow: false, atlas: "europe", tempo: 1 } });
      blip(330);
    } catch {
      /* keep the previous career if a new one fails to build */
    }
  },
  continueSave: () => {
    const s = loadSave();
    if (s) set({ state: ensureMarket(s), hasSave: true });
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
  setFollow: (follow) => set({ ui: { ...get().ui, follow } }),
  setAtlas: (atlas) => set({ ui: { ...get().ui, atlas, follow: false } }),
  setTab: (tab) => set({ state: { ...get().state, tab } }),
  selectPort: (id) => {
    const st = get().state;
    if (st.phase === "event" || st.phase === "end" || st.phase === "title") return;
    set({ state: { ...st, selectedPort: id } });
  },
  buy: (hullId) => {
    const state = buyHull(get().state, hullId);
    persist(state);
    set({ state });
    blip(260);
  },
  buyOffer: (offerId) => {
    const state = buyOffer(get().state, offerId);
    persist(state);
    set({ state });
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
  },
  bunker: (tons) => {
    const state = bunker(get().state, tons);
    persist(state);
    set({ state });
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
    set({ state });
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
  },
  sail: (dest, full) => {
    const err = sailCheck(get().state, dest);
    if (err) return err;
    const state = setCourse(get().state, dest, full);
    persist(state);
    const ui = get().ui;
    const tempo = ui.tempo === 0 ? ui.lastTempo || 4 : ui.tempo;
    set({ state, ui: { ...ui, tempo } });
    blip(180);
    return null;
  },
  choose: (choice) => {
    const state = resolveEvent(get().state, choice);
    persist(state);
    set({ state });
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
      const state = tickVoyage(st, dtDays);
      const ui = get().ui;
      if (state.legs.length < n0) {
        const last = ui.tempo === 0 ? ui.lastTempo : ui.tempo;
        set({ state, ui: { ...ui, tempo: 0, lastTempo: last } });
      } else {
        set({ state });
      }
      if (state.phase !== st.phase || !state.legs.length) persist(state);
      else if (Math.floor(state.day) !== Math.floor(st.day)) persist(state);
      if (state.phase === "end") stash(state);
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
