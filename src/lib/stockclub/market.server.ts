import { blankQuote, type MarketSnapshot, type TapeQuote, type TokenizedStock } from "@/lib/stockclub/market";

const TAPE = [
  { symbol: "S&P 500", yahoo: "^GSPC", index: true },
  { symbol: "AAPL", yahoo: "AAPL", index: false },
  { symbol: "NVDA", yahoo: "NVDA", index: false },
  { symbol: "TSLA", yahoo: "TSLA", index: false },
] as const;

const TOKEN_TICKER: Record<string, string> = {
  NVDAc: "NVDA",
  TSLAc: "TSLA",
  AAPLc: "AAPL",
};

let cache: { at: number; data: MarketSnapshot } | null = null;

function moneyExact(n: number, index = false): string {
  const body = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return index ? body : `$${body}`;
}

function changeLabel(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

async function yahooQuote(symbol: string, yahoo: string, index: boolean): Promise<TapeQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=1mo`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`yahoo ${symbol} ${response.status}`);
  const json = (await response.json()) as {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: number; regularMarketChangePercent?: number };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  const price = result?.meta?.regularMarketPrice;
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((n): n is number => typeof n === "number");
  if (typeof price !== "number" || closes.length < 2) throw new Error(`yahoo ${symbol} empty`);
  const pct =
    typeof result?.meta?.regularMarketChangePercent === "number"
      ? result.meta.regularMarketChangePercent
      : ((price - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
  return {
    symbol,
    price: moneyExact(price, index),
    change: changeLabel(pct),
    up: pct >= 0,
    points: closes.slice(-8),
    live: true,
  };
}

async function tokenizedStocks(): Promise<TokenizedStock[]> {
  const found: TokenizedStock[] = [];
  let page: string | undefined;
  for (let i = 0; i < 8 && found.length < 3; i += 1) {
    const url = new URL("https://api.coinbase.com/v1/tokenized-stocks");
    url.searchParams.set("limit", "100");
    if (page) url.searchParams.set("page_token", page);
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "StockClub/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) break;
    const data = (await response.json()) as {
      next_page_token?: string;
      tokens?: Array<{
        symbol?: string;
        name?: string;
        contract_address?: string;
        nav_price?: number;
        nav_price_updated_at?: string;
      }>;
    };
    for (const token of data.tokens ?? []) {
      const ticker = token.symbol ? TOKEN_TICKER[token.symbol] : undefined;
      if (!ticker || !token.symbol || !token.contract_address) continue;
      found.push({
        ticker,
        symbol: token.symbol,
        name: token.name ?? ticker,
        contract: token.contract_address,
        nav: typeof token.nav_price === "number" ? token.nav_price : null,
        updated: token.nav_price_updated_at ?? null,
      });
    }
    page = data.next_page_token;
    if (!page) break;
  }
  return found;
}

export async function loadMarket(): Promise<MarketSnapshot> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const [quotes, tokens] = await Promise.all([
    Promise.all(
      TAPE.map((item) =>
        yahooQuote(item.symbol, item.yahoo, item.index).catch(() => blankQuote(item.symbol)),
      ),
    ),
    Promise.race([
      tokenizedStocks().catch(() => [] as TokenizedStock[]),
      new Promise<TokenizedStock[]>((resolve) => {
        setTimeout(() => resolve([]), 6000);
      }),
    ]),
  ]);
  const data: MarketSnapshot = {
    quotes,
    tokens,
    quotesLive: quotes.some((quote) => quote.live),
    tokensLive: tokens.length > 0,
    status: "ready",
  };
  if (data.quotesLive || data.tokensLive) cache = { at: Date.now(), data };
  return data;
}
