alter table clubs add column if not exists telegram text;
alter table clubs add column if not exists x_handle text;
alter table clubs add column if not exists discord text;
alter table clubs add column if not exists telegram_chat text;

create table if not exists news_sent (
  ticker text not null,
  news_id text not null,
  primary key (ticker, news_id)
);
