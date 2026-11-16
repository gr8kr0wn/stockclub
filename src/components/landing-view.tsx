import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

const STEPS = [
  ["Pair the stock", "Search any ticker, ETF, or index. The club takes that symbol as its name."],
  ["Set the rules", "Write the room, choose a cover, and lock a split across members, ops, and the founder."],
  ["Fund the treasury", "Members deposit USDC. It shows on that club's Treasury tab, and nowhere else."],
  ["Vote before it moves", "A passed vote can pay one wallet, or cut the amount by the split. Members claim their share."],
];

export function LandingView() {
  return (
    <div className="landing">
      <header className="land-nav">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 16h3V8H4v8zm6 0h3V4h-3v12zm6 0h3v-6h-3v6z" />
            </svg>
          </span>
          StockClub
        </Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#treasury">Treasury</a>
          <Link to="/home">Open app</Link>
        </nav>
        <Link to="/home" className="btn btn-lime btn-slim">
          Enter <ArrowRight size={15} />
        </Link>
      </header>

      <section className="land-hero">
        <div>
          <p className="kicker">
            <span>BASE</span>
            <i />
          </p>
          <h1>
            A club and a treasury
            <br />
            for every stock.
          </h1>
          <p className="lede">
            StockClub gives any ticker its own room. Members talk, follow the news, and hold USDC together. The money stays in that club until a vote lets it out.
          </p>
          <div className="hero-actions">
            <Link to="/home" className="btn btn-lime">
              Open the app <ArrowRight size={16} />
            </Link>
            <Link to="/create" className="btn btn-ghost">
              Create a club
            </Link>
          </div>
        </div>
        <figure className="land-stage">
          <img src="/media/bull.png" alt="" />
          <figcaption>
            <span>Example</span>
            <strong>NVDA</strong>
            <small>Its own treasury. Not Tesla's.</small>
          </figcaption>
        </figure>
      </section>

      <section className="land-facts" aria-label="What StockClub is">
        <article>
          <strong>One pot per ticker</strong>
          <p>Clubs share a contract. Balances do not. A deposit to one club cannot be spent by another.</p>
        </article>
        <article>
          <strong>USDC, on the record</strong>
          <p>A deposit is a real transfer. The club lists it under Treasury, with the amount and the time.</p>
        </article>
        <article>
          <strong>No silent withdraw</strong>
          <p>Nothing leaves unless members vote. Yes has to win, and more than half the club has to show up.</p>
        </article>
      </section>

      <section id="how" className="land-how">
        <header>
          <p className="kicker">
            <span>HOW IT WORKS</span>
            <i />
          </p>
          <h2>From a ticker to a treasury.</h2>
        </header>
        <ol>
          {STEPS.map(([title, body], index) => (
            <li key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="treasury" className="land-treasury">
        <div>
          <p className="kicker">
            <span>TREASURY</span>
            <i />
          </p>
          <h2>The split is the payout rule.</h2>
          <p>
            When a club is created, it sets three percentages. Members, ops, and the founder. Those numbers decide a split payout. Ops and the founder are paid when the vote is released. Each member claims their own share.
          </p>
          <p>Put a wallet on the proposal instead, and the percentages are skipped. The whole amount goes to that address. Either way, a vote does not buy the stock.</p>
        </div>
        <div className="land-split" aria-hidden="true">
          <div>
            <b>70%</b>
            <span>Members</span>
            <i style={{ width: "70%" }} />
          </div>
          <div>
            <b>20%</b>
            <span>Ops</span>
            <i style={{ width: "20%" }} />
          </div>
          <div>
            <b>10%</b>
            <span>Founder</span>
            <i style={{ width: "10%" }} />
          </div>
        </div>
      </section>

      <section className="land-close">
        <h2>Open a room for the ticker you actually follow.</h2>
        <div className="hero-actions">
          <Link to="/create" className="btn btn-lime">
            Create a club <ArrowRight size={16} />
          </Link>
          <Link to="/explore" className="btn btn-ghost">
            Explore clubs
          </Link>
        </div>
      </section>

      <footer className="land-foot">
        <span>StockClub</span>
        <span>Base Sepolia</span>
        <span>A vote does not buy the stock.</span>
      </footer>
    </div>
  );
}
