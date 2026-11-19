alter table clubs add column if not exists news_minutes integer default 5;
alter table clubs add column if not exists news_kind text default 'all';
alter table clubs add column if not exists last_price numeric;
alter table clubs add column if not exists last_sent_at timestamptz;
