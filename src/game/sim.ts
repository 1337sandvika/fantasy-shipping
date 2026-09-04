// @ts-nocheck
import { BRANDS, ODD, LOT_FLAVOUR, SHIP_NAMES, TC_DESKS } from "./data/cargo";
import { CUSTOMS_HUBS, PORTS, etsShare, getPort, portName } from "./data/ports";
import { HULLS, UPGRADES, hullById } from "./data/ships";
import { isWinter, monthKey } from "./format";
import {
  activeLeg,
  activeShip,
  burnPerNm,
  canDrydock,
  canLoadLot,
  canTakeLoan,
  etsFactor,
  hullValue,
  loanOffer,
  remainingCeu,
  remainingHh,
  shipLeg,
} from "./fleet";
import { seaRoute } from "./route";
import type { GameState, MarketOffer, TcOffer } from "./types";

let seq = 1;
const uid = (p: string) => `${p}-${seq++}-${Math.random().toString(36).slice(2, 6)}`;

function log(s: GameState, text: string) {
  s.log = [{ day: s.day, text }, ...s.log].slice(0, 80);
}

function newsFor(day, seed) {
  const r = rng(((seed >>> 0) || 1) + day * 19 + 3);
  const mood = careerMood(seed);
  const moodLine = [
    "Odd-parcel week. Circus cages, golf carts, a mayor's yacht. The lions took a plane.",
    "High & Heavy is paying. If your weather deck is a rumour, so is the freight.",
    "Grey week. Envelopes, tracksuits, and clipboards with opinions.",
    "Ocean contracts. Feeders will cry. Grown-up hulls will invoice.",
    "Feeder week. Small lots, short seas, the accountants almost smile.",
    "Recall week. Viking Volt and friends would like their batteries back. Probably declared.",
  ][mood];
  const pool = [
    moodLine,
    "Nordia swears this week's cars are not last week's cars. The stickers say otherwise.",
    "Fjordia wants Göteborg–Zeebrugge yesterday. They will pay like they mean it.",
    "Stellara in Vigo is shipping the colour nobody ordered. Freight is honest.",
    "Ice warning, Gulf of Finland. Polar bears are not a valid ice class.",
    "LNG in Zeebrugge, Flushing, Le Havre, Barcelona and Tanger Med. The rest is diesel and regret.",
    "EU ETS: the monthly hug. Old MGO tonnage gets the invoice with teeth.",
    "Tokai Autoport loads hybrids. The batteries are declared. Probably.",
    "High & Heavy out of Emden pays. Your weather deck has opinions.",
    "Second-hand RoRo is cheap. So is the steel behind the paint.",
    "Customs in Zeebrugge bought new clipboards. They are excited to use them.",
    "An OEM contract with a short deadline pays double. Late is a personality.",
    "Grey brokers on VHF. Fat freight. Harbour police have radios too.",
    "Baltimore and Jacksonville laugh at feeder CEU. Buy a grown-up hull.",
    "Yokohama–Long Beach H&H is paying. Ramps earn their keep.",
    "Singapore: envelopes if you like heat. The coastguard likes heat too.",
    "Santos harvest kit wants a specialist. Cheap tonnage cannot lift a combine.",
    "A mayor somewhere wants his yacht on a car deck. Do not ask why.",
    "Viking Volt issued a recall and a freight tender in the same hour.",
    "The TC desk is hungry. Short-term hire is cheaper than a bad purchase.",
    "A circus left three cages in Nimbus's yard. The lions took a plane. The generator did not.",
    "Helios Kart: a golf resort went under. The carts still have the scorecards.",
    "Dockers in Flushing have discovered coffee that lasts six hours.",
    "A pilot in Le Havre would like his coffee 'supported'. Cash only.",
    "Rumour: a yellow sports car on deck 4 has its own agent.",
    "The cook's chili has been classified as a weather event in two ports.",
    "A flamingo was lashed between two vans. Nobody will claim it.",
    "Herring Haul wants fish-and-chip vans moved before Friday. The smell is freight.",
    "Clipboard Partners are offering cheap TC. You trade. They own the rust.",
  ];
  return [moodLine, ...shuffle(pool.filter((x) => x !== moodLine), r)].slice(0, 6);
}
export function careerMood(seed) {
  return ((seed >>> 0) || 1) % 6;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick(arr, rnd) {
  return arr[Math.floor(rnd() * arr.length)];
}
function rng(seed) {
  let x = seed || 1;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
function kindMult(kind) {
  if (kind === "hh") return 2.18;
  if (kind === "trucks") return 1.16;
  if (kind === "vans") return 1.02;
  return 0.94;
}
/** Europe ~€300/CEU. Ocean dearer. Grey and H&H contracts pay up. */
export function freightRate(nm, kind, contract, grey, jitter) {
  const short = Math.min(Math.max(50, nm), 1400) * 0.17;
  const ocean = Math.max(0, nm - 1400) * 0.055;
  let rate = (175 + short + ocean) * kindMult(kind) * (0.9 + jitter * 0.2);
  if (contract) rate *= kind === "hh" ? 1.58 : 1.28;
  if (grey) rate *= 2.12;
  return Math.max(120, Math.round(rate));
}
export function refillLots(s) {
  try {
    refillLotsUnsafe(s);
  } catch {
    /* keep whatever lots we already have */
  }
}
function shuffle(arr, r) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function refillLotsUnsafe(s) {
  const r = rng(((s.seed >>> 0) || 1) + s.day * 997 + 13 + (s.voyages || 0) * 41 + Math.floor(rSalt(s) * 97));
  const mood = careerMood(s.seed);
  const oddP = mood === 0 ? 0.44 : s.day === 0 ? 0.3 : 0.2;
  const greyP = mood === 2 ? 0.4 : 0.16;
  const hhCut = mood === 1 ? 0.42 : 0.2;
  for (const p of shuffle(PORTS, r)) {
    const n = 6 + Math.floor(r() * 8);
    const others = PORTS.filter((x) => x.id !== p.id).map((d) => ({
      id: d.id,
      nm: seaRoute(p.id, d.id).nm,
    }));
    others.sort((a, b) => a.nm - b.nm);
    const near = others.slice(0, Math.min(8, others.length));
    const mid = others.slice(8, Math.min(18, others.length));
    const far = others.slice(18);
    const prev = s.lots[p.id] ?? [];
    const keepN = s.day === 0 ? 0 : Math.min(2, Math.floor(r() * 3));
    const lots = keepN ? shuffle(prev, r).slice(0, keepN) : [];
    for (let i = lots.length; i < n; i++) {
      const roll = r();
      const destPool =
        mood === 3
          ? roll < 0.55 && far.length
            ? far
            : others
          : roll < 0.2
            ? others
            : roll < 0.46
              ? near
              : roll < 0.7 && mid.length
                ? mid
                : far.length
                  ? far
                  : others;
      const dest = pick(destPool, r).id;
      const nm = others.find((d) => d.id === dest)?.nm ?? seaRoute(p.id, dest).nm;
      const ocean = nm > 1700;
      if (r() < oddP) {
        const odd = pick(ODD, r);
        const span = (pair) => pair[0] + Math.floor(r() * Math.max(1, pair[1] - pair[0]));
        const hh = span(odd.hh);
        const ceu = Math.max(odd.ceu[0], span(odd.ceu) + hh * (odd.kind === "hh" ? 4 : 0));
        const contract = r() < 0.22;
        const grey = r() < greyP;
        lots.push({
          id: uid("lot"),
          origin: p.id,
          dest,
          brand: odd.brand,
          kind: odd.kind,
          ceu,
          hh,
          rate: freightRate(nm, odd.kind, contract, grey, r()),
          contract,
          deadline: s.day + (odd.kind === "hh" ? 8 : 6) + Math.floor(r() * 14),
          grey,
          note: odd.note,
        });
        continue;
      }
      const contract = r() < 0.3;
      const grey = r() < greyP;
      const hhRoll = r();
      const sizeRoll = mood === 4 ? r() * 0.55 : r();
      let kind;
      let hh;
      let ceu;
      if (hhRoll < hhCut) {
        kind = "hh";
        const heavy = ocean || r() < 0.68;
        hh = heavy ? 48 + Math.floor(r() * 140) : 8 + Math.floor(r() * 28);
        ceu = 90 + hh * 5;
      } else if (hhRoll < hhCut + 0.14) {
        kind = "trucks";
        hh = 4 + Math.floor(r() * 18);
        ceu =
          ocean || sizeRoll >= 0.55
            ? 3200 + Math.floor(r() * 4800)
            : sizeRoll >= 0.28
              ? 1600 + Math.floor(r() * 1600)
              : 220 + Math.floor(r() * 1100);
      } else if (hhRoll < hhCut + 0.32) {
        kind = "vans";
        hh = 0;
        ceu =
          ocean || sizeRoll >= 0.55
            ? 3200 + Math.floor(r() * 4800)
            : sizeRoll >= 0.28
              ? 1600 + Math.floor(r() * 1600)
              : 180 + Math.floor(r() * 1000);
      } else {
        kind = "cars";
        hh = 0;
        ceu =
          ocean || sizeRoll >= 0.52
            ? 3000 + Math.floor(r() * 5000)
            : sizeRoll >= 0.24
              ? 1400 + Math.floor(r() * 1600)
              : 120 + Math.floor(r() * 900);
      }
      const recall = mood === 5 && kind === "cars" && r() < 0.38;
      const rate = freightRate(nm, kind, contract, grey, r());
      lots.push({
        id: uid("lot"),
        origin: p.id,
        dest,
        brand: recall ? "Viking Volt" : pick(BRANDS, r),
        kind,
        ceu,
        hh,
        rate,
        contract,
        deadline: s.day + (kind === "hh" ? 8 : 6) + Math.floor(r() * 14),
        grey,
        note: recall ? "recall" : r() < 0.14 ? pick(LOT_FLAVOUR, r) : undefined,
      });
    }
    s.lots[p.id] = shuffle(lots, r);
  }
}
function rSalt(s) {
  return ((s.seed >>> 0) ^ (s.day * 7919) ^ ((s.cash | 0) >>> 3)) / 4294967296;
}
export function refreshMarket(s, force = false) {
  if (!force && s.day - s.marketDay < 12) return;
  const r = rng(((s.seed >>> 0) || 1) + s.day * 31 + 7);
  s.marketDay = s.day;
  const n = 3 + Math.floor(r() * 2);
  const pool = shuffle(HULLS, r);
  const names = shuffle(SHIP_NAMES, r);
  const offers: MarketOffer[] = [];
  for (let i = 0; i < n && i < pool.length; i++) {
    const h = pool[i];
    const condition = Math.round(52 + r() * 46);
    const jitter = 0.82 + r() * 0.32;
    const condF = 0.55 + 0.45 * (condition / 100);
    const price = Math.round(h.price * condF * jitter);
    offers.push({
      id: uid("mkt"),
      hullId: h.id,
      name: names[i] || h.name,
      year: h.year - Math.floor(r() * 4),
      price,
      condition,
    });
  }
  s.market = offers;
}
export function refreshTc(s, force = false) {
  if (!force && s.day - (s.tcDay ?? -99) < 8) return;
  const r = rng(((s.seed >>> 0) || 1) + s.day * 17 + 5);
  s.tcDay = s.day;
  const n = 3 + Math.floor(r() * 3);
  const pool = shuffle(HULLS, r);
  const names = shuffle(SHIP_NAMES, r);
  const desks = shuffle(TC_DESKS, r);
  const daysOpt = [14, 21, 30, 45, 60];
  const offers: TcOffer[] = [];
  for (let i = 0; i < n && i < pool.length; i++) {
    const h = pool[i];
    const days = daysOpt[Math.floor(r() * daysOpt.length)];
    const rate = Math.round(h.opex * (1.45 + r() * 1.1) * (0.92 + (h.year - 1998) * 0.006));
    offers.push({
      id: uid("tc"),
      hullId: h.id,
      name: names[i] || h.name,
      year: h.year,
      rate,
      days,
      condition: Math.round(68 + r() * 30),
      owner: desks[i] || "The Desk",
    });
  }
  s.tc = offers;
}
export function ensureMarket(s) {
  if (s.market?.length && s.tc?.length) return s;
  const next = {
    ...s,
    market: [...(s.market ?? [])],
    marketDay: s.marketDay ?? -99,
    tc: [...(s.tc ?? [])],
    tcDay: s.tcDay ?? -99,
    charters: [...(s.charters ?? [])],
    seed: s.seed ?? hashStr(s.company || s.captain || "skipper"),
  };
  if (!next.market.length) refreshMarket(next, true);
  if (!next.tc.length) refreshTc(next, true);
  return next;
}
export function idleState(): GameState {
  return {
    phase: "title",
    captain: "",
    company: "",
    director: "",
    day: 0,
    cash: 0,
    debt: 0,
    reputation: 55,
    co2t: 0,
    fines: 0,
    voyages: 0,
    deliveredCeu: 0,
    heat: 0,
    ets: null,
    etsAcc: 0,
    lastEtsMonth: -1,
    fleet: [],
    activeId: null,
    selectedPort: "zeebrugge",
    lots: {},
    market: [],
    marketDay: -99,
    tc: [],
    tcDay: -99,
    charters: [],
    seed: 1,
    legs: [],
    event: null,
    news: [],
    log: [],
    tab: "yard",
    endKind: null,
    milestones: [],
  };
}
export function freshState(company, director): GameState {
  const line = String(company ?? "").trim() || "Fantasy Line";
  const boss = String(director ?? "").trim() || "Director";
  const seed = (hashStr(line + "|" + boss) ^ (Date.now() & 0xffffffff) ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0;
  const r0 = rng(seed);
  const yards = PORTS.filter((p) => p.yard).map((p) => p.id);
  const selectedPort = yards[Math.floor(r0() * yards.length)] || "zeebrugge";
  const s: GameState = {
    phase: "port",
    captain: line,
    company: line,
    director: boss,
    day: 0,
    cash: 44e5,
    debt: 0,
    reputation: 55,
    co2t: 0,
    fines: 0,
    voyages: 0,
    deliveredCeu: 0,
    heat: 0,
    ets: null,
    etsAcc: 0,
    lastEtsMonth: -1,
    fleet: [],
    activeId: null,
    selectedPort,
    lots: {},
    market: [],
    marketDay: -99,
    tc: [],
    tcDay: -99,
    charters: [],
    seed,
    legs: [],
    event: null,
    news: newsFor(0, seed),
    log: [],
    tab: "yard",
    endKind: null,
    milestones: [],
  };
  refillLots(s);
  refreshMarket(s, true);
  refreshTc(s, true);
  log(
    s,
    `Fantasy Shipping opens ${line} under ${boss} with a berth in ${portName(selectedPort)}. Buy a RoRo — or hire one on TC if you like living lean.`,
  );
  return s;
}
function maybeEnd(s) {
  const done = s.milestones ?? [];
  if (!done.includes("broke") && s.cash - (s.debt ?? 0) < -4e5 && s.fleet.length === 0) return endCareer(s, "broke");
  if (!done.includes("green") && s.cash >= 12e6 && fleetGreen(s)) return endCareer(s, "green");
  if (!done.includes("wealth") && s.cash + fleetBook(s) >= 18e6) return endCareer(s, "wealth");
  if (!done.includes("retired") && s.day >= 2190) return endCareer(s, "retired");
  return s;
}
function fleetBook(s) {
  return s.fleet.reduce((a, sh) => a + (sh.charter === "in" ? 0 : hullValue(sh)), 0);
}
function fleetGreen(s) {
  return (
    s.fleet.length > 0 &&
    s.fleet.every((sh) => sh.fuel === "lng") &&
    s.reputation >= 70 &&
    s.co2t < 8e3
  );
}
export function endCareer(s, kind) {
  return {
    ...s,
    phase: "end",
    endKind: kind,
  };
}
export function resumeCareer(s) {
  const kind = s.endKind ?? "retired";
  const done = new Set(s.milestones ?? []);
  done.add(kind);
  if (s.cash - (s.debt ?? 0) < -4e5 && s.fleet.length === 0) done.add("broke");
  if (s.cash >= 12e6 && fleetGreen(s)) done.add("green");
  if (s.cash + fleetBook(s) >= 18e6) done.add("wealth");
  if (s.day >= 2190) done.add("retired");
  const next = {
    ...s,
    phase: "port",
    endKind: null,
    event: null,
    milestones: [...done],
  };
  if (kind === "broke") {
    next.cash = Math.max(next.cash, 2_400_000);
    next.debt = (next.debt ?? 0) + 2_400_000;
    log(next, "HQ posts an emergency line. Ugly interest. You still have a berth.");
  } else {
    log(next, "Checkpoint posted. The line keeps trading.");
  }
  return next;
}
function spawnFromHull(h, s, condition, port) {
  return {
    id: uid("ship"),
    name: h.name,
    hullId: h.id,
    year: h.year,
    ceu: h.ceu,
    hhCap: h.hhCap,
    burn: h.burn,
    fuel: h.fuel,
    ice: h.ice,
    speed: h.speed,
    opex: h.opex,
    condition,
    bunkers: Math.round(h.bunkerCap * 0.45),
    bunkerCap: h.bunkerCap,
    lastDrydock: s.day,
    upgrades: h.ice ? ["ice"] : [],
    hold: [],
    port,
    atSea: false,
    etsAcc: 0,
    charter: null,
  };
}
export function buyHull(s, hullId) {
  const h = hullById(hullId);
  if (!h) return s;
  if (s.cash < h.price) return s;
  const ship = spawnFromHull(h, s, h.year >= 2020 ? 96 : h.year >= 2010 ? 82 : 68, s.selectedPort);
  const next = {
    ...s,
    cash: s.cash - h.price,
    fleet: [...s.fleet, ship],
    activeId: ship.id,
    tab: "cargo",
  };
  log(
    next,
    `Bought M/V ${ship.name} (${ship.year}). ${ship.fuel === "lng" ? "LNG dual-fuel." : "MGO only — higher ETS."} H&H deck ${ship.hhCap}. ${ship.opex} €/day in opex.`,
  );
  return next;
}
export function buyOffer(s, offerId) {
  const offer = s.market.find((o) => o.id === offerId);
  if (!offer) return s;
  const h = hullById(offer.hullId);
  if (!h) return s;
  if (s.cash < offer.price) return s;
  const ship = spawnFromHull(h, s, offer.condition, s.selectedPort);
  ship.name = offer.name;
  ship.year = offer.year;
  const next = {
    ...s,
    cash: s.cash - offer.price,
    fleet: [...s.fleet, ship],
    activeId: ship.id,
    tab: "cargo",
    market: s.market.filter((o) => o.id !== offerId),
  };
  log(
    next,
    `Bought M/V ${ship.name} off the market (${ship.year}, ${Math.round(ship.condition)}% condition) for ${offer.price} euro. H&H ${ship.hhCap}. ${ship.fuel === "lng" ? "LNG." : "MGO — watch ETS."}`,
  );
  return next;
}
export function sellShip(s, shipId) {
  const ship = s.fleet.find((x) => x.id === shipId);
  if (!ship || ship.atSea || ship.charter) return s;
  const dumped = ship.hold.length;
  const price = Math.round(hullValue(ship) * (dumped ? 0.92 : 1));
  const fleet = s.fleet.filter((x) => x.id !== shipId);
  const next = {
    ...s,
    cash: s.cash + price,
    reputation: dumped ? Math.max(8, s.reputation - 4) : s.reputation,
    fleet,
    legs: s.legs.filter((v) => v.shipId !== shipId),
    activeId: s.activeId === shipId ? (fleet[0]?.id ?? null) : s.activeId,
    tab: fleet.length ? s.tab : "yard",
  };
  log(
    next,
    dumped
      ? `Sold M/V ${ship.name} for ${price} euro with ${dumped} lots still on deck. The buyer kept the cars. You kept the embarrassment.`
      : `Sold M/V ${ship.name} for ${price} euro${ship.condition < 55 ? " — the rust was part of the charm, said the buyer, quietly." : "."}`,
  );
  return maybeEnd(repayKeep(next, 80_000));
}
export function takeTcIn(s, offerId) {
  const offer = (s.tc ?? []).find((o) => o.id === offerId);
  if (!offer) return s;
  const h = hullById(offer.hullId);
  if (!h) return s;
  const deposit = offer.rate * 7;
  if (s.cash < deposit) return s;
  const ship = spawnFromHull(h, s, offer.condition, s.selectedPort);
  ship.name = offer.name;
  ship.year = offer.year;
  ship.charter = "in";
  const ch = {
    id: uid("ch"),
    kind: "in",
    shipId: ship.id,
    hullId: h.id,
    name: ship.name,
    rate: offer.rate,
    untilDay: s.day + offer.days,
    deposit,
  };
  const next = {
    ...s,
    cash: s.cash - deposit,
    fleet: [...s.fleet, ship],
    activeId: ship.id,
    charters: [...(s.charters ?? []), ch],
    tc: (s.tc ?? []).filter((o) => o.id !== offerId),
    tab: "cargo",
  };
  log(
    next,
    `Took M/V ${ship.name} on time charter — ${offer.rate} €/day for ${offer.days} days. Deposit ${deposit} euro held. You trade, they own the rust.`,
  );
  return next;
}
export function charterOut(s, shipId, days = 30) {
  const ship = s.fleet.find((x) => x.id === shipId);
  if (!ship || ship.atSea || ship.hold.length || ship.charter) return s;
  const rate = Math.round(ship.opex * (1.32 + ship.condition / 280));
  const n = days === 14 || days === 21 || days === 45 || days === 60 ? days : 30;
  const ch = {
    id: uid("ch"),
    kind: "out",
    shipId: ship.id,
    hullId: ship.hullId,
    name: ship.name,
    rate,
    untilDay: s.day + n,
    deposit: 0,
  };
  const next = {
    ...s,
    fleet: s.fleet.map((sh) => (sh.id === ship.id ? { ...sh, charter: "out" } : sh)),
    charters: [...(s.charters ?? []), ch],
  };
  log(
    next,
    `M/V ${ship.name} fixed out on TC at ${rate} €/day for ${n} days. Someone else can argue with the dockers.`,
  );
  return next;
}
function tickCharters(s, days) {
  const list = s.charters ?? [];
  if (!list.length) return s;
  let cash = s.cash;
  for (const c of list) {
    cash += (c.kind === "out" ? c.rate : -c.rate) * days;
  }
  let next = { ...s, cash, charters: [...list] };
  const due = next.charters.filter((c) => next.day >= c.untilDay);
  for (const c of due) {
    next = redeliver(next, c.id);
    if (next.phase === "end") break;
  }
  return next;
}
function redeliver(s, charterId) {
  const c = (s.charters ?? []).find((x) => x.id === charterId);
  if (!c) return s;
  const ship = s.fleet.find((x) => x.id === c.shipId);
  if (c.kind === "out") {
    const next = {
      ...s,
      charters: s.charters.filter((x) => x.id !== c.id),
      fleet: s.fleet.map((sh) =>
        sh.id === c.shipId
          ? { ...sh, charter: null, condition: Math.max(12, sh.condition - 3), atSea: false }
          : sh,
      ),
    };
    log(next, `Off hire: M/V ${c.name} is back alongside. Hire was ${c.rate} €/day.`);
    return next;
  }
  if (!ship) {
    return { ...s, charters: s.charters.filter((x) => x.id !== c.id) };
  }
  if (ship.atSea || ship.hold.length) {
    log(s, `${ship.name} is off-hire — empty the decks at the next berth.`);
    return {
      ...s,
      charters: s.charters.map((x) => (x.id === c.id ? { ...x, untilDay: s.day + 1 } : x)),
    };
  }
  const refund = Math.round(c.deposit * Math.max(0.35, ship.condition / 100));
  const fleet = s.fleet.filter((x) => x.id !== ship.id);
  const next = {
    ...s,
    cash: s.cash + refund,
    fleet,
    charters: s.charters.filter((x) => x.id !== c.id),
    activeId: s.activeId === ship.id ? (fleet[0]?.id ?? null) : s.activeId,
    tab: fleet.length ? s.tab : "charter",
  };
  log(next, `Redelivered M/V ${ship.name}. Deposit back: ${refund} euro. The owner counted the scratches.`);
  return next;
}
export function setActive(s, id) {
  const sh = s.fleet.find((x) => x.id === id);
  if (!sh) return s;
  const leg = shipLeg(s, id);
  return {
    ...s,
    activeId: id,
    selectedPort: sh.atSea ? (leg?.to ?? s.selectedPort) : sh.port,
  };
}
export function renameShip(s, id, name) {
  const n = String(name || "")
    .trim()
    .slice(0, 28);
  if (!n) return s;
  return {
    ...s,
    fleet: s.fleet.map((sh) => (sh.id === id ? { ...sh, name: n } : sh)),
  };
}
export function loadLot(s, lotId) {
  const ship = activeShip(s);
  if (!ship || ship.atSea || ship.port !== s.selectedPort || ship.charter === "out") return s;
  const quay = s.lots[s.selectedPort] ?? [];
  const lot = quay.find((l) => l.id === lotId);
  if (!lot) return s;
  if (!canLoadLot(ship, lot)) return s;
  const next = {
    ...s,
    heat: s.heat + (lot.grey ? 18 : 0),
    lots: {
      ...s.lots,
      [s.selectedPort]: quay.filter((l) => l.id !== lotId),
    },
    fleet: s.fleet.map((sh) =>
      sh.id === ship.id
        ? {
            ...sh,
            hold: [...sh.hold, lot],
          }
        : sh,
    ),
  };
  log(
    next,
    `${ship.name} loaded ${lot.ceu} CEU ${lot.kind === "hh" ? "High & Heavy " : ""}${lot.brand} for ${portName(lot.dest)}.${lot.contract ? ` Contract, deadline day ${lot.deadline}.` : ""}${lot.grey ? " Undeclared — coastguard and customs can take you." : ""}${lot.note ? " Odd parcel." : ""}`,
  );
  return next;
}
export function dischargeHere(s) {
  const ship = activeShip(s);
  if (!ship || ship.atSea) return s;
  const here = ship.hold.filter((l) => l.dest === ship.port);
  if (!here.length) return s;
  let pay = 0;
  let ceu = 0;
  let rep = 0;
  for (const l of here) {
    const late = Math.max(0, s.day - l.deadline);
    let p = Math.round(l.ceu * l.rate);
    if (l.contract && late > 0) p = Math.round(p * Math.max(0.2, 1 - late * 0.1));
    pay += p;
    ceu += l.ceu;
    if (l.contract && late <= 0) rep += 2;
    else if (l.contract && late > 0) rep -= 3;
    else if (!l.grey) rep += 1;
  }
  let next = {
    ...s,
    cash: s.cash + pay,
    deliveredCeu: s.deliveredCeu + ceu,
    reputation: Math.max(5, Math.min(100, s.reputation + rep)),
    fleet: s.fleet.map((sh) =>
      sh.id === ship.id ? { ...sh, hold: sh.hold.filter((l) => l.dest !== ship.port) } : sh,
    ),
  };
  log(next, `Discharged ${ceu} CEU in ${portName(ship.port)}. Freight ${pay} euro.`);
  next = skimDebt(next, pay);
  return maybeEnd(next);
}
export function bunker(s, tons) {
  const ship = activeShip(s);
  if (!ship || ship.atSea || tons <= 0) return s;
  const port = getPort(ship.port);
  if (ship.fuel === "lng" && !port.lng) return s;
  const price = ship.fuel === "lng" && port.lng ? port.bunker * 0.85 : port.bunker;
  const take = Math.min(tons, Math.max(0, ship.bunkerCap - ship.bunkers));
  const cost = Math.round(take * price);
  if (take < 1 || s.cash < cost) return s;
  const next = {
    ...s,
    cash: s.cash - cost,
    fleet: s.fleet.map((sh) => (sh.id === ship.id ? { ...sh, bunkers: sh.bunkers + take } : sh)),
  };
  log(next, `Bunkered ${Math.round(take)} t ${ship.fuel.toUpperCase()} in ${portName(ship.port)} for ${cost} euro.`);
  return next;
}
export function repair(s) {
  const ship = activeShip(s);
  if (!ship || ship.atSea) return s;
  const need = 100 - ship.condition;
  if (need < 1) return s;
  const cost = Math.round(need * 2800);
  if (s.cash < cost) return s;
  const next = {
    ...s,
    cash: s.cash - cost,
    fleet: s.fleet.map((sh) =>
      sh.id === ship.id
        ? {
            ...sh,
            condition: 100,
          }
        : sh,
    ),
  };
  log(next, `Repair ${need}% on ${ship.name} in ${portName(ship.port)}.`);
  return next;
}
export function drydock(s) {
  const ship = activeShip(s);
  if (!ship || ship.atSea || !canDrydock(ship.port)) return s;
  const days = 8;
  const cost = 18e4 + (100 - ship.condition) * 2200;
  if (s.cash < cost) return s;
  let next = {
    ...s,
    cash: s.cash - cost,
    day: s.day + days,
    fleet: s.fleet.map((sh) =>
      sh.id === ship.id
        ? {
            ...sh,
            condition: 100,
            lastDrydock: s.day + days,
            bunkers: Math.max(0, sh.bunkers - 12),
          }
        : sh,
    ),
  };
  log(
    next,
    `Drydock and classing of M/V ${ship.name} in ${portName(ship.port)}. ${days} days, ${cost} euro.`,
  );
  refreshMarket(next);
  refreshTc(next);
  next = tickOpex(next, days);
  next = tickCharters(next, days);
  next = advanceLegs(next, days, false);
  return maybeEts(next);
}
export function fitUpgrade(s, id) {
  const ship = activeShip(s);
  const u = UPGRADES.find((x) => x.id === id);
  if (!ship || !u || ship.atSea || (ship.upgrades ?? []).includes(id)) return s;
  if (s.cash < u.cost) return s;
  const ice = id === "ice" ? true : ship.ice;
  const hhCap = ship.hhCap + (u.hhBonus ?? 0);
  const next = {
    ...s,
    cash: s.cash - u.cost,
    fleet: s.fleet.map((sh) =>
      sh.id === ship.id
        ? {
            ...sh,
            upgrades: [...sh.upgrades, id],
            ice,
            hhCap,
          }
        : sh,
    ),
  };
  log(next, `Fitted ${id} on M/V ${ship.name}.`);
  return next;
}
export function waitDay(s) {
  const ship = activeShip(s);
  if (ship?.atSea) return s;
  let next = {
    ...s,
    day: s.day + 1,
  };
  if (ship) log(next, `Lay alongside in ${portName(ship.port)}. The coffee is worse than the bunkers.`);
  refillLots(next);
  refreshMarket(next);
  refreshTc(next);
  next = tickOpex(next, 1);
  next = tickCharters(next, 1);
  next = advanceLegs(next, 1, true);
  if (next.phase === "event" || next.phase === "end") return maybeEts(next);
  if (ship && !ship.atSea && ship.charter !== "out" && Math.random() < 0.32) return pickQuayEvent(maybeEts(next));
  return maybeEts(next);
}
function tickOpex(s, days) {
  const opex = s.fleet.filter((sh) => sh.charter !== "in").reduce((a, sh) => a + sh.opex, 0) * days;
  return applyDebt(
    {
      ...s,
      cash: s.cash - opex,
    },
    days,
  );
}
function applyDebt(s, days) {
  let debt = s.debt ?? 0;
  if (debt <= 0 || days <= 0) return s;
  const n = Math.max(1, Math.round(days));
  for (let i = 0; i < n; i++) debt = Math.round(debt * 1.0015);
  return { ...s, debt };
}
function skimDebt(s, inflow) {
  const debt = s.debt ?? 0;
  if (debt <= 0 || inflow <= 0) return s;
  const cut = Math.min(debt, Math.round(inflow * 0.35));
  if (cut <= 0) return s;
  const next = { ...s, cash: s.cash - cut, debt: debt - cut };
  log(next, `Loan desk took ${cut} euro of the freight. ${next.debt} still outstanding.`);
  return next;
}
function repayKeep(s, keep) {
  const debt = s.debt ?? 0;
  if (debt <= 0) return s;
  const spare = s.cash - keep;
  if (spare <= 0) return s;
  const pay = Math.min(debt, spare);
  const next = { ...s, cash: s.cash - pay, debt: debt - pay };
  log(next, pay >= debt ? `Cleared the bunker loan.` : `Paid ${pay} euro on the bunker loan.`);
  return next;
}
export function takeLoan(s) {
  if (!canTakeLoan(s)) return s;
  const offer = loanOffer(s);
  const next = {
    ...s,
    cash: s.cash + offer.principal,
    debt: (s.debt ?? 0) + offer.due,
    reputation: Math.max(12, (s.reputation ?? 55) - 4),
  };
  log(
    next,
    `Took a bunker loan: ${offer.principal} euro on the account, ${offer.due} euro to repay. Expensive paper — 32 percent and 0.15 percent a day.`,
  );
  return next;
}
export function repayLoan(s) {
  const debt = s.debt ?? 0;
  if (debt <= 0 || s.cash <= 0) return s;
  const pay = Math.min(debt, s.cash);
  const next = {
    ...s,
    cash: s.cash - pay,
    debt: debt - pay,
  };
  log(
    next,
    pay >= debt ? `Cleared the bunker loan. Paid ${pay} euro.` : `Paid ${pay} euro on the bunker loan. ${debt - pay} still outstanding.`,
  );
  return next;
}
function maybeEts(s) {
  if (s.ets) return s;
  const key = monthKey(s.day);
  if (s.lastEtsMonth < 0)
    return {
      ...s,
      lastEtsMonth: key,
    };
  if (key === s.lastEtsMonth) return s;
  const ships = s.fleet
    .map((sh) => ({
      name: sh.name,
      t: Math.round(sh.etsAcc),
    }))
    .filter((x) => x.t > 0);
  const t = ships.reduce((a, x) => a + x.t, 0) || Math.round(s.etsAcc);
  const fleet = s.fleet.map((sh) => ({
    ...sh,
    etsAcc: 0,
  }));
  if (t < 20)
    return {
      ...s,
      lastEtsMonth: key,
      etsAcc: 0,
      fleet,
    };
  const price = 72 + Math.round((key % 11) * 1.8);
  return {
    ...s,
    lastEtsMonth: key,
    etsAcc: 0,
    fleet,
    ets: {
      t,
      price,
      ships,
    },
  };
}
export function payEts(s) {
  if (!s.ets) return s;
  const bill = Math.round(s.ets.t * s.ets.price);
  const next = {
    ...s,
    cash: s.cash - bill,
    ets: null,
    etsAcc: 0,
    fleet: s.fleet.map((sh) => ({
      ...sh,
      etsAcc: 0,
    })),
  };
  log(next, `EU ETS monthly quota settled: ${s.ets.t} t × ${s.ets.price} € = ${bill} euro.`);
  return maybeEnd(next);
}
export function sailCheck(s, dest) {
  const ship = activeShip(s);
  if (s.ets) return "sail.ets";
  if (!ship) return "sail.noShip";
  if (ship.charter === "out") return "sail.tc";
  if (ship.atSea) return "sail.notPort";
  if (dest === ship.port) return "sail.here";
  if (ship.condition < 18) return "sail.repair";
  if (s.day - ship.lastDrydock > 400) return "sail.classing";
  const { nm } = seaRoute(ship.port, dest);
  const need = burnPerNm(ship) * nm * 1.08;
  if (ship.bunkers < need) return "sail.bunkers";
  return null;
}
export function setCourse(s, dest, fullRevs = false) {
  if (sailCheck(s, dest)) return s;
  const ship = activeShip(s);
  const { path, nm } = seaRoute(ship.port, dest);
  const speed =
    ship.speed * (fullRevs ? 1.12 : 1) * (ship.condition / 100) * 0.5 + ship.speed * 0.5;
  const days = Math.max(0.6, nm / (speed * 24));
  const leg = {
    shipId: ship.id,
    from: ship.port,
    to: dest,
    path,
    nm,
    travelled: 0,
    days,
    eta: s.day + days,
    fullRevs,
  };
  const next = {
    ...s,
    phase: "port",
    selectedPort: dest,
    legs: [...s.legs.filter((v) => v.shipId !== ship.id), leg],
    fleet: s.fleet.map((sh) =>
      sh.id === ship.id
        ? {
            ...sh,
            atSea: true,
          }
        : sh,
    ),
  };
  log(
    next,
    `${ship.name} sailed ${portName(ship.port)} for ${portName(dest)}. ${Math.round(nm)} nm by sea, eta ${days.toFixed(1)} days.`,
  );
  return next;
}
function advanceLegs(s, dtDays, events) {
  let next = s;
  for (const id of s.legs.map((v) => v.shipId)) {
    if (!next.legs.some((v) => v.shipId === id)) continue;
    next = tickOne(next, id, dtDays, events);
    if (next.phase === "event" || next.phase === "end") break;
  }
  return next;
}
function tickOne(s, shipId, dtDays, events) {
  const v = shipLeg(s, shipId);
  if (!v) return s;
  const ship = s.fleet.find((x) => x.id === shipId);
  if (!ship) return s;
  const add = (v.nm / Math.max(0.2, v.days)) * dtDays;
  const travelled = Math.min(v.nm, v.travelled + add);
  const burn = burnPerNm(ship) * (travelled - v.travelled);
  const emitted = burn * (ship.fuel === "lng" ? 2.75 : 3.2) * etsFactor(ship);
  const etsT = emitted * etsShare(v.from, v.to);
  const fleet = s.fleet.map((sh) =>
    sh.id === ship.id
      ? {
          ...sh,
          bunkers: Math.max(0, sh.bunkers - burn),
          condition: Math.max(12, sh.condition - dtDays * (v.fullRevs ? 0.35 : 0.12)),
          etsAcc: sh.etsAcc + etsT,
        }
      : sh,
  );
  const next = {
    ...s,
    co2t: s.co2t + emitted,
    etsAcc: s.etsAcc + etsT,
    legs: s.legs.map((x) =>
      x.shipId === shipId
        ? {
            ...v,
            travelled,
          }
        : x,
    ),
    fleet,
  };
  if (travelled >= v.nm - 0.5) return arriveShip(next, shipId);
  if (events && Math.random() < dtDays * 0.16)
    return pickEvent({
      ...next,
      activeId: shipId,
    });
  return next;
}
export function tickVoyage(s, dtDays) {
  if (s.phase === "event" || s.phase === "end" || s.phase === "title") return s;
  if (!s.legs.length) return s;
  let next = {
    ...s,
    day: s.day + dtDays,
  };
  next = tickOpex(next, dtDays);
  next = tickCharters(next, dtDays);
  next = advanceLegs(next, dtDays, true);
  return maybeEnd(maybeEts(next));
}
function arriveShip(s, shipId) {
  const v = shipLeg(s, shipId);
  if (!v) return s;
  const ship = s.fleet.find((x) => x.id === shipId);
  if (!ship) return s;
  const next = {
    ...s,
    selectedPort: s.activeId === shipId ? v.to : s.selectedPort,
    legs: s.legs.filter((x) => x.shipId !== shipId),
    voyages: s.voyages + 1,
    heat: Math.max(0, s.heat - 4),
    fleet: s.fleet.map((sh) =>
      sh.id === ship.id
        ? {
            ...sh,
            atSea: false,
            port: v.to,
          }
        : sh,
    ),
    news: newsFor(s.day, s.seed),
  };
  log(
    next,
    `${ship.name} arrived ${portName(v.to)}. ${Math.round(v.nm)} nm in ${v.days.toFixed(1)} days.`,
  );
  refillLots(next);
  refreshMarket(next);
  refreshTc(next);
  const grey = ship.hold.some((l) => l.grey);
  if (CUSTOMS_HUBS.has(v.to) && (grey || next.heat >= 22) && Math.random() < (grey ? 0.55 : 0.32))
    return customsEvent({
      ...next,
      activeId: shipId,
      selectedPort: v.to,
    });
  return maybeEnd(maybeEts(next));
}
export function customsEvent(s) {
  const grey = activeShip(s)?.hold.some((l) => l.grey) ?? false;
  return {
    ...s,
    phase: "event",
    event: {
      id: "customs",
      title: "event.customs.title",
      body: grey ? "event.customs.bodyGrey" : "event.customs.body",
      a: {
        id: "open",
        label: "event.customs.open",
        hint: grey ? "event.customs.openGrey" : "event.customs.openClean",
      },
      b: {
        id: "bribe",
        label: "event.customs.bribe",
        hint: "event.customs.bribeHint",
      },
    },
  };
}
function pickQuayEvent(s) {
  const r = Math.random();
  let ev;
  if (r < 0.32)
    ev = {
      id: "radio",
      title: "event.radio.title",
      body: "event.radio.body",
      a: { id: "take", label: "event.radio.take", hint: "event.radio.takeHint" },
      b: { id: "pass", label: "event.radio.pass", hint: "event.radio.passHint" },
    };
  else if (r < 0.52)
    ev = {
      id: "hhdeal",
      title: "event.hhdeal.title",
      body: "event.hhdeal.body",
      a: { id: "take", label: "event.hhdeal.take", hint: "event.hhdeal.takeHint" },
      b: { id: "pass", label: "event.hhdeal.pass", hint: "event.hhdeal.passHint" },
    };
  else if (r < 0.74)
    ev = {
      id: "pilot",
      title: "event.pilot.title",
      body: "event.pilot.body",
      a: { id: "pay", label: "event.pilot.pay", hint: "event.pilot.payHint" },
      b: { id: "wait", label: "event.pilot.wait", hint: "event.pilot.waitHint" },
    };
  else
    ev = {
      id: "union",
      title: "event.union.title",
      body: "event.union.body",
      a: { id: "pay", label: "event.union.pay", hint: "event.union.payHint" },
      b: { id: "wait", label: "event.union.wait", hint: "event.union.waitHint" },
    };
  return { ...s, phase: "event", event: ev };
}
export function pickEvent(s) {
  const ship = activeShip(s);
  const v = activeLeg(s);
  const r = Math.random();
  const grey = ship?.hold.some((l) => l.grey) ?? false;
  const hasHh = ship?.hold.some((l) => (l.hh ?? 0) > 0) ?? false;
  let ev;
  const icePorts = new Set(["paldiski", "helsinki", "gdansk"]);
  if (v && isWinter(s.day) && (icePorts.has(v.to) || icePorts.has(v.from)) && r < 0.48)
    ev = {
      id: "ice",
      title: "event.ice.title",
      body: ship?.ice ? "event.ice.bodyClass" : "event.ice.body",
      a: { id: "wait", label: "event.ice.wait", hint: "event.ice.waitHint" },
      b: { id: "force", label: "event.ice.force", hint: "event.ice.forceHint" },
    };
  else if (grey && r < 0.32)
    ev = {
      id: "coastguard",
      title: "event.coastguard.title",
      body: "event.coastguard.body",
      a: { id: "heave", label: "event.heave", hint: "event.heaveHint" },
      b: { id: "run", label: "event.run", hint: "event.runHint" },
    };
  else if (s.heat >= 16 && r < 0.42)
    ev = {
      id: "patrol",
      title: "event.patrol.title",
      body: "event.patrol.body",
      a: { id: "heave", label: "event.heave", hint: "event.heaveHint" },
      b: { id: "bribe", label: "event.customs.bribe", hint: "event.customs.bribeHint" },
    };
  else if (hasHh && r < 0.38)
    ev = {
      id: "hhshift",
      title: "event.hhshift.title",
      body: "event.hhshift.body",
      a: { id: "secure", label: "event.lash.secure", hint: "event.lash.secureHint" },
      b: { id: "go", label: "event.lash.go", hint: "event.hhshift.goHint" },
    };
  else if (r < 0.18)
    ev = {
      id: "storm",
      title: "event.storm.title",
      body: "event.storm.body",
      a: { id: "slow", label: "event.storm.slow", hint: "event.storm.slowHint" },
      b: { id: "push", label: "event.storm.push", hint: "event.storm.pushHint" },
    };
  else if (r < 0.3)
    ev = {
      id: "engine",
      title: "event.engine.title",
      body: "event.engine.body",
      a: { id: "limp", label: "event.engine.limp", hint: "event.engine.limpHint" },
      b: { id: "fix", label: "event.engine.fix", hint: "event.engine.fixHint" },
    };
  else if (r < 0.4)
    ev = {
      id: "fuelcontam",
      title: "event.fuel.title",
      body: "event.fuel.body",
      a: { id: "purify", label: "event.fuel.purify", hint: "event.fuel.purifyHint" },
      b: { id: "burn", label: "event.fuel.burn", hint: "event.fuel.burnHint" },
    };
  else if (r < 0.5)
    ev = {
      id: "lash",
      title: "event.lash.title",
      body: "event.lash.body",
      a: { id: "secure", label: "event.lash.secure", hint: "event.lash.secureHint" },
      b: { id: "go", label: "event.lash.go", hint: "event.lash.goHint" },
    };
  else if (r < 0.56)
    ev = {
      id: "hhdeal",
      title: "event.hhdeal.title",
      body: "event.hhdeal.bodySea",
      a: { id: "take", label: "event.hhdeal.take", hint: "event.hhdeal.takeHint" },
      b: { id: "pass", label: "event.hhdeal.pass", hint: "event.hhdeal.passHint" },
    };
  else if (r < 0.64)
    ev = {
      id: "cook",
      title: "event.cook.title",
      body: "event.cook.body",
      a: { id: "vent", label: "event.cook.vent", hint: "event.cook.ventHint" },
      b: { id: "go", label: "event.cook.go", hint: "event.cook.goHint" },
    };
  else if (r < 0.8 && s.heat < 48)
    ev = {
      id: "radio",
      title: "event.radio.titleVhf",
      body: "event.radio.bodyVhf",
      a: { id: "take", label: "event.radio.take", hint: "event.radio.takeHint" },
      b: { id: "pass", label: "event.radio.pass", hint: "event.radio.passHint" },
    };
  else
    ev = {
      id: "fog",
      title: "event.fog.title",
      body: "event.fog.body",
      a: { id: "wait", label: "event.fog.wait", hint: "event.fog.waitHint" },
      b: { id: "radar", label: "event.fog.radar", hint: "event.fog.radarHint" },
    };
  return {
    ...s,
    phase: "event",
    event: ev,
  };
}
export function resolveEvent(s, choice) {
  const ev = s.event;
  if (!ev) return s;
  if (ev.id === "arrest")
    return {
      ...s,
      phase: "port",
      event: null,
    };
  const ship = activeShip(s);
  const v = activeLeg(s);
  let next = {
    ...s,
    phase: "port",
    event: null,
  };
  const bump = (days) => {
    next = {
      ...next,
      day: next.day + days,
    };
    if (ship)
      next = {
        ...next,
        legs: next.legs.map((x) =>
          x.shipId === ship.id
            ? {
                ...x,
                days: x.days + days,
                eta: x.eta + days,
              }
            : x,
        ),
      };
  };
  const dmg = (n) => {
    if (!ship) return;
    next = {
      ...next,
      fleet: next.fleet.map((sh) =>
        sh.id === ship.id
          ? {
              ...sh,
              condition: Math.max(8, sh.condition - n),
            }
          : sh,
      ),
    };
  };
  const seizeGrey = () => {
    if (!ship) return 0;
    const fine = 8e4 + ship.hold.filter((l) => l.grey).reduce((a, l) => a + l.ceu * 40, 0);
    next = {
      ...next,
      cash: next.cash - fine,
      fines: next.fines + fine,
      heat: Math.max(0, next.heat - 20),
      reputation: Math.max(5, next.reputation - 12),
      fleet: next.fleet.map((sh) =>
        sh.id === ship.id
          ? {
              ...sh,
              hold: sh.hold.filter((l) => !l.grey),
            }
          : sh,
      ),
    };
    return fine;
  };
  if (ev.id === "storm") {
    if (choice === "slow") {
      bump(0.7);
      log(next, "Reduced speed in the gale. Cargo held. A hat did not.");
    } else {
      dmg(9);
      log(next, "Held off-speed. The sea took the decks, and a bit of dignity.");
    }
  } else if (ev.id === "engine") {
    if (choice === "limp") {
      bump(1.2);
      log(next, "Limped in on one engine. The chief wants a raise. Denied.");
    } else {
      next = {
        ...next,
        cash: next.cash - 18e3,
      };
      log(next, "Jury repair at sea. −€18,000 and a wrench that will never be the same.");
    }
  } else if (ev.id === "ice") {
    if (choice === "wait") {
      bump(1.5);
      log(next, "Waited for an ice lead. The polar bear did not charge extra.");
    } else {
      dmg(ship?.ice ? 4 : 18);
      log(next, "Forced through the ice. The bow has notes.");
    }
  } else if (ev.id === "lash" || ev.id === "hhshift") {
    if (choice === "secure") {
      bump(ev.id === "hhshift" ? 0.6 : 0.4);
      log(
        next,
        ev.id === "hhshift"
          ? "Re-lashed High & Heavy. Time lost, transformer still aboard."
          : "Re-lashed cargo. Time lost, damage avoided.",
      );
    } else if (
      !(ship?.upgrades ?? []).includes("lashing") &&
      Math.random() < (ev.id === "hhshift" ? 0.55 : 0.4)
    ) {
      dmg(ev.id === "hhshift" ? 12 : 6);
      next = {
        ...next,
        cash: next.cash - (ev.id === "hhshift" ? 42e3 : 0),
      };
      log(
        next,
        ev.id === "hhshift"
          ? "H&H walked. Claim on the transformer. The mill is not amused."
          : "Sailed on with a loose lashing. Cars now slightly more used.",
      );
    } else log(next, "Sailed on. Held this time. Luck is not a lashing.");
  } else if (ev.id === "fog") {
    if (choice === "wait") {
      bump(0.6);
      log(next, "Lay to in fog. Drank tea. Missed a tide.");
    } else if (Math.random() < 0.2) {
      dmg(14);
      log(next, "Near miss in fog. Damage to bow and cargo. The other skipper waved. Rude.");
    } else log(next, "Pressed on radar. Got through the fog. Nobody to tell.");
  } else if (ev.id === "fuelcontam") {
    if (choice === "purify") {
      bump(0.5);
      if (ship)
        next = {
          ...next,
          fleet: next.fleet.map((sh) =>
            sh.id === ship.id
              ? {
                  ...sh,
                  bunkers: Math.max(8, sh.bunkers - 18),
                }
              : sh,
          ),
        };
      log(next, "Purified bunkers. Lost time, a few tons, and the cook's tasting notes.");
    } else if (Math.random() < 0.35) {
      dmg(10);
      next = {
        ...next,
        cash: next.cash - 24e3,
      };
      log(next, "Injectors took the water. Jury work and a yard bill later.");
    } else log(next, "Burned through. The engine coughed, then settled. Nobody clap.");
  } else if (ev.id === "radio") {
    if (choice === "take" && ship) {
      const wantHh = remainingHh(ship) >= 28 && Math.random() < 0.55;
      const extra = {
        id: uid("lot"),
        origin: ship.port,
        dest: v?.to ?? (ship.port === "zeebrugge" ? "baltimore" : "zeebrugge"),
        brand: pick(BRANDS, Math.random),
        kind: wantHh ? "hh" : "cars",
        ceu: wantHh ? 160 + Math.floor(Math.random() * 220) : 110 + Math.floor(Math.random() * 180),
        hh: wantHh ? 32 + Math.floor(Math.random() * 48) : 0,
        rate: wantHh ? 860 + Math.floor(Math.random() * 280) : 420 + Math.floor(Math.random() * 220),
        contract: false,
        deadline: s.day + 9,
        grey: true,
        note: "yellow",
      };
      if (remainingCeu(ship) >= extra.ceu && remainingHh(ship) >= extra.hh) {
        next = {
          ...next,
          heat: next.heat + 26,
          fleet: next.fleet.map((sh) =>
            sh.id === ship.id
              ? {
                  ...sh,
                  hold: [...sh.hold, extra],
                }
              : sh,
          ),
        };
        log(next, "Took the undeclared lot. Fat freight — and a hotter AIS picture.");
      } else {
        next = {
          ...next,
          cash: next.cash + 110e3 + Math.floor(Math.random() * 50e3),
          heat: next.heat + 10,
        };
        log(next, "Decks could not take it. Took a cash envelope under the table instead.");
      }
    } else log(next, "Declined the grey broker. Decks stay paper-clean. The tracksuit looked disappointed.");
  } else if (ev.id === "hhdeal") {
    if (choice === "take" && ship) {
      const extra = {
        id: uid("lot"),
        origin: ship.port,
        dest: v?.to ?? (ship.port === "zeebrugge" ? "yokohama" : "zeebrugge"),
        brand: pick(BRANDS, Math.random),
        kind: "hh",
        ceu: 320 + Math.floor(Math.random() * 280),
        hh: 72 + Math.floor(Math.random() * 96),
        rate: 920 + Math.floor(Math.random() * 320),
        contract: true,
        deadline: s.day + 16,
        grey: false,
        note: "wind",
      };
      if (remainingCeu(ship) >= extra.ceu && remainingHh(ship) >= extra.hh) {
        next = {
          ...next,
          reputation: Math.min(100, next.reputation + 3),
          fleet: next.fleet.map((sh) =>
            sh.id === ship.id ? { ...sh, hold: [...sh.hold, extra] } : sh,
          ),
        };
        log(next, `OEM High & Heavy on the book. ${extra.hh} units, ${extra.rate} €/CEU.`);
      } else {
        log(next, "H&H deck too small for the transformer. Fit a weather deck — or pass the charter.");
      }
    } else log(next, "Passed on the High & Heavy charter. The mill will remember, faintly.");
  } else if (ev.id === "coastguard" || ev.id === "patrol") {
    if (choice === "heave") {
      const fine = seizeGrey();
      log(
        next,
        fine ? `They took the grey cargo. Fine ${fine} euro. Clipboards: 1, skipper: 0.` : "Inspection clean. They let us go. Smile next time.",
      );
    } else if (choice === "bribe") {
      const cost = 38e3 + next.heat * 350;
      next = {
        ...next,
        cash: next.cash - cost,
      };
      if (Math.random() < 0.38) {
        log(next, `The envelope was not enough. Fine on top.`);
        next = arrest(next);
        return next;
      }
      next = {
        ...next,
        heat: Math.max(0, next.heat - 6),
      };
      log(next, `Envelope of ${cost} euro. The launch peeled off.`);
    } else if (Math.random() < 0.42) {
      const fine = seizeGrey();
      bump(10);
      log(next, `The cutter caught us. Escorted in. Fine ${fine} euro.`);
      next = arrest(next);
      return next;
    } else log(next, "Increased speed. The cutter fell off the radar. For now.");
  } else if (ev.id === "customs") {
    if (choice === "open") {
      if (ship?.hold.some((l) => l.grey)) {
        const fine = seizeGrey();
        log(next, `Customs took undeclared cargo. Fine ${fine} euro. The sports car will be missed.`);
      } else log(next, "Customs: manifests in order. They looked almost sad.");
    } else {
      const cost = 42e3 + next.heat * 400;
      next = {
        ...next,
        cash: next.cash - cost,
      };
      if (Math.random() < (ship?.hold.some((l) => l.grey) ? 0.48 : 0.28)) {
        log(next, "The envelope was refused. Harbour police take the ship.");
        next = arrest(next);
        return next;
      }
      next = {
        ...next,
        heat: Math.max(0, next.heat - 8),
      };
      log(next, `Quiet envelope of ${cost} euro. Customs looked the other way. Professionally.`);
    }
  } else if (ev.id === "pilot") {
    if (choice === "pay") {
      next = { ...next, cash: next.cash - 4500 };
      log(next, "Coffee money for the pilot. The ladder was climbed with dignity, of a sort.");
    } else {
      bump(0.4);
      log(next, "Waited for a sober pilot. The tide did not.");
    }
  } else if (ev.id === "union") {
    if (choice === "pay") {
      next = { ...next, cash: next.cash - 12000 };
      log(next, "Overtime for the dockers. The coffee break ended, allegedly.");
    } else {
      bump(1);
      log(next, "Dockers finished their coffee. Tomorrow. Maybe.");
    }
  } else if (ev.id === "cook") {
    if (choice === "vent") {
      bump(0.3);
      log(next, "Ventilated the galley. The chili was a war crime, but the ship is intact.");
    } else if (Math.random() < 0.22) {
      dmg(8);
      next = { ...next, cash: next.cash - 9000 };
      log(next, "The fire alarm was not crying wolf. Galley and paintwork.");
    } else log(next, "The chili stood down. The crew did not.");
  }
  return maybeEnd(next);
}
function arrest(s) {
  const ship = activeShip(s);
  const fine = 14e4;
  let next = {
    ...s,
    phase: "port",
    legs: s.legs.filter((v) => v.shipId !== ship?.id),
    cash: s.cash - fine,
    fines: s.fines + fine,
    heat: 0,
    reputation: Math.max(5, s.reputation - 18),
    day: s.day + 10,
    fleet: s.fleet.map((sh) =>
      sh.id === ship?.id
        ? {
            ...sh,
            atSea: false,
            port: sh.port,
            hold: sh.hold.filter((l) => !l.grey),
            condition: Math.max(20, sh.condition - 8),
          }
        : sh,
    ),
  };
  if (ship) {
    log(next, `Arrested in ${portName(ship.port)}. Fine ${fine} euro, cargo seized.`);
    log(next, `${ship.name} held alongside ten days after arrest. The coffee is worse here.`);
  }
  next = {
    ...next,
    event: {
      id: "arrest",
      title: "event.arrest.title",
      body: "event.arrest.body",
      a: {
        id: "serve",
        label: "event.arrest.serve",
        hint: "event.arrest.hint",
      },
      b: {
        id: "serve",
        label: "event.arrest.serve",
        hint: "event.arrest.hint",
      },
    },
    phase: "event",
  };
  return next;
}
