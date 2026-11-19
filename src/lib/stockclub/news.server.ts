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
  discord: "off" | "waiting" | "linked";
};

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function discordConfig(): Promise<{ token: string; publicKey: string; clientId: string } | null> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim();
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  if (token && publicKey && clientId) return { token, publicKey, clientId };
  const sql = await getSql();
  const rows = await sql<{ discord_token: string | null; discord_public_key: string | null; discord_client_id: string | null }>`
    select discord_token, discord_public_key, discord_client_id from bot_config where id = 1
  `;
  const row = rows[0];
  if (!row?.discord_token || !row.discord_public_key) return null;
  return {
    token: token || row.discord_token,
    publicKey: publicKey || row.discord_public_key,
    clientId: clientId || row.discord_client_id || "1572602113102712842",
  };
}

export async function discordPublicKey(): Promise<string | null> {
  return (await discordConfig())?.publicKey ?? null;
}

export async function discordBotToken(): Promise<string | null> {
  return (await discordConfig())?.token ?? null;
}

async function quote(symbol: string): Promise<{ price: string; raw: number; change: string; up: boolean } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
  };
  const raw = json.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof raw !== "number") return null;
  return { price: money(raw), raw, change: "", up: true };
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

async function sendTelegram(chat: string, text: string, link: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: `${text}\n${link}`,
      disable_web_page_preview: false,
      link_preview_options: { is_disabled: false, url: link, prefer_large_media: true },
    }),
  });
  return response.ok;
}

