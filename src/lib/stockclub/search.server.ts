export type StockHit = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};

const ALLOWED = new Set(["EQUITY", "ETF", "INDEX", "MUTUALFUND", "CRYPTOCURRENCY"]);

export async function searchStocks(raw: string): Promise<StockHit[]> {
  const query = raw.trim().slice(0, 40);
  if (query.length < 1) return [];
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "12");
  url.searchParams.set("newsCount", "0");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const json = (await response.json()) as {
    quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }>;
  };
  const hits: StockHit[] = [];
  for (const quote of json.quotes ?? []) {
    if (!quote.symbol || !quote.quoteType || !ALLOWED.has(quote.quoteType)) continue;
    if (hits.some((hit) => hit.symbol === quote.symbol)) continue;
    hits.push({
      symbol: quote.symbol,
      name: quote.shortname || quote.longname || quote.symbol,
      type: quote.quoteType === "CRYPTOCURRENCY" ? "Token" : quote.quoteType === "MUTUALFUND" ? "Fund" : quote.quoteType === "INDEX" ? "Index" : quote.quoteType === "ETF" ? "ETF" : "Stock",
      exchange: quote.exchDisp ?? "",
    });
    if (hits.length === 8) break;
  }
  return hits;
}
