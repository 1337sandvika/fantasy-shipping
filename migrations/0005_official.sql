-- House tournaments: weekly / monthly / all-time / grind / green line.
-- Owned by the sentinel 'official' (no user row). Public boards, auto-rolled windows.

alter table leagues add column if not exists kind text not null default 'user';
alter table leagues add column if not exists slug text;
alter table leagues add column if not exists metric text not null default 'points';
alter table leagues add column if not exists public boolean not null default false;

create unique index if not exists leagues_slug_uidx on leagues (slug);
create index if not exists careers_created_idx on careers (created_at);

insert into leagues (
  name, code, owner_id, duration_days, scoring, season_no,
  season_starts_at, season_ends_at, mode, kind, slug, metric, public
)
select
  'Weekly Sprint', 'FXWEEK', 'official', 7, 'latest', 1,
  now(), now() + interval '7 days', 'solo', 'official', 'week', 'points', true
where not exists (select 1 from leagues where slug = 'week');

insert into leagues (
  name, code, owner_id, duration_days, scoring, season_no,
  season_starts_at, season_ends_at, mode, kind, slug, metric, public
)
select
  'Month of Line', 'FXMONT', 'official', 30, 'best', 1,
  date_trunc('month', now()), date_trunc('month', now()) + interval '1 month',
  'solo', 'official', 'month', 'points', true
where not exists (select 1 from leagues where slug = 'month');

insert into leagues (
  name, code, owner_id, duration_days, scoring, season_no,
  season_starts_at, season_ends_at, mode, kind, slug, metric, public
)
select
  'All-Time Hall', 'FXHALL', 'official', 0, 'best', 1,
  timestamptz '2020-01-01 00:00:00+00', null,
  'solo', 'official', 'alltime', 'points', true
where not exists (select 1 from leagues where slug = 'alltime');

insert into leagues (
  name, code, owner_id, duration_days, scoring, season_no,
  season_starts_at, season_ends_at, mode, kind, slug, metric, public
)
select
  'The Grind', 'FXGRND', 'official', 30, 'sum', 1,
  date_trunc('month', now()), date_trunc('month', now()) + interval '1 month',
  'solo', 'official', 'grind', 'points', true
where not exists (select 1 from leagues where slug = 'grind');

insert into leagues (
  name, code, owner_id, duration_days, scoring, season_no,
  season_starts_at, season_ends_at, mode, kind, slug, metric, public
)
select
  'Green Line', 'FXGREN', 'official', 30, 'best', 1,
  date_trunc('month', now()), date_trunc('month', now()) + interval '1 month',
  'solo', 'official', 'green', 'green', true
where not exists (select 1 from leagues where slug = 'green');
