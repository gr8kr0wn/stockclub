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
  return items.slice(0, 12).flatMap((item) => {
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
    .replace(new RegExp("&" + "amp;", "g"), "&")
    .replace(new RegExp("&" + "lt;", "g"), "<")
    .replace(new RegExp("&" + "gt;", "g"), ">")
    .replace(new RegExp("&" + "quot;", "g"), '"')
    .replace(new RegExp("&" + "#39;", "g"), "'");
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

async function fanout(ticker: string, chat: string | null, change: string | null, news: StockNews[]): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !chat || news.length === 0) return 0;
  const sql = await getSql();
  const seen = await sql<{ news_id: string }>`select news_id from news_sent where ticker = ${ticker}`;
  const known = new Set(seen.map((row) => row.news_id));
  const fresh = news.filter((item) => item.id && !known.has(item.id)).slice(0, 8);
  let sent = 0;
  for (const item of fresh) {
    const move = change ? ` ${change}` : "";
    const text = `${ticker}${move}\n${item.title}\n${item.publisher}\n${item.link}`;
    const ok = await sendTelegram(chat, text);
    if (!ok) continue;
    await sql`insert into news_sent (ticker, news_id) values (${ticker}, ${item.id}) on conflict do nothing`;
    sent += 1;
  }
  return sent;
}

export async function pollLinkedClubs(): Promise<{ clubs: number; sent: number }> {
  const sql = await getSql();
  const clubs = await sql<{ ticker: string; stock_symbol: string; telegram_chat: string }>`
    select ticker, stock_symbol, telegram_chat from clubs
    where telegram_chat is not null and stock_symbol is not null
  `;
  let sent = 0;
  for (const club of clubs) {
    const [move, news] = await Promise.all([
      quote(club.stock_symbol).catch(() => null),
      headlines(club.stock_symbol).catch(() => [] as StockNews[]),
    ]);
    sent += await fanout(club.ticker, club.telegram_chat, move?.change ?? null, news);
  }
  return { clubs: clubs.length, sent };
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
    void fanout(ticker, chat, move?.change ?? null, news).catch(() => undefined);
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

export async function issueTelegramCode(ticker: string, founder: string): Promise<{ code: string; expiresAt: string; botUrl: string | null } | { error: string }> {
  const sql = await getSql();
  const clubs = await sql<{ founder: string }>`select founder from clubs where ticker = ${ticker}`;
  if (!clubs.length) return { error: "Club not found." };
  if (clubs[0].founder !== founder) return { error: "Only the club creator can connect Telegram." };
  await sql`
    delete from telegram_codes
    where ticker = ${ticker} and founder = ${founder} and used_at is null and expires_at <= now()
  `;
  const existing = await sql<{ code: string; expires_at: unknown }>`
    select code, expires_at from telegram_codes
    where ticker = ${ticker} and founder = ${founder} and used_at is null and expires_at > now()
    order by expires_at desc
    limit 1
  `;
  if (existing[0]) {
    const code = existing[0].code;
    return { code, expiresAt: new Date(String(existing[0].expires_at)).toISOString(), botUrl: await botLink(code) };
  }
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    try {
      await sql`
        insert into telegram_codes (code, ticker, founder, expires_at)
        values (${code}, ${ticker}, ${founder}, ${expires.toISOString()})
      `;
      return { code, expiresAt: expires.toISOString(), botUrl: await botLink(code) };
    } catch {
      // Another club drew the same 6 digits. Try again.
    }
  }
  return { error: "Could not make a code. Try again." };
}

export async function verifyTelegramCode(code: string, telegramUserId: string): Promise<{ ok: true; ticker: string } | { ok: false; reason: string }> {
  const sql = await getSql();
  const rows = await sql<{ ticker: string; telegram_user: string | null; expires_at: unknown }>`
    select ticker, telegram_user, expires_at from telegram_codes
    where code = ${code} and used_at is null and expires_at > now()
  `;
  const row = rows[0];
  if (!row) return { ok: false, reason: "That code is wrong or it expired. Get a new one from your club page. Codes last 10 minutes." };
  if (row.telegram_user && row.telegram_user !== telegramUserId) {
    return { ok: false, reason: "That code was already used by another Telegram account." };
  }
  await sql`update telegram_codes set telegram_user = ${telegramUserId} where code = ${code}`;
  return { ok: true, ticker: row.ticker };
}

export async function linkVerifiedGroup(telegramUserId: string, chatId: string): Promise<{ ok: true; ticker: string } | { ok: false; reason: string }> {
  const sql = await getSql();
  const rows = await sql<{ code: string; ticker: string }>`
    select code, ticker from telegram_codes
    where telegram_user = ${telegramUserId} and used_at is null and expires_at > now()
    order by expires_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, reason: "Only the club creator can connect a group. Get a code on StockClub, send it to this bot in private, then add the bot." };
  await sql`update clubs set telegram_chat = ${chatId} where ticker = ${row.ticker}`;
  await sql`update telegram_codes set used_at = now() where code = ${row.code}`;
  return { ok: true, ticker: row.ticker };
}

async function botLink(code: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = (await response.json()) as { ok?: boolean; result?: { username?: string } };
  const username = data.result?.username;
  if (!data.ok || !username) return null;
  return `https://t.me/${username}?start=${code}`;
}
