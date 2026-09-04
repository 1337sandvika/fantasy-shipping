export type CareerPayload = {
  captain: string;
  endKind: string;
  day: number;
  cash: number;
  netWorth: number;
  deliveredCeu: number;
  reputation: number;
  co2t: number;
  voyages: number;
  fines: number;
  fleetSize: number;
};

export function careerPoints(s: {
  netWorth: number;
  deliveredCeu: number;
  reputation: number;
  co2t: number;
  fines: number;
}): number {
  return Math.max(
    0,
    Math.round(s.netWorth + s.deliveredCeu * 40 + s.reputation * 8000 - s.co2t * 12 - s.fines * 0.4),
  );
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function cleanHandle(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim().slice(0, 28);
  return s.length >= 2 ? s : "Line";
}

export function netWorth(cash: number, fleetValue: number): number {
  return cash + fleetValue;
}
