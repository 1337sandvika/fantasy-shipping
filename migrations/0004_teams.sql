-- Team tournaments inside a league, plus a 7-day sprint duration (handled in app).

alter table leagues add column if not exists mode text not null default 'solo';

create table if not exists league_teams (
  id         serial primary key,
  league_id  integer not null references leagues(id) on delete cascade,
  name       text not null,
  unique (league_id, name)
);

create index if not exists league_teams_league_idx on league_teams (league_id);

alter table league_members add column if not exists team_id integer references league_teams(id) on delete set null;
