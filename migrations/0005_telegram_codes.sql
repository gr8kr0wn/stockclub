create table if not exists telegram_codes (
  code text primary key,
  ticker text not null,
  founder text not null,
  telegram_user text,
  expires_at timestamptz not null,
  used_at timestamptz
);
