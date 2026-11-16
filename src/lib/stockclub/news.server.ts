import { getSql } from "@/lib/db";

export type StockNews = {
  id: string;
  title: string;
  publisher: string;
  link: string;
  at: string;
};

export type StockDesk = {
  symbol: string | null;
  price: string | null;
  change: string | null;
  up: boolean | null;
  loss: boolean;
  news: StockNews[];
  telegram: "off" | "waiting" | "linked";
};

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function quote(symbol: string): Promise<{ price: string; change: string; up: boolean } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketChangePercent?: number } }> };
  };
  const meta = json.chart?.result?.[0]?.meta;
  if (typeof meta?.regularMarketPrice !== "number") return null;
  const pct = typeof meta.regularMarketChangePercent === "number" ? meta.regularMarketChangePercent : 0;
  const sign = pct > 0 ? "+" : "";
  return { price: money(meta.regularMarketPrice), change: `${sign}${pct.toFixed(2)}%`, up: pct >= 0 };
}

async function headlines(symbol: string): Promise<StockNews[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  const response = await fetch(url, {
    headers: { Accept: "application/rss+xml", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.slice(0, 6).flatMap((item) => {
    const title = decode(readTag(item, "title"));
    const link = readTag(item, "link");
    if (!title || !link) return [];
    const publisher = decode(readTag(item, "source")) || "Yahoo Finance";
    const at = readTag(item, "pubDate");
    return [{ id: link, title, publisher, link, at: at ? new Date(at).toISOString() : "" }];
  });
}

function readTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() ?? "";
}

function decode(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'");
}

async function sendTelegram(chat: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  return response.ok;
}

async function fanout(ticker: string, chat: string | null, desk: { change: string | null; loss: boolean }, news: StockNews[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !chat || news.length === 0) return;
  const sql = await getSql();
  const seen = await sql<{ news_id: string }>`select news_id from news_sent where ticker = ${ticker}`;
  const known = new Set(seen.map((row) => row.news_id));
  const fresh = news.filter((item) => item.id && !known.has(item.id));
  if (known.size === 0) {
    for (const item of fresh.slice(1)) {
      await sql`insert into news_sent (ticker, news_id) values (${ticker}, ${item.id}) on conflict do nothing`;
    }
  }
  const toSend = known.size === 0 ? fresh.slice(0, 1) : fresh.slice(0, 3);
  const move = desk.loss ? `Loss ${desk.change ?? ""}`.trim() : `Move ${desk.change ?? ""}`.trim();
  for (const item of toSend) {
    const text = `${ticker} · ${move}\n${item.title}\n${item.link}`;
    const ok = await sendTelegram(chat, text.trim());
    if (ok) await sql`insert into news_sent (ticker, news_id) values (${ticker}, ${item.id}) on conflict do nothing`;
  }
}

export async function loadDesk(symbol: string | null, ticker: string | null): Promise<StockDesk> {
  const clean = symbol?.trim() || null;
  if (!clean) {
    return { symbol: null, price: null, change: null, up: null, loss: false, news: [], telegram: "off" };
  }
  const [move, news] = await Promise.all([
    quote(clean).catch(() => null),
    headlines(clean).catch(() => [] as StockNews[]),
  ]);
  const loss = move ? !move.up : false;
  let telegram: StockDesk["telegram"] = "off";
  if (ticker) {
    const sql = await getSql();
    const rows = await sql<{ telegram_chat: string | null }>`select telegram_chat from clubs where ticker = ${ticker}`;
    const chat = rows[0]?.telegram_chat ?? null;
    if (chat && process.env.TELEGRAM_BOT_TOKEN?.trim()) telegram = "linked";
    else if (chat) telegram = "waiting";
    void fanout(ticker, chat, { change: move?.change ?? null, loss }, news).catch(() => undefined);
  }
  return {
    symbol: clean,
    price: move?.price ?? null,
    change: move?.change ?? null,
    up: move ? move.up : null,
    loss,
    news,
    telegram,
  };
}

export async function linkTelegram(ticker: string, chatId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ ticker: string }>`select ticker from clubs where ticker = ${ticker}`;
  if (!rows.length) return false;
  await sql`update clubs set telegram_chat = ${chatId} where ticker = ${ticker}`;
  return true;
}
