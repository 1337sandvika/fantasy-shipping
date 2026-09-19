import type { Honour, HonourKind } from "../types";

export const SOCIAL_KEY = "fs-social-v1";
export const SOCIAL_VERSION = 1;

export type ChallengeKind = "ceu" | "voyage" | "profit" | "ontime" | "helm" | "event" | "green";
export type DailyKind =
  | "ceu"
  | "ontime"
  | "helm"
  | "voyage"
  | "hub"
  | "hh"
  | "lng"
  | "event"
  | "ets"
  | "fleet"
  | "green"
  | "profit"
  | "charter"
  | "ocean";

export type FriendSource = "local" | "code" | "league";

export type LineSnapshot = {
  handle: string;
  company: string;
  director: string;
  level: number;
  points: number;
  day: number;
  cash: number;
  reputation: number;
  deliveredCeu: number;
  voyages: number;
  co2t: number;
  fleetSize: number;
  honours: { kind: HonourKind; brand?: string; n?: number }[];
  onTimeStreak: number;
  preferred: string[];
  updatedAt: string;
};

export type Friend = {
  id: string;
  handle: string;
  source: FriendSource;
  leagueId?: number;
  /** Filled when a signed-in league mate is imported — hook for a future accounts API. */
  userId?: string;
  snapshot: LineSnapshot;
};

export type ChallengeStatus = "open" | "active" | "won" | "lost" | "tied" | "expired";

export type Challenge = {
  id: string;
  code: string;
  kind: ChallengeKind;
  status: ChallengeStatus;
  createdAt: string;
  expiresAt: string;
  hostHandle: string;
  guestHandle: string | null;
  opponentId: string | null;
  target: number;
  hostProgress: number;
  guestProgress: number;
  iAmHost: boolean;
  note?: string;
};

export type DailySlot = {
  id: DailyKind;
  target: number;
  progress: number;
  done: boolean;
  port?: string;
};

export type SocialCounters = {
  helmClean: number;
  events: number;
  hhLoaded: number;
  lngStems: number;
  etsPaid: number;
  fleetOps: number;
  lngVoyages: number;
  profit: number;
  charterOps: number;
  oceanCalls: number;
  hubCalls: Record<string, number>;
};

export type DailyState = {
  date: string;
  slots: DailySlot[];
  claimed: boolean;
  rewardCash: number;
};

export type DailyHistory = {
  date: string;
  completed: number;
};

export type SocialBlob = {
  v: number;
  onboardingDone: boolean;
  selfId: string;
  selfHandle: string;
  friends: Friend[];
  challenges: Challenge[];
  daily: DailyState | null;
  history: DailyHistory[];
  counters: SocialCounters;
  counterDate: string;
};

export type SocialDelta = {
  ceu: number;
  voyages: number;
  onTime: number;
  cashUp: number;
  helmClean: number;
  events: number;
  hhLoaded: number;
  lngStems: number;
  etsPaid: number;
  fleetOps: number;
  lngVoyages: number;
  profit: number;
  charterOps: number;
  oceanCalls: number;
  hub: string | null;
  any: boolean;
};

export type HonourPlaque = Honour;
