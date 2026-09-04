import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { careerPoints, clampInt, cleanHandle, type CareerPayload } from "./score";

export type BoardRow = {
  rank: number;
  handle: string;
  points: number;
  netWorth: number;
  deliveredCeu: number;
  endKind: string;
  day: number;
  mine: boolean;
  runs?: number;
};

export type MyCareerRow = {
  id: number;
  handle: string;
  captain: string;
  points: number;
  netWorth: number;
  deliveredCeu: number;
  endKind: string;
  day: number;
  createdAt: string;
};

export type Scoring = "best" | "latest" | "sum";
export type LeagueMode = "solo" | "teams";
export type Metric = "points" | "ceu" | "green" | "wealth";
export type OfficialSlug = "week" | "month" | "alltime" | "grind" | "green";
export type LeagueKind = "user" | "official";

export type LeagueSummary = {
  id: number;
  name: string;
  code: string;
  owner: boolean;
  members: number;
  durationDays: number;
  scoring: Scoring;
  seasonNo: number;
  startsAt: string;
  endsAt: string | null;
  live: boolean;
  mode: LeagueMode;
  teamName: string | null;
  kind: LeagueKind;
  slug: OfficialSlug | null;
  metric: Metric;
  public: boolean;
};

export type OfficialCard = {
  slug: OfficialSlug;
  id: number;
  code: string;
  scoring: Scoring;
  metric: Metric;
  durationDays: number;
  startsAt: string;
  endsAt: string | null;
  live: boolean;
  members: number;
  joined: boolean;
  top: BoardRow[];
};

export type SeasonMeta = {
  seasonNo: number;
  scoring: Scoring;
  durationDays: number;
  startsAt: string;
  endsAt: string | null;
  live: boolean;
  champion: { handle: string; points: number } | null;
  owner: boolean;
  mode: LeagueMode;
};

export type PastSeason = {
  seasonNo: number;
  scoring: Scoring;
  champion: { handle: string; points: number } | null;
};

export type TeamRow = {
  rank: number;
  name: string;
  points: number;
  members: number;
  mine: boolean;
};

export type LeagueBoard = {
  rows: BoardRow[];
  teams: TeamRow[];
  meta: SeasonMeta;
  past: PastSeason[];
};

type BestRow = {
  user_id: string;
  handle: string;
  points: number;
  net_worth: number;
  delivered_ceu: number;
  end_kind: string;
  day: number;
  runs?: number;
};

const CODE_ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DURATIONS = [0, 7, 14, 30, 60, 90, 180];
const SCORINGS: Scoring[] = ["best", "latest", "sum"];
const MODES: LeagueMode[] = ["solo", "teams"];
const METRICS: Metric[] = ["points", "ceu", "green", "wealth"];
const SLUGS: OfficialSlug[] = ["week", "month", "alltime", "grind", "green"];
const EXTEND = [7, 14, 30];
const OFFICIAL_OWNER = "official";

type Cadence = "week" | "month" | "open";

const OFFICIAL: {
  slug: OfficialSlug;
  name: string;
  code: string;
  durationDays: number;
  scoring: Scoring;
  metric: Metric;
  cadence: Cadence;
}[] = [
  { slug: "week", name: "Weekly Sprint", code: "FXWEEK", durationDays: 7, scoring: "latest", metric: "points", cadence: "week" },
  { slug: "month", name: "Month of Line", code: "FXMONT", durationDays: 30, scoring: "best", metric: "points", cadence: "month" },
  { slug: "alltime", name: "All-Time Hall", code: "FXHALL", durationDays: 0, scoring: "best", metric: "points", cadence: "open" },
  { slug: "grind", name: "The Grind", code: "FXGRND", durationDays: 30, scoring: "sum", metric: "points", cadence: "month" },
  { slug: "green", name: "Green Line", code: "FXGREN", durationDays: 30, scoring: "best", metric: "green", cadence: "month" },
];

function makeCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPH[Math.floor(Math.random() * CODE_ALPH.length)]!;
  return s;
}

function parseDuration(n: unknown): number {
  if (n == null || n === "") return 60;
  const v = clampInt(Number(n), 0, 180);
  return DURATIONS.includes(v) ? v : 60;
}

function parseScoring(s: unknown): Scoring {
  return SCORINGS.includes(s as Scoring) ? (s as Scoring) : "best";
}

function parseMode(s: unknown): LeagueMode {
  return MODES.includes(s as LeagueMode) ? (s as LeagueMode) : "solo";
}

function parseMetric(s: unknown): Metric {
  return METRICS.includes(s as Metric) ? (s as Metric) : "points";
}

function parseSlug(s: unknown): OfficialSlug | null {
  return SLUGS.includes(s as OfficialSlug) ? (s as OfficialSlug) : null;
}

