import { cleanHandle } from "../score";
import { emptySnapshot } from "./profile";
import type { Challenge, ChallengeKind, Friend, LineSnapshot } from "./types";

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeId(prefix: string, n = 6): string {
  let s = prefix;
  for (let i = 0; i < n; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]!;
  return s;
}

function checksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 3)) % 34;
  return ALPH[h]!;
}

const KINDS: ChallengeKind[] = ["ceu", "voyage", "profit", "ontime", "helm", "event", "green"];

export const CHALLENGE_DEFAULTS: Record<ChallengeKind, number> = {
  ceu: 1200,
  voyage: 3,
  profit: 180_000,
  ontime: 3,
  helm: 2,
  event: 2,
  green: 2,
};

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unb64url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

type InvitePayload = {
  v: 1;
  id: string;
  k: ChallengeKind;
  t: number;
  h: string;
  exp: string;
  snap?: Pick<LineSnapshot, "level" | "points" | "deliveredCeu" | "honours">;
};

export function encodeInvite(ch: Challenge, snap?: LineSnapshot): string {
  const body: InvitePayload = {
    v: 1,
    id: ch.id,
    k: ch.kind,
    t: ch.target,
    h: ch.hostHandle,
    exp: ch.expiresAt,
    snap: snap
      ? { level: snap.level, points: snap.points, deliveredCeu: snap.deliveredCeu, honours: snap.honours }
      : undefined,
  };
  const raw = b64url(JSON.stringify(body));
  return `FXC1.${raw}.${checksum(raw)}`;
}

export function decodeInvite(code: string): { challenge: Challenge; friend: Friend } | null {
  const bits = code.trim().replace(/\s+/g, "").split(".");
  if (bits.length < 3) return null;
  const [head, raw, sum] = bits;
  if (head !== "FXC1" && head !== "fxc1") return null;
  if (!raw || checksum(raw) !== sum) return null;
  try {
    const body = JSON.parse(unb64url(raw)) as InvitePayload;
    if (body.v !== 1 || !KINDS.includes(body.k) || !body.id || !body.h) return null;
    const handle = cleanHandle(body.h);
    const challenge: Challenge = {
      id: String(body.id).slice(0, 12),
      code: `FXC1.${raw}.${sum}`,
      kind: body.k,
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: body.exp || new Date(Date.now() + 7 * 86_400_000).toISOString(),
      hostHandle: handle,
      guestHandle: null,
      opponentId: null,
      target: Math.max(1, Math.round(Number(body.t) || CHALLENGE_DEFAULTS[body.k])),
      hostProgress: 0,
      guestProgress: 0,
      iAmHost: false,
    };
    const friend: Friend = {
      id: `code-${challenge.id}`,
      handle,
      source: "code",
      snapshot: {
        ...emptySnapshot(handle),
        level: body.snap?.level ?? 1,
        points: body.snap?.points ?? 0,
        deliveredCeu: body.snap?.deliveredCeu ?? 0,
        honours: body.snap?.honours ?? [],
      },
    };
    return { challenge, friend };
  } catch {
    return null;
  }
}

type ResultPayload = { v: 1; id: string; p: number; h: string };

export function encodeResult(ch: Challenge, handle: string): string {
  const mine = ch.iAmHost ? ch.hostProgress : ch.guestProgress;
  const body: ResultPayload = { v: 1, id: ch.id, p: Math.round(mine), h: cleanHandle(handle) };
  const raw = b64url(JSON.stringify(body));
  return `FXR1.${raw}.${checksum(raw)}`;
}

export function decodeResult(code: string): { id: string; progress: number; handle: string } | null {
  const bits = code.trim().replace(/\s+/g, "").split(".");
  if (bits.length < 3) return null;
  const [head, raw, sum] = bits;
  if (head !== "FXR1" && head !== "fxr1") return null;
  if (!raw || checksum(raw) !== sum) return null;
  try {
    const body = JSON.parse(unb64url(raw)) as ResultPayload;
    if (body.v !== 1 || !body.id) return null;
    return { id: String(body.id), progress: Math.max(0, Math.round(Number(body.p) || 0)), handle: cleanHandle(body.h) };
  } catch {
    return null;
  }
}
