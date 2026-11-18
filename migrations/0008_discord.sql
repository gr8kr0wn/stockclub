alter table clubs add column if not exists discord_channel text;

create table if not exists discord_codes (
  code text primary key,
  ticker text not null,
  founder text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
