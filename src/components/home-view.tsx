import { Link } from "@tanstack/react-router";
import { ArrowRight, Gift, Play, Trophy } from "lucide-react";
import { useState } from "react";
import { ClubCard, Empty, Mark } from "@/components/bits";
import { MarketTape } from "@/components/market-bits";
import {
  allClubs,
  compact,
  membersOf,
  money,
  scoreOf,
  treasuryOf,
} from "@/lib/stockclub/model";
import { useStock } from "@/lib/stockclub/store";

const STEPS = [
  ["Discover", "Find the ticker communities already compounding."],
  ["Create", "Spin up a club. You become the founding admin."],
  ["Join", "Free, or mint a collectible membership."],
  ["Contribute", "Posts, challenges, and voluntary USDC."],
  ["Earn", "Fees, sponsors, and reputation stay with the club."],
  ["Govern", "Vote intent. A vote is not a brokerage order."],
  ["Grow", "Weekly battles reward real activity, not spam."],
];

export function HomeView() {
  const extras = useStock((s) => s.extras);
  const bumps = useStock((s) => s.bumps);
  const usdcAdd = useStock((s) => s.usdcAdd);
  const stockAdd = useStock((s) => s.stockAdd);
  const cheers = useStock((s) => s.cheers);
  const cheer = useStock((s) => s.cheer);
  const wallet = useStock((s) => s.wallet);
  const openConnect = useStock((s) => s.openConnect);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  const clubs = allClubs(extras);
  const ranked = [...clubs].sort(
    (a, b) => scoreOf(b, bumps, usdcAdd) - scoreOf(a, bumps, usdcAdd),
  );
  const shown = ranked.slice(0, 3);
  const battle = ranked.slice(0, 2);
  const memberTotal = clubs.reduce((sum, club) => sum + membersOf(club, bumps), 0);
  const treasuryTotal = clubs.reduce((sum, club) => sum + treasuryOf(club, usdcAdd, stockAdd).total, 0);

  return (
    <div className="page">
      <section
        className="hero"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setShift({
            x: (event.clientX - rect.left) / rect.width - 0.5,
            y: (event.clientY - rect.top) / rect.height - 0.5,
          });
        }}
        onPointerLeave={() => setShift({ x: 0, y: 0 })}
      >
        <img
          src="/media/bull.png"
          alt="Chrome bull in front of a columned exchange, lit by green candlesticks"
          className="hero-bull"
          style={{
            transform: `translate3d(${shift.x * -18}px, ${shift.y * -10}px, 0) scale(1.04)`,
          }}
        />
        <div className="hero-copy">
          <p className="kicker">
            <span>STOCKCLUB</span>
            <i />
          </p>
          <h1>
            Your Community.
            <br />
            Your Ticker.
            <br />
            <em>Your Treasury.</em>
          </h1>
          <p className="lede">
            Join or create stock communities, earn rewards, and grow together on Base.
          </p>
          <div className="hero-actions">
            <Link to="/explore" className="btn btn-lime">
              Explore Clubs <ArrowRight size={16} />
            </Link>
            <a href="#how" className="btn btn-ghost">
              Learn More <Play size={14} />
            </a>
          </div>
        </div>
      </section>

      <MarketTape />

      <section className="split-board">
        <div>
          <header className="section-head">
            <h2>Featured Clubs</h2>
            <Link to="/explore">
              See all <ArrowRight size={14} />
            </Link>
          </header>
          {shown.length === 0 ? (
            <Empty title="No clubs yet" body="Create the first ticker. Nothing here is preloaded." />
          ) : (
            <div className="featured-grid">
              {shown.map((club) => (
                <ClubCard key={club.ticker} club={club} />
              ))}
            </div>
          )}
        </div>
        <aside className="panel">
          <header className="section-head">
            <h2>
              <Trophy size={16} /> Top Communities
            </h2>
            <Link to="/leaderboard">
              View all <ArrowRight size={14} />
            </Link>
          </header>
          {ranked.length === 0 ? (
            <p className="muted">No communities yet.</p>
          ) : (
            <ol className="rank-list">
              {ranked.slice(0, 5).map((club, index) => {
                const treasury = treasuryOf(club, usdcAdd, stockAdd);
                return (
                  <li key={club.ticker}>
                    <span className="rank-n">{index + 1}</span>
                    <Mark ticker={club.ticker} />
                    <Link to="/club/$ticker" params={{ ticker: club.ticker.toLowerCase() }}>
                      {club.name}
                    </Link>
                    <b>{money(treasury.total)}</b>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </section>

      <section className="bottom-grid">
        <article className="panel stat-panel">
          <h2>
            <span className="brand-mark sm" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 16h3V8H4v8zm6 0h3V4h-3v12zm6 0h3v-6h-3v6z" />
              </svg>
            </span>
            StockClub in Numbers
          </h2>
          <div className="stat-row">
            <div>
              <strong>{compact(memberTotal)}</strong>
              <span>Total Members</span>
            </div>
            <div>
              <strong>{money(treasuryTotal)}</strong>
              <span>Community Treasury</span>
            </div>
            <div>
              <strong>{compact(clubs.length)}</strong>
              <span>Clubs Created</span>
            </div>
          </div>
        </article>
        <article className="panel reward-panel">
          <span className="gift-badge" aria-hidden="true">
            <Gift size={18} />
          </span>
          <div>
            <h2>Earn Rewards. Grow Your Club.</h2>
            <p>Complete quests, participate in governance, and earn exclusive rewards on Base.</p>
            <Link to="/rewards" className="text-link">
              See rewards <ArrowRight size={14} />
            </Link>
          </div>
        </article>
      </section>

      <section id="how" className="panel how">
        <header className="section-head">
          <h2>How StockClub works</h2>
        </header>
        <ol className="steps">
          {STEPS.map(([title, body], index) => (
            <li key={title}>
              <span>0{index + 1}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel battle">
        <header className="section-head">
          <h2>Weekly StockClub Battle</h2>
          {battle[0] && battle[1] ? (
            <span className="pill">
              {battle[0].ticker} vs {battle[1].ticker}
            </span>
          ) : null}
        </header>
        {battle.length < 2 ? (
          <p className="muted">A battle starts when two clubs exist. None are loaded.</p>
        ) : (
          <>
            <p className="muted">
              The two highest-scoring clubs. Backing is a cheer, not a transfer.
            </p>
            <div className="battle-sides">
              {battle.map((club) => {
                const backed = cheers.includes(club.ticker);
                return (
                  <article key={club.ticker}>
                    <img src={club.cover} alt="" />
                    <div>
                      <strong>{club.name}</strong>
                      <span>{scoreOf(club, bumps, usdcAdd).toLocaleString("en-US")} pts</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-slim"
                        onClick={() => {
                          if (!wallet) {
                            openConnect();
                            return;
                          }
                          cheer(club.ticker);
                        }}
                      >
                        {backed ? "Backed" : "Back this club"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
