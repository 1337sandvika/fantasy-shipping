-- Timed seasons on friend leagues: duration, scoring rule, continue into the next window.

alter table leagues add column if not exists duration_days integer not null default 60;
alter table leagues add column if not exists scoring text not null default 'best';
alter table leagues add column if not exists season_no integer not null default 1;
alter table leagues add column if not exists season_starts_at timestamptz;
alter table leagues add column if not exists season_ends_at timestamptz;

update leagues
set
  season_starts_at = coalesce(season_starts_at, created_at),
  season_ends_at = coalesce(season_ends_at, created_at + interval '60 days')
where season_starts_at is null;

create table if not exists league_seasons (
  id               serial primary key,
  league_id        integer not null references leagues(id) on delete cascade,
  season_no        integer not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  scoring          text not null,
  duration_days    integer not null,
  champion_handle  text,
  champion_points  integer,
  unique (league_id, season_no)
);

create index if not exists league_seasons_league_idx on league_seasons (league_id);