function parseKind(s: unknown): LeagueKind {
  return s === "official" ? "official" : "user";
}

function parseExtend(n: unknown): number {
  const v = clampInt(Number(n), 7, 30);
  return EXTEND.includes(v) ? v : 7;
}

function parseTeamName(s: unknown): string {
  return cleanHandle(String(s ?? "")).slice(0, 22);
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

function isoOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return iso(v);
}

function isLive(endsAt: string | null): boolean {
  if (!endsAt) return true;
  return new Date(endsAt).getTime() > Date.now();
}

function endsAtFrom(start: Date, days: number): Date | null {
  if (days <= 0) return null;
  return new Date(start.getTime() + days * 86_400_000);
}

function windowFor(cadence: Cadence, now = new Date()): { start: Date; end: Date | null } {
  if (cadence === "open") return { start: new Date("2020-01-01T00:00:00.000Z"), end: null };
  if (cadence === "month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(utc.getTime() - diff * 86_400_000);
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}

async function countUserLeagues(userId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from league_members m
    join leagues l on l.id = m.league_id
    where m.user_id = ${userId} and coalesce(l.kind, 'user') <> 'official'
  `;
  return Number(rows[0]?.n ?? 0);
}

async function ensureCaptain(userId: string, handle: string): Promise<string> {
  const sql = await getSql();
  const existing = await sql<{ handle: string }>`select handle from captains where user_id = ${userId} limit 1`;
  if (existing[0]) return existing[0].handle;
  const h = cleanHandle(handle);
  await sql`insert into captains (user_id, handle) values (${userId}, ${h}) on conflict (user_id) do nothing`;
  const again = await sql<{ handle: string }>`select handle from captains where user_id = ${userId} limit 1`;
  return again[0]?.handle ?? h;
}

function asBoard(rows: BestRow[], me: string): BoardRow[] {
  return rows.map((r, i) => ({
    rank: i + 1,
    handle: r.handle,
    points: Number(r.points),
    netWorth: Number(r.net_worth),
    deliveredCeu: Number(r.delivered_ceu),
    endKind: r.end_kind,
    day: Number(r.day),
    mine: r.user_id === me,
    runs: r.runs != null ? Number(r.runs) : undefined,
  }));
}

async function fetchGlobalBest(): Promise<BestRow[]> {
  const sql = await getSql();
  return sql<BestRow>`
    select x.user_id, c.handle, x.points, x.net_worth, x.delivered_ceu, x.end_kind, x.day
    from (
      select distinct on (user_id)
        user_id, points, net_worth, delivered_ceu, end_kind, day
      from careers
      order by user_id, points desc, created_at desc
    ) x
    join captains c on c.user_id = x.user_id
    order by x.points desc, x.delivered_ceu desc
    limit 50
  `;
}

export const listPublicBoard = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await fetchGlobalBest();
  return asBoard(rows, "");
});

export const listGlobalBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const rows = await fetchGlobalBest();
    return asBoard(rows, context.userId);
  });

export const listMyCareers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      captain: string;
      points: number;
      net_worth: number;
      delivered_ceu: number;
      end_kind: string;
      day: number;
      created_at: string;
    }>`
      select id, captain, points, net_worth, delivered_ceu, end_kind, day, created_at::text as created_at
      from careers
      where user_id = ${context.userId}
      order by created_at desc
      limit 30
    `;
    return rows.map(
      (r): MyCareerRow => ({
        id: Number(r.id),
        handle: r.captain,
        captain: r.captain,
        points: Number(r.points),
        netWorth: Number(r.net_worth),
        deliveredCeu: Number(r.delivered_ceu),
        endKind: r.end_kind,
        day: Number(r.day),
        createdAt: r.created_at,
      }),
    );
  });

export const submitCareer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: CareerPayload) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const captain = cleanHandle(data.captain);
    const endKind = ["wealth", "green", "broke", "retired"].includes(data.endKind) ? data.endKind : "retired";
    const netWorth = clampInt(data.netWorth, -5_000_000, 80_000_000);
    const deliveredCeu = clampInt(data.deliveredCeu, 0, 500_000);
    const reputation = clampInt(data.reputation, 0, 100);
    const co2t = clampInt(data.co2t, 0, 2_000_000);
    const fines = clampInt(data.fines, 0, 20_000_000);
    const cash = clampInt(data.cash, -5_000_000, 80_000_000);
    const day = clampInt(data.day, 0, 10_000);
    const voyages = clampInt(data.voyages, 0, 20_000);
    const fleetSize = clampInt(data.fleetSize, 0, 40);
    const points = careerPoints({ netWorth, deliveredCeu, reputation, co2t, fines });

    const dup = await sql<{ id: number }>`
      select id from careers
      where user_id = ${context.userId}
        and net_worth = ${netWorth}
        and delivered_ceu = ${deliveredCeu}
        and points = ${points}
        and created_at > now() - interval '3 minutes'
      limit 1
    `;
    if (dup[0]) return { ok: true as const, points, duplicate: true };

    const count = await sql<{ n: number }>`select count(*)::int as n from careers where user_id = ${context.userId}`;
    if ((count[0]?.n ?? 0) >= 40) {
      await sql`
        delete from careers
        where id = (
          select id from careers
          where user_id = ${context.userId}
          order by created_at asc
          limit 1
        )
      `;
    }

    await ensureCaptain(context.userId, captain);
    await sql`
      insert into careers (
        user_id, captain, end_kind, day, cash, net_worth, delivered_ceu,
        reputation, co2t, voyages, fines, fleet_size, points
      ) values (
        ${context.userId}, ${captain}, ${endKind}, ${day}, ${cash}, ${netWorth}, ${deliveredCeu},
        ${reputation}, ${co2t}, ${voyages}, ${fines}, ${fleetSize}, ${points}
      )
    `;
    return { ok: true as const, points, duplicate: false };
  });

export const listMyLeagues = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      name: string;
      code: string;
      owner_id: string;
      members: number;
      duration_days: number;
      scoring: string;
      season_no: number;
      season_starts_at: unknown;
      season_ends_at: unknown;
      mode: string;
      team_name: string | null;
      kind: string;
      slug: string | null;
      metric: string;
      public: boolean;
    }>`
      select
        l.id, l.name, l.code, l.owner_id, count(m.user_id)::int as members,
        l.duration_days, l.scoring, l.season_no,
        l.season_starts_at, l.season_ends_at,
        coalesce(l.mode, 'solo') as mode,
        t.name as team_name,
        coalesce(l.kind, 'user') as kind,
        l.slug,
        coalesce(l.metric, 'points') as metric,
        coalesce(l.public, false) as public
      from leagues l
      join league_members mine on mine.league_id = l.id and mine.user_id = ${context.userId}
      join league_members m on m.league_id = l.id
      left join league_teams t on t.id = mine.team_id
      group by l.id, l.name, l.code, l.owner_id, l.duration_days, l.scoring, l.season_no, l.season_starts_at, l.season_ends_at, l.mode, t.name, l.kind, l.slug, l.metric, l.public
      order by l.created_at desc
    `;
    return rows.map((r): LeagueSummary => {
      const startsAt = iso(r.season_starts_at) || new Date().toISOString();
      const endsAt = isoOrNull(r.season_ends_at);
      return {
        id: Number(r.id),
        name: r.name,
        code: r.code,
        owner: r.owner_id === context.userId,
        members: Number(r.members),
        durationDays: Number(r.duration_days ?? 60),
        scoring: parseScoring(r.scoring),
        seasonNo: Number(r.season_no ?? 1),
        startsAt,
        endsAt,
        live: isLive(endsAt),
        mode: parseMode(r.mode),
        teamName: r.team_name,
        kind: parseKind(r.kind),
        slug: parseSlug(r.slug),
        metric: parseMetric(r.metric),
        public: Boolean(r.public),
      };
    });
  });

async function ensureTeam(leagueId: number, name: string): Promise<number | null> {
  const trimmed = parseTeamName(name);
  if (trimmed.length < 2) return null;
  const sql = await getSql();
  const existing = await sql<{ id: number }>`
    select id from league_teams where league_id = ${leagueId} and name = ${trimmed} limit 1
  `;
  if (existing[0]) return Number(existing[0].id);
  const count = await sql<{ n: number }>`select count(*)::int as n from league_teams where league_id = ${leagueId}`;
  if ((count[0]?.n ?? 0) >= 8) throw new Error("LEAGUE_TEAM");
  const inserted = await sql<{ id: number }>`
    insert into league_teams (league_id, name) values (${leagueId}, ${trimmed})
    returning id
  `;
  return Number(inserted[0]!.id);
}

export const createLeague = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; durationDays?: number; scoring?: string; mode?: string; team?: string }) => ({
    name: cleanHandle(String(d?.name ?? "")),
    durationDays: parseDuration(d?.durationDays),
    scoring: parseScoring(d?.scoring),
    mode: parseMode(d?.mode),
    team: parseTeamName(d?.team),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await countUserLeagues(context.userId);
    if (owned >= 8) throw new Error("LEAGUE_MAX");
    await ensureCaptain(context.userId, "Captain");
    const start = new Date();
    const ends = endsAtFrom(start, data.durationDays);
    for (let i = 0; i < 8; i++) {
      const code = makeCode();
      try {
        const inserted = await sql<{ id: number }>`
          insert into leagues (name, code, owner_id, duration_days, scoring, season_no, season_starts_at, season_ends_at, mode)
          values (
            ${data.name}, ${code}, ${context.userId},
            ${data.durationDays}, ${data.scoring}, 1,
            ${start.toISOString()}, ${ends ? ends.toISOString() : null},
            ${data.mode}
          )
          returning id
        `;
        const id = Number(inserted[0]!.id);
        let teamId: number | null = null;
        if (data.mode === "teams") {
          teamId = await ensureTeam(id, data.team || data.name);
        }
        await sql`insert into league_members (league_id, user_id, team_id) values (${id}, ${context.userId}, ${teamId})`;
        return { id, name: data.name, code };
      } catch {
        /* unique code collision */
      }
    }
    throw new Error("LEAGUE_CREATE");
  });

export const joinLeague = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { code: string; team?: string }) => ({
    code: String(d?.code ?? "")
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 8),
    team: parseTeamName(d?.team),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.code.length < 4) throw new Error("LEAGUE_BAD_CODE");
    const league = await sql<{ id: number; name: string; mode: string; kind: string }>`
      select id, name, coalesce(mode, 'solo') as mode, coalesce(kind, 'user') as kind from leagues where code = ${data.code} limit 1
    `;
    if (!league[0]) throw new Error("LEAGUE_NOT_FOUND");
    const id = Number(league[0].id);
    const official = parseKind(league[0].kind) === "official";
    if (!official && (await countUserLeagues(context.userId)) >= 8) throw new Error("LEAGUE_MAX_JOIN");
    if (!official) {
      const size = await sql<{ n: number }>`select count(*)::int as n from league_members where league_id = ${id}`;
      if ((size[0]?.n ?? 0) >= 24) throw new Error("LEAGUE_FULL");
    }
    let teamId: number | null = null;
    if (parseMode(league[0].mode) === "teams") {
      const handle = await ensureCaptain(context.userId, "Captain");
      teamId = await ensureTeam(id, data.team || `Team ${handle}`);
    }
    await sql`
      insert into league_members (league_id, user_id, team_id)
      values (${id}, ${context.userId}, ${teamId})
      on conflict (league_id, user_id) do update set team_id = coalesce(excluded.team_id, league_members.team_id)
    `;
    await ensureCaptain(context.userId, "Captain");
    return { id, name: league[0].name, code: data.code };
  });

export const leaveLeague = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => ({ id: clampInt(Number(d?.id), 1, 2_000_000_000) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await sql<{ owner_id: string; kind: string }>`
      select owner_id, coalesce(kind, 'user') as kind from leagues where id = ${data.id} limit 1
    `;
    if (!row[0]) return { ok: true };
    await sql`delete from league_members where league_id = ${data.id} and user_id = ${context.userId}`;
    if (parseKind(row[0].kind) === "official") return { ok: true };
    if (row[0].owner_id === context.userId) {
      const next = await sql<{ user_id: string }>`
        select user_id from league_members where league_id = ${data.id} order by joined_at asc limit 1
      `;
      if (next[0]) await sql`update leagues set owner_id = ${next[0].user_id} where id = ${data.id}`;
      else await sql`delete from leagues where id = ${data.id}`;
    }
    return { ok: true };
  });

type LeagueRow = {
  owner_id: string;
  duration_days: number;
  scoring: string;
  season_no: number;
  season_starts_at: unknown;
  season_ends_at: unknown;
  mode: string;
  kind: string;
  slug: string | null;
  metric: string;
  public: boolean;
};

async function loadLeague(id: number) {
  const sql = await getSql();
  const row = await sql<LeagueRow>`
    select owner_id, duration_days, scoring, season_no, season_starts_at, season_ends_at,
           coalesce(mode, 'solo') as mode, coalesce(kind, 'user') as kind, slug,
           coalesce(metric, 'points') as metric, coalesce(public, false) as public
    from leagues where id = ${id} limit 1
  `;
  return row[0] ?? null;
}

async function seasonRows(
  leagueId: number,
  scoring: Scoring,
  metric: Metric,
  startsAt: string,
  endsAt: string | null,
): Promise<BestRow[]> {
  const sql = await getSql();
  const endBound = endsAt ?? "9999-12-31T23:59:59.000Z";
  if (scoring === "sum") {
    return sql<BestRow>`
      select
        m.user_id,
        coalesce(c.handle, 'Captain') as handle,
        coalesce(x.points, 0) as points,
        coalesce(x.net_worth, 0) as net_worth,
        coalesce(x.delivered_ceu, 0) as delivered_ceu,
        coalesce(x.end_kind, '') as end_kind,
        coalesce(x.day, 0) as day,
        coalesce(x.runs, 0) as runs
      from league_members m
      left join captains c on c.user_id = m.user_id
      left join (
        select
          car.user_id,
          sum(
            case
              when ${metric} = 'ceu' then car.delivered_ceu
              when ${metric} = 'wealth' then car.net_worth
              when ${metric} = 'green' then greatest(0, (car.reputation * 200) - car.co2t)
              else car.points
            end
          )::int as points,
          max(car.net_worth)::int as net_worth,
          sum(car.delivered_ceu)::int as delivered_ceu,
          (array_agg(car.end_kind order by car.points desc))[1] as end_kind,
          max(car.day)::int as day,
          count(*)::int as runs
        from careers car
        join league_members lm on lm.user_id = car.user_id and lm.league_id = ${leagueId}
        where car.created_at >= ${startsAt}::timestamptz
          and car.created_at < ${endBound}::timestamptz
        group by car.user_id
      ) x on x.user_id = m.user_id
      where m.league_id = ${leagueId}
      order by coalesce(x.points, 0) desc, coalesce(x.delivered_ceu, 0) desc
      limit 50
    `;
  }
  if (scoring === "latest") {
    return sql<BestRow>`
    select
      m.user_id,
      coalesce(c.handle, 'Captain') as handle,
      coalesce(x.points, 0) as points,
      coalesce(x.net_worth, 0) as net_worth,
      coalesce(x.delivered_ceu, 0) as delivered_ceu,
      coalesce(x.end_kind, '') as end_kind,
      coalesce(x.day, 0) as day,
      1 as runs
    from league_members m
    left join captains c on c.user_id = m.user_id
    left join (
      select distinct on (car.user_id)
        car.user_id,
        case
          when ${metric} = 'ceu' then car.delivered_ceu
          when ${metric} = 'wealth' then car.net_worth
          when ${metric} = 'green' then greatest(0, (car.reputation * 200) - car.co2t)
          else car.points
        end as points,
        car.net_worth, car.delivered_ceu, car.end_kind, car.day
      from careers car
      join league_members lm on lm.user_id = car.user_id and lm.league_id = ${leagueId}
      where car.created_at >= ${startsAt}::timestamptz
        and car.created_at < ${endBound}::timestamptz
      order by car.user_id, car.created_at desc
    ) x on x.user_id = m.user_id
    where m.league_id = ${leagueId}
    order by coalesce(x.points, 0) desc, coalesce(x.delivered_ceu, 0) desc
    limit 50
  `;
  }
  return sql<BestRow>`
    select
      m.user_id,
      coalesce(c.handle, 'Captain') as handle,
      coalesce(x.points, 0) as points,
      coalesce(x.net_worth, 0) as net_worth,
      coalesce(x.delivered_ceu, 0) as delivered_ceu,
      coalesce(x.end_kind, '') as end_kind,
      coalesce(x.day, 0) as day,
      1 as runs
    from league_members m
    left join captains c on c.user_id = m.user_id
    left join (
      select distinct on (car.user_id)
        car.user_id,
        case
          when ${metric} = 'ceu' then car.delivered_ceu
          when ${metric} = 'wealth' then car.net_worth
          when ${metric} = 'green' then greatest(0, (car.reputation * 200) - car.co2t)
          else car.points
        end as points,
        car.net_worth, car.delivered_ceu, car.end_kind, car.day
      from careers car
      join league_members lm on lm.user_id = car.user_id and lm.league_id = ${leagueId}
      where car.created_at >= ${startsAt}::timestamptz
        and car.created_at < ${endBound}::timestamptz
      order by car.user_id,
        case
          when ${metric} = 'ceu' then car.delivered_ceu
          when ${metric} = 'wealth' then car.net_worth
          when ${metric} = 'green' then greatest(0, (car.reputation * 200) - car.co2t)
          else car.points
        end desc,
        car.created_at desc
    ) x on x.user_id = m.user_id
    where m.league_id = ${leagueId}
    order by coalesce(x.points, 0) desc, coalesce(x.delivered_ceu, 0) desc
    limit 50
  `;
}

function metaFrom(row: LeagueRow, owner: boolean, champion: { handle: string; points: number } | null): SeasonMeta {
  const startsAt = iso(row.season_starts_at) || new Date().toISOString();
  const endsAt = isoOrNull(row.season_ends_at);
  return {
    seasonNo: Number(row.season_no ?? 1),
    scoring: parseScoring(row.scoring),
    durationDays: Number(row.duration_days ?? 60),
    startsAt,
    endsAt,
    live: isLive(endsAt),
    champion,
    owner,
    mode: parseMode(row.mode),
  };
}

export const listLeagueBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => ({ id: clampInt(Number(d?.id), 1, 2_000_000_000) }))
  .handler(async ({ context, data }): Promise<LeagueBoard> => {
    const sql = await getSql();
    const league = await loadLeague(data.id);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    const isPublic = Boolean(league.public) || parseKind(league.kind) === "official";
    const member = await sql<{ user_id: string }>`
      select user_id from league_members
      where league_id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    if (!member[0] && !isPublic) throw new Error("LEAGUE_NOT_MEMBER");
    const scoring = parseScoring(league.scoring);
    const metric = parseMetric(league.metric);
    const startsAt = iso(league.season_starts_at) || new Date(0).toISOString();
    const endsAt = isoOrNull(league.season_ends_at);
    const rows = await seasonRows(data.id, scoring, metric, startsAt, endsAt);
    const board = asBoard(rows, context.userId);
    const top = board.find((r) => r.points > 0) ?? null;
    const pastRows = await sql<{
      season_no: number;
      scoring: string;
      champion_handle: string | null;
      champion_points: number | null;
    }>`
      select season_no, scoring, champion_handle, champion_points
      from league_seasons
      where league_id = ${data.id}
      order by season_no desc
      limit 8
    `;
    const mode = parseMode(league.mode);
    let teams: TeamRow[] = [];
    if (mode === "teams") {
      const members = await sql<{ user_id: string; team_id: number | null; team_name: string | null }>`
        select m.user_id, m.team_id, t.name as team_name
        from league_members m
        left join league_teams t on t.id = m.team_id
        where m.league_id = ${data.id}
      `;
      const byTeam = new Map<string, { name: string; points: number; members: number; mine: boolean }>();
      const ptsByUser = new Map(rows.map((r) => [r.user_id, Number(r.points)]));
      for (const m of members) {
        const key = m.team_name ?? "";
        const name = key || "Unaffiliated";
        const cur = byTeam.get(name) ?? { name, points: 0, members: 0, mine: false };
        cur.points += ptsByUser.get(m.user_id) ?? 0;
        cur.members += 1;
        if (m.user_id === context.userId) cur.mine = true;
        byTeam.set(name, cur);
      }
      teams = [...byTeam.values()]
        .sort((a, b) => b.points - a.points)
        .map((t, i) => ({ rank: i + 1, name: t.name, points: t.points, members: t.members, mine: t.mine }));
    }
    return {
      rows: board,
      teams,
      meta: metaFrom(
        league,
        league.owner_id === context.userId && parseKind(league.kind) !== "official",
        top ? { handle: top.handle, points: top.points } : null,
      ),
      past: pastRows.map((r) => ({
        seasonNo: Number(r.season_no),
        scoring: parseScoring(r.scoring),
        champion:
          r.champion_handle && Number(r.champion_points) > 0
            ? { handle: r.champion_handle, points: Number(r.champion_points) }
            : null,
      })),
    };
  });

