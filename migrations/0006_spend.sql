alter table proposals add column if not exists recipient text;
alter table proposals add column if not exists amount integer;
alter table proposals add column if not exists chain_id integer;
alter table proposals add column if not exists executed boolean not null default false;