async function previewImage(link: string): Promise<string | null> {
  try {
    const response = await fetch(link, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function sendDiscord(channel: string, text: string, link: string, title: string): Promise<boolean> {
  const token = (await discordBotToken()) ?? "";
  if (!token) return false;
  const image = await previewImage(link);
  const response = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bot ${token}` },
    body: JSON.stringify({
      content: text.slice(0, 1800),
      embeds: [{ title: title.slice(0, 250), url: link, description: link, image: image ? { url: image } : undefined }],
    }),
  });
  return response.ok;
}

function formatSurge(current: number, previous: number): string | null {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}% since last update`;
}

function filterNews(news: StockNews[], kind: string, surge: string | null): StockNews[] {
  if (kind === "moves") return [];
  if (kind === "gains" && surge && surge.startsWith("-")) return [];
  if (kind === "losses" && surge && !surge.startsWith("-")) return [];
  return news;
}

async function fanout(
  ticker: string,
  symbol: string,
  chat: string | null,
  discord: string | null,
  surge: string | null,
  news: StockNews[],
  kind: string,
): Promise<number> {
  if (!chat && !discord) return 0;
  const sql = await getSql();
  const wantNews = kind === "all" || kind === "headlines" || kind === "gains" || kind === "losses";
  const wantMove = kind === "all" || kind === "moves" || kind === "gains" || kind === "losses";
  let sent = 0;
  if (wantMove && surge) {
    const moveId = `move:${ticker}:${new Date().toISOString().slice(0, 16)}`;
    const seenMove = await sql<{ news_id: string }>`select news_id from news_sent where ticker = ${ticker} and news_id = ${moveId}`;
    if (!seenMove.length) {
      const text = `${ticker} last move ${surge}`;
      const quoteLink = `https://finance.yahoo.com/quote/${symbol}`;
      const telegramOk = chat ? await sendTelegram(chat, text, quoteLink) : false;
      const discordOk = discord ? await sendDiscord(discord, text, quoteLink, `${ticker} last move`) : false;
      if (telegramOk || discordOk) {
        await sql`insert into news_sent (ticker, news_id) values (${ticker}, ${moveId}) on conflict do nothing`;
        sent += 1;
      }
    }
  }
  if (!wantNews || news.length === 0) return sent;
  const seen = await sql<{ news_id: string }>`select news_id from news_sent where ticker = ${ticker}`;
  const known = new Set(seen.map((row) => row.news_id));
  const fresh = news.filter((item) => item.id && !known.has(item.id)).slice(0, 4);
  for (const item of fresh) {
    const text = `${ticker}${surge ? ` ${surge}` : ""}\n${item.title}\n${item.publisher}`;
    const telegramOk = chat ? await sendTelegram(chat, text, item.link) : false;
    const discordOk = discord ? await sendDiscord(discord, text, item.link, item.title) : false;
    if (!telegramOk && !discordOk) continue;
    await sql`insert into news_sent (ticker, news_id) values (${ticker}, ${item.id}) on conflict do nothing`;
    sent += 1;
  }
  return sent;
}

export async function pollLinkedClubs(): Promise<{ clubs: number; sent: number }> {
  const sql = await getSql();
  const clubs = await sql<{
    ticker: string;
    stock_symbol: string;
    telegram_chat: string | null;
    discord_channel: string | null;
    news_minutes: number | null;
    news_kind: string | null;
    last_price: string | null;
    last_sent_at: string | null;
  }>`
    select ticker, stock_symbol, telegram_chat, discord_channel, news_minutes, news_kind, last_price, last_sent_at from clubs
    where stock_symbol is not null and (telegram_chat is not null or discord_channel is not null)
  `;
  let sent = 0;
  for (const club of clubs) {
    const minutes = Math.max(5, Number(club.news_minutes) || 5);
    const last = club.last_sent_at ? new Date(club.last_sent_at).getTime() : 0;
    if (last && Date.now() - last < minutes * 60 * 1000) continue;
    const [move, news] = await Promise.all([
      quote(club.stock_symbol).catch(() => null),
      headlines(club.stock_symbol).catch(() => [] as StockNews[]),
    ]);
    const previous = club.last_price == null ? null : Number(club.last_price);
    const surge = move && previous ? formatSurge(move.raw, previous) : null;
    const kind = club.news_kind || "all";
    sent += await fanout(club.ticker, club.stock_symbol, club.telegram_chat, club.discord_channel, surge, filterNews(news, kind, surge), kind);
    if (move) await sql`update clubs set last_price = ${move.raw}, last_sent_at = now() where ticker = ${club.ticker}`;
  }
  return { clubs: clubs.length, sent };
}

export async function loadDesk(symbol: string | null, ticker: string | null): Promise<StockDesk> {
  const clean = symbol?.trim() || null;
  if (!clean) {
    return { symbol: null, price: null, change: null, up: null, loss: false, news: [], telegram: "off", discord: "off" };
  }
  const [move, news] = await Promise.all([
    quote(clean).catch(() => null),
    headlines(clean).catch(() => [] as StockNews[]),
  ]);
  let telegram: StockDesk["telegram"] = "off";
  let discord: StockDesk["discord"] = "off";
  let change: string | null = null;
  let up: boolean | null = null;
  if (ticker) {
    const sql = await getSql();
    const rows = await sql<{ telegram_chat: string | null; discord_channel: string | null; last_price: string | null }>`
      select telegram_chat, discord_channel, last_price from clubs where ticker = ${ticker}
    `;
    const chat = rows[0]?.telegram_chat ?? null;
    const channel = rows[0]?.discord_channel ?? null;
    const previous = rows[0]?.last_price == null ? null : Number(rows[0].last_price);
    if (move && previous) {
      const surge = formatSurge(move.raw, previous);
      change = surge;
      up = surge ? !surge.startsWith("-") : null;
    }
    if (chat && process.env.TELEGRAM_BOT_TOKEN?.trim()) telegram = "linked";
    else if (chat) telegram = "waiting";
    if (channel && (await discordBotToken())) discord = "linked";
    else if (channel) discord = "waiting";
    void fanout(ticker, clean, chat, channel, null, news, "headlines").catch(() => undefined);
  }
  return {
    symbol: clean,
    price: move?.price ?? null,
    change,
    up,
    loss: up === false,
    news,
    telegram,
    discord,
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

export async function issueDiscordCode(ticker: string, founder: string): Promise<{ code: string; expiresAt: string; inviteUrl: string | null } | { error: string }> {
  const sql = await getSql();
  const clubs = await sql<{ founder: string }>`select founder from clubs where ticker = ${ticker}`;
  if (!clubs.length) return { error: "Club not found." };
  if (clubs[0].founder !== founder) return { error: "Only the club creator can connect Discord." };
  await sql`
    delete from discord_codes
    where ticker = ${ticker} and founder = ${founder} and used_at is null and expires_at <= now()
  `;
  const existing = await sql<{ code: string; expires_at: unknown }>`
    select code, expires_at from discord_codes
    where ticker = ${ticker} and founder = ${founder} and used_at is null and expires_at > now()
    order by expires_at desc
    limit 1
  `;
  if (existing[0]) {
    return { code: existing[0].code, expiresAt: new Date(String(existing[0].expires_at)).toISOString(), inviteUrl: discordInvite() };
  }
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    try {
      await sql`
        insert into discord_codes (code, ticker, founder, expires_at)
        values (${code}, ${ticker}, ${founder}, ${expires.toISOString()})
      `;
      return { code, expiresAt: expires.toISOString(), inviteUrl: discordInvite() };
    } catch {
      // Another club drew the same 6 digits.
    }
  }
  return { error: "Could not make a code. Try again." };
}

export async function linkDiscordChannel(code: string, channelId: string): Promise<{ ok: true; ticker: string } | { ok: false; reason: string }> {
  const sql = await getSql();
  const rows = await sql<{ ticker: string }>`
    select ticker from discord_codes
    where code = ${code} and used_at is null and expires_at > now()
  `;
  const row = rows[0];
  if (!row) return { ok: false, reason: "That code is wrong or it expired. Get a new one from your club page. Codes last 10 minutes." };
  await sql`update clubs set discord_channel = ${channelId} where ticker = ${row.ticker}`;
  await sql`update discord_codes set used_at = now() where code = ${code}`;
  return { ok: true, ticker: row.ticker };
}

function discordInvite(): string {
  return "https://discord.com/api/oauth2/authorize?client_id=1572602113102712842&permissions=2048&scope=bot%20applications.commands";
}

export async function saveNewsPrefs(ticker: string, founder: string, minutes: number, kind: string): Promise<{ ok: true } | { error: string }> {
  const sql = await getSql();
  const clubs = await sql<{ founder: string }>`select founder from clubs where ticker = ${ticker}`;
  if (!clubs.length) return { error: "Club not found." };
  if (clubs[0].founder !== founder) return { error: "Only the club creator can change news settings." };
  const allowed = ["all", "headlines", "moves", "gains", "losses"];
  const nextKind = allowed.includes(kind) ? kind : "all";
  const nextMinutes = Math.min(240, Math.max(5, Math.round(minutes) || 5));
  await sql`update clubs set news_minutes = ${nextMinutes}, news_kind = ${nextKind} where ticker = ${ticker}`;
  return { ok: true };
}
