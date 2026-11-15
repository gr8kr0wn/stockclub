import { shortAddr } from "@/lib/stockclub/model";
import { useMarket, type TokenizedStock } from "@/lib/stockclub/market";
import { Sparkline } from "@/components/bits";

function navLabel(token: TokenizedStock): string {
  if (token.nav == null) return "NAV unavailable";
  return `NAV ${token.nav.toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
}

export function MarketTape() {
  const market = useMarket();
  return (
    <>
      <section className="quote-row" aria-label="Market tape">
        {market.quotes.map((quote) => (
          <article key={quote.symbol} className="quote">
            <div>
              <strong>{quote.symbol}</strong>
              <span>
                {quote.price} <em className={quote.up ? "up" : "down"}>{quote.change}</em>
              </span>
            </div>
            <Sparkline points={quote.points} up={quote.up} />
          </article>
        ))}
      </section>
      <p className="tape-note">
        {market.status === "loading"
          ? "Loading live quotes. No access token is required."
          : market.quotesLive
            ? "Quotes from Yahoo Finance."
            : "Live quotes did not load."}{" "}
        {market.tokensLive ? "Token NAV from Coinbase on Base." : market.status === "ready" ? "Token NAV unavailable." : ""}{" "}
        Club balances stay simulated.
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
