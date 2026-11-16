import { useEffect, useState } from "react";

export type TapeQuote = {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
  points: number[];
  live: boolean;
};

export type TokenizedStock = {
  ticker: string;
  symbol: string;
  name: string;
  contract: string;
  nav: number | null;
  updated: string | null;
};

export type MarketSnapshot = {
  quotes: TapeQuote[];
  tokens: TokenizedStock[];
  quotesLive: boolean;
  tokensLive: boolean;
  status: "loading" | "ready";
};

const TAPE = ["S&P 500", "AAPL", "NVDA", "TSLA"] as const;

export function blankQuote(symbol: string): TapeQuote {
  return { symbol, price: "—", change: "", up: true, points: [1, 1], live: false };
}

export const EMPTY_MARKET: MarketSnapshot = {
  quotes: TAPE.map((symbol) => ({ ...blankQuote(symbol), price: "…" })),
  tokens: [],
  quotesLive: false,
  tokensLive: false,
  status: "loading",
};

function apiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = window.location.pathname.match(/^\/hds-[a-z0-9]+-\d+-[a-z0-9]+/i)?.[0] ?? "";
  return `${prefix}${path}`;
}

function marketUrl(): string {
  return apiUrl("/api/market");
}

export type StockHit = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};

export async function searchStocks(query: string): Promise<StockHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const response = await fetch(`${apiUrl("/api/search")}?q=${encodeURIComponent(q)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { stocks?: StockHit[] };
  return Array.isArray(data.stocks) ? data.stocks : [];
}

let pending: Promise<MarketSnapshot> | null = null;

async function loadClientMarket(): Promise<MarketSnapshot> {
  const response = await fetch(marketUrl(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as MarketSnapshot;
  if (!data || !Array.isArray(data.quotes)) throw new Error("bad market");
  return { ...data, status: "ready" };
}

export function useMarket(): MarketSnapshot {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(EMPTY_MARKET);
  useEffect(() => {
    let cancel = false;
    pending ??= loadClientMarket().catch(() => ({
      ...EMPTY_MARKET,
      quotes: TAPE.map((symbol) => blankQuote(symbol)),
      status: "ready" as const,
    }));
    void pending.then((next) => {
      if (!next.quotesLive && !next.tokensLive) pending = null;
      if (!cancel) setSnapshot(next);
    });
    return () => {
      cancel = true;
    };
  }, []);
  return snapshot;
}
