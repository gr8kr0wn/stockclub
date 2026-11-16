import { shortAddr, allClubs, tickerFromSymbol } from "@/lib/stockclub/model";
import { useMarket, type TokenizedStock } from "@/lib/stockclub/market";
import { useStock } from "@/lib/stockclub/store";
import { Sparkline } from "@/components/bits";

const PAIR: Record<string, { symbol: string; name: string }> = {
  "S&P 500": { symbol: "^GSPC", name: "S&P 500" },
  AAPL: { symbol: "AAPL", name: "Apple" },
  NVDA: { symbol: "NVDA", name: "NVIDIA" },
  TSLA: { symbol: "TSLA", name: "Tesla" },
};

function navLabel(token: TokenizedStock): string {
  if (token.nav == null) return "NAV unavailable";
  return `NAV ${token.nav.toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
}

export function MarketTape() {
  const market = useMarket();
  const extras = useStock((s) => s.extras);
  const clubs = allClubs(extras);
  return (
    <>
      <section className="quote-row" aria-label="Market tape">
        {market.quotes.map((quote) => {
          const pair = PAIR[quote.symbol] ?? { symbol: quote.symbol, name: quote.symbol };
          const existing = clubs.find(
            (club) => club.stockSymbol?.toUpperCase() === pair.symbol.toUpperCase() || club.ticker === tickerFromSymbol(pair.symbol),
          );
          const href = existing
            ? `/club/${existing.ticker.toLowerCase()}`
            : `/create?symbol=${encodeURIComponent(pair.symbol)}&name=${encodeURIComponent(pair.name)}&type=Stock`;
          return (
            <a key={quote.symbol} className="quote" href={href}>
              <div>
                <strong>{quote.symbol}</strong>
                <span>
                  {quote.price} <em className={quote.up ? "up" : "down"}>{quote.change}</em>
                </span>
              </div>
              <Sparkline points={quote.points} up={quote.up} />
            </a>
          );
        })}
      </section>
      <p className="tape-note">
        The four cards are only a sample. Search any stock, ETF, or index in the bar above, then create a club for it.{" "}
        {market.status === "loading"
          ? "Loading live quotes."
          : market.quotesLive
            ? "Quotes from Yahoo Finance."
            : "Live quotes did not load."}
      </p>
    </>
  );
}

export function TokenNote({ ticker }: { ticker: string }) {
  const market = useMarket();
  if (!market.tokensLive) return null;
  const token = market.tokens.find((item) => item.ticker === ticker);
  if (!token) return <small className="token-ref">No Coinbase token on Base</small>;
  return (
    <small className="token-ref">
      {token.symbol} {navLabel(token)}
      {" · "}
      <a href={`https://basescan.org/token/${token.contract}`} target="_blank" rel="noreferrer">
        {shortAddr(token.contract)}
      </a>
    </small>
  );
}
