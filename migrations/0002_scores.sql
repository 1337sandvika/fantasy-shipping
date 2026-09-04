-- Career scores, personal history, and invite-code leagues.

create table if not exists captains (
  user_id    text primary key,
  handle     text not null,
  created_at timestamptz not null default now()
);

create table if not exists careers (
  id             serial primary key,
  user_id        text not null,
  captain        text not null,
  end_kind       text not null,
  day            integer not null,
  cash           integer not null,
  net_worth      integer not null,
  delivered_ceu  integer not null,
  reputation     integer not null,
  co2t           integer not null,
  voyages        integer not null,
  fines          integer not null default 0,
  fleet_size     integer not null default 0,
  points         integer not null,
  created_at     timestamptz not null default now()
);

create index if not exists careers_user_id_idx on careers (user_id);
create index if not exists careers_points_idx on careers (points desc);

create table if not exists leagues (
  id         serial primary key,
  name       text not null,
  code       text not null unique,
  owner_id   text not null,
  created_at timestamptz not null default now()
);

create index if not exists leagues_owner_idx on leagues (owner_id);

create table if not exists league_members (
  league_id  integer not null references leagues(id) on delete cascade,
  user_id    text not null,
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_members_user_idx on league_members (user_id);