export const updateLeagueSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; durationDays?: number; scoring?: string }) => ({
    id: clampInt(Number(d?.id), 1, 2_000_000_000),
    durationDays: parseDuration(d?.durationDays),
    scoring: parseScoring(d?.scoring),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const league = await loadLeague(data.id);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (parseKind(league.kind) === "official") throw new Error("LEAGUE_NOT_OWNER");
    if (league.owner_id !== context.userId) throw new Error("LEAGUE_NOT_OWNER");
    const start = new Date(iso(league.season_starts_at) || Date.now());
    const ends = endsAtFrom(start, data.durationDays);
    await sql`
      update leagues
      set duration_days = ${data.durationDays},
          scoring = ${data.scoring},
          season_ends_at = ${ends ? ends.toISOString() : null}
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

export const endSeason = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => ({ id: clampInt(Number(d?.id), 1, 2_000_000_000) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const league = await loadLeague(data.id);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (parseKind(league.kind) === "official") throw new Error("LEAGUE_NOT_OWNER");
    if (league.owner_id !== context.userId) throw new Error("LEAGUE_NOT_OWNER");
    await sql`update leagues set season_ends_at = ${new Date().toISOString()} where id = ${data.id}`;
    return { ok: true as const };
  });

export const continueSeason = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => ({ id: clampInt(Number(d?.id), 1, 2_000_000_000) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const league = await loadLeague(data.id);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (parseKind(league.kind) === "official") throw new Error("LEAGUE_NOT_OWNER");
    if (league.owner_id !== context.userId) throw new Error("LEAGUE_NOT_OWNER");
    const scoring = parseScoring(league.scoring);
    const metric = parseMetric(league.metric);
    const startsAt = iso(league.season_starts_at) || new Date(0).toISOString();
    const endsAt = isoOrNull(league.season_ends_at);
    const rows = await seasonRows(data.id, scoring, metric, startsAt, endsAt);
    const top = rows.find((r) => Number(r.points) > 0) ?? null;
    const seasonNo = Number(league.season_no ?? 1);
    try {
      await sql`
        insert into league_seasons (
          league_id, season_no, starts_at, ends_at, scoring, duration_days, champion_handle, champion_points
        ) values (
          ${data.id}, ${seasonNo}, ${startsAt}, ${endsAt ?? new Date().toISOString()},
          ${scoring}, ${Number(league.duration_days ?? 60)},
          ${top?.handle ?? null}, ${top ? Number(top.points) : null}
        )
        on conflict (league_id, season_no) do nothing
      `;
    } catch {
      throw new Error("LEAGUE_SEASON");
    }
    const start = new Date();
    const duration = Number(league.duration_days ?? 60);
    const ends = endsAtFrom(start, duration);
    await sql`
      update leagues
      set season_no = ${seasonNo + 1},
          season_starts_at = ${start.toISOString()},
          season_ends_at = ${ends ? ends.toISOString() : null}
      where id = ${data.id}
    `;
    return { ok: true as const, seasonNo: seasonNo + 1 };
  });

export const extendSeason = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; extraDays?: number }) => ({
    id: clampInt(Number(d?.id), 1, 2_000_000_000),
    extraDays: parseExtend(d?.extraDays),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const league = await loadLeague(data.id);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (parseKind(league.kind) === "official") throw new Error("LEAGUE_NOT_OWNER");
    if (league.owner_id !== context.userId) throw new Error("LEAGUE_NOT_OWNER");
    const current = isoOrNull(league.season_ends_at);
    const base = current && isLive(current) ? new Date(current) : new Date();
    const next = new Date(base.getTime() + data.extraDays * 86_400_000);
    const duration = Number(league.duration_days ?? 60) + data.extraDays;
    await sql`
      update leagues
      set season_ends_at = ${next.toISOString()},
          duration_days = ${duration}
      where id = ${data.id}
    `;
    return { ok: true as const, endsAt: next.toISOString() };
  });

export const setMemberTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; team?: string }) => ({
    id: clampInt(Number(d?.id), 1, 2_000_000_000),
    team: parseTeamName(d?.team),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const member = await sql<{ user_id: string }>`
      select user_id from league_members
      where league_id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    if (!member[0]) throw new Error("LEAGUE_NOT_MEMBER");
    const league = await loadLeague(data.id);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (parseMode(league.mode) !== "teams") throw new Error("LEAGUE_TEAM");
    const teamId = await ensureTeam(data.id, data.team);
    if (teamId == null) throw new Error("LEAGUE_TEAM");
    await sql`
      update league_members set team_id = ${teamId}
      where league_id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

async function ensureOfficial(): Promise<void> {
  const sql = await getSql();
  await sql.query(`alter table leagues add column if not exists kind text not null default 'user'`);
  await sql.query(`alter table leagues add column if not exists slug text`);
  await sql.query(`alter table leagues add column if not exists metric text not null default 'points'`);
  await sql.query(`alter table leagues add column if not exists public boolean not null default false`);
  await sql.query(`create unique index if not exists leagues_slug_uidx on leagues (slug)`);
  for (const o of OFFICIAL) {
    const existing = await sql<{
      id: number;
      season_starts_at: unknown;
      season_ends_at: unknown;
      season_no: number;
      scoring: string;
      metric: string;
    }>`
      select id, season_starts_at, season_ends_at, season_no, scoring, coalesce(metric, 'points') as metric
      from leagues where slug = ${o.slug} limit 1
    `;
    const { start, end } = windowFor(o.cadence);
    if (!existing[0]) {
      try {
        await sql`
          insert into leagues (
            name, code, owner_id, duration_days, scoring, season_no,
            season_starts_at, season_ends_at, mode, kind, slug, metric, public
          ) values (
            ${o.name}, ${o.code}, ${OFFICIAL_OWNER}, ${o.durationDays}, ${o.scoring}, 1,
            ${start.toISOString()}, ${end ? end.toISOString() : null},
            ${"solo"}, ${"official"}, ${o.slug}, ${o.metric}, ${true}
          )
        `;
      } catch {
        /* unique race on slug/code */
      }
      continue;
    }
    if (o.cadence === "open") continue;
    const storedStart = iso(existing[0].season_starts_at);
    const sameWindow = storedStart.slice(0, 10) === start.toISOString().slice(0, 10);
    if (sameWindow && isLive(isoOrNull(existing[0].season_ends_at))) continue;
    const id = Number(existing[0].id);
    const seasonNo = Number(existing[0].season_no ?? 1);
    const scoring = parseScoring(existing[0].scoring);
    const metric = parseMetric(existing[0].metric);
    const oldStart = storedStart || new Date(0).toISOString();
    const oldEnd = isoOrNull(existing[0].season_ends_at) ?? new Date().toISOString();
    const rows = await seasonRows(id, scoring, metric, oldStart, oldEnd);
    const top = rows.find((r) => Number(r.points) > 0) ?? null;
    try {
      await sql`
        insert into league_seasons (
          league_id, season_no, starts_at, ends_at, scoring, duration_days, champion_handle, champion_points
        ) values (
          ${id}, ${seasonNo}, ${oldStart}, ${oldEnd},
          ${scoring}, ${o.durationDays},
          ${top?.handle ?? null}, ${top ? Number(top.points) : null}
        )
        on conflict (league_id, season_no) do nothing
      `;
    } catch {
      /* ignore archive races */
    }
    await sql`
      update leagues
      set season_no = ${seasonNo + 1},
          season_starts_at = ${start.toISOString()},
          season_ends_at = ${end ? end.toISOString() : null},
          duration_days = ${o.durationDays},
          scoring = ${o.scoring},
          metric = ${o.metric},
          public = true,
          kind = 'official'
      where id = ${id}
    `;
  }
}

async function loadOfficial(me: string): Promise<OfficialCard[]> {
  await ensureOfficial();
  const sql = await getSql();
  const cards: OfficialCard[] = [];
  for (const o of OFFICIAL) {
    const row = await sql<{
      id: number;
      code: string;
      scoring: string;
      metric: string;
      duration_days: number;
      season_starts_at: unknown;
      season_ends_at: unknown;
      members: number;
    }>`
      select l.id, l.code, l.scoring, coalesce(l.metric, 'points') as metric, l.duration_days,
             l.season_starts_at, l.season_ends_at,
             (select count(*)::int from league_members m where m.league_id = l.id) as members
      from leagues l where l.slug = ${o.slug} limit 1
    `;
    if (!row[0]) continue;
    const id = Number(row[0].id);
    const scoring = parseScoring(row[0].scoring);
    const metric = parseMetric(row[0].metric);
    const startsAt = iso(row[0].season_starts_at) || new Date(0).toISOString();
    const endsAt = isoOrNull(row[0].season_ends_at);
    const rows = await seasonRows(id, scoring, metric, startsAt, endsAt);
    let joined = false;
    if (me) {
      const mem = await sql<{ n: number }>`
        select count(*)::int as n from league_members where league_id = ${id} and user_id = ${me}
      `;
      joined = Number(mem[0]?.n ?? 0) > 0;
    }
    cards.push({
      slug: o.slug,
      id,
      code: row[0].code,
      scoring,
      metric,
      durationDays: Number(row[0].duration_days ?? o.durationDays),
      startsAt,
      endsAt,
      live: isLive(endsAt),
      members: Number(row[0].members ?? 0),
      joined,
      top: asBoard(rows, me).slice(0, 8),
    });
  }
  return cards;
}

export const listOfficialPublic = createServerFn({ method: "GET" }).handler(async () => {
  return loadOfficial("");
});

export const listOfficial = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return loadOfficial(context.userId);
  });

export const joinOfficial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { slug: string }) => {
    const slug = parseSlug(d?.slug);
    if (!slug) throw new Error("LEAGUE_NOT_FOUND");
    return { slug };
  })
  .handler(async ({ context, data }) => {
    await ensureOfficial();
    const sql = await getSql();
    const league = await sql<{ id: number; name: string; code: string }>`
      select id, name, code from leagues where slug = ${data.slug} and kind = 'official' limit 1
    `;
    if (!league[0]) throw new Error("LEAGUE_NOT_FOUND");
    const id = Number(league[0].id);
    await ensureCaptain(context.userId, "Captain");
    await sql`
      insert into league_members (league_id, user_id, team_id)
      values (${id}, ${context.userId}, ${null})
      on conflict (league_id, user_id) do nothing
    `;
    return { id, name: league[0].name, code: league[0].code, slug: data.slug };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(() => ({}))
  .handler(async ({ context }) => {
    const sql = await getSql();
    const uid = context.userId;
    const owned = await sql<{ id: number }>`select id from leagues where owner_id = ${uid}`;
    for (const lg of owned) {
      await sql`delete from league_members where league_id = ${lg.id} and user_id = ${uid}`;
      const next = await sql<{ user_id: string }>`
        select user_id from league_members where league_id = ${lg.id} order by joined_at asc limit 1
      `;
      if (next[0]) await sql`update leagues set owner_id = ${next[0].user_id} where id = ${lg.id}`;
      else await sql`delete from leagues where id = ${lg.id}`;
    }
    await sql`delete from league_members where user_id = ${uid}`;
    await sql`delete from careers where user_id = ${uid}`;
    await sql`delete from captains where user_id = ${uid}`;
    const ident = await sql<{ email: string }>`select email from "user" where id = ${uid} limit 1`;
    if (ident[0]?.email) {
      await sql`delete from "verification" where identifier = ${ident[0].email}`;
    }
    await sql`delete from "session" where "userId" = ${uid}`;
    await sql`delete from "account" where "userId" = ${uid}`;
    await sql`delete from "user" where id = ${uid}`;
    return { ok: true as const };
  });
