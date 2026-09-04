export type Phase = "title" | "port" | "voyage" | "event" | "end";
export type Fuel = "mgo" | "lng";
export type EndKind = "wealth" | "green" | "broke" | "retired";
export type CargoKind = "cars" | "vans" | "trucks" | "hh";
export type Tab = "cargo" | "bunkers" | "yard" | "charter" | "log";
export type Tempo = 0 | 1 | 2 | 4 | 8;
export type Atlas = "europe" | "world";
export type CharterKind = "in" | "out";

export type UpgradeId = "scrubber" | "prop" | "ice" | "lashing" | "fuelopt" | "tankcoat" | "hhdeck";

export type Lot = {
  id: string;
  origin: string;
  dest: string;
  brand: string;
  kind: CargoKind;
  ceu: number;
  hh: number;
  rate: number;
  contract: boolean;
  deadline: number;
  grey: boolean;
  note?: string;
};

export type Ship = {
  id: string;
  name: string;
  hullId: string;
  year: number;
  ceu: number;
  hhCap: number;
  burn: number;
  fuel: Fuel;
  ice: boolean;
  speed: number;
  opex: number;
  condition: number;
  bunkers: number;
  bunkerCap: number;
  lastDrydock: number;
  upgrades: UpgradeId[];
  hold: Lot[];
  port: string;
  atSea: boolean;
  etsAcc: number;
  charter?: CharterKind | null;
};

export type Voyage = {
  shipId: string;
  from: string;
  to: string;
  path: { lon: number; lat: number }[];
  nm: number;
  travelled: number;
  days: number;
  eta: number;
  fullRevs: boolean;
};

export type EventPick = {
  id: string;
  title: string;
  body: string;
  a: { id: string; label: string; hint: string };
  b: { id: string; label: string; hint: string };
};

export type EtsShipLine = { name: string; t: number };

export type EtsBill = { t: number; price: number; ships: EtsShipLine[] } | null;

export type MarketOffer = {
  id: string;
  hullId: string;
  name: string;
  year: number;
  price: number;
  condition: number;
};

export type TcOffer = {
  id: string;
  hullId: string;
  name: string;
  year: number;
  rate: number;
  days: number;
  condition: number;
  owner?: string;
};

export type Charter = {
  id: string;
  kind: CharterKind;
  shipId: string;
  hullId: string;
  name: string;
  rate: number;
  untilDay: number;
  deposit: number;
};

export type LogLine = { day: number; text: string };

export type GameState = {
  phase: Phase;
  captain: string;
  company: string;
  director: string;
  day: number;
  cash: number;
  debt: number;
  reputation: number;
  co2t: number;
  fines: number;
  voyages: number;
  deliveredCeu: number;
  heat: number;
  ets: EtsBill;
  etsAcc: number;
  lastEtsMonth: number;
  fleet: Ship[];
  activeId: string | null;
  selectedPort: string;
  lots: Record<string, Lot[]>;
  market: MarketOffer[];
  marketDay: number;
  tc: TcOffer[];
  tcDay: number;
  charters: Charter[];
  seed: number;
  legs: Voyage[];
  event: EventPick | null;
  news: string[];
  log: LogLine[];
  tab: Tab;
  endKind: EndKind | null;
  milestones: EndKind[];
};

export type UiState = {
  muted: boolean;
  about: boolean;
  settings: boolean;
  tempo: Tempo;
  lastTempo: 1 | 2 | 4 | 8;
  follow: boolean;
  atlas: Atlas;
};

export type SaveBlob = {
  v: number;
  state: GameState;
};
