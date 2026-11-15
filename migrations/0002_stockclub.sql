create table if not exists clubs (
  ticker text primary key,
  name text not null,
  description text not null,
  rules text not null,
  membership text not null,
  founder text not null,
  cover text not null,
  members_split integer not null,
  ops_split integer not null,
  founder_split integer not null,
  created_at timestamptz not null default now()
);

create table if not exists members (
  ticker text not null references clubs (ticker),
  address text not null,
  minted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (ticker, address)
);

create table if not exists contributions (
  id text primary key,
  ticker text not null references clubs (ticker),
  address text not null,
  amount integer not null,
  tx_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists proposals (
  id text primary key,
  ticker text not null references clubs (ticker),
  author text not null,
  title text not null,
  body text not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  proposal_id text not null references proposals (id),
  address text not null,
  choice text not null,
  created_at timestamptz not null default now(),
  primary key (proposal_id, address)
);

create table if not exists challenges (
  id text primary key,
  ticker text not null references clubs (ticker),
  author text not null,
  title text not null,
  detail text not null,
  reward text not null,
  created_at timestamptz not null default now()
);

create table if not exists entries (
  challenge_id text not null references challenges (id),
  address text not null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, address)
);

create table if not exists posts (
  id text primary key,
  ticker text not null references clubs (ticker),
  author text not null,
  kind text not null,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists cheers (
  ticker text not null references clubs (ticker),
  address text not null,
  created_at timestamptz not null default now(),
  primary key (ticker, address)
);

create table if not exists wallet_nonces (
  address text primary key,
  nonce text not null,
  expires_at timestamptz not null
);

create table if not exists wallet_sessions (
  token text primary key,
  address text not null,
  expires_at timestamptz not null
);

create table if not exists chain_config (
  id integer primary key,
  registry text,
  deployer text
);

insert into chain_config (id, registry, deployer)
values (1, null, null)
on conflict (id) do nothing;
