import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClubCard, Empty, Mark } from "@/components/bits";
import { TokenNote } from "@/components/market-bits";
import {
  COVERS,
  allClubs,
  compact,
  membersOf,
  money,
  scoreOf,
  tickerFromSymbol,
  treasuryOf,
  type Membership,
} from "@/lib/stockclub/model";
import { searchStocks, type StockHit } from "@/lib/stockclub/market";
import { useStock } from "@/lib/stockclub/store";

export function ExploreView() {
  const extras = useStock((s) => s.extras);
  const query = useStock((s) => s.query);
  const bumps = useStock((s) => s.bumps);
  const usdcAdd = useStock((s) => s.usdcAdd);
  const [filter, setFilter] = useState<"trending" | "newest" | "active">("trending");
  const clubs = allClubs(extras).filter((club) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${club.name} ${club.ticker} ${club.tagline} ${club.stockSymbol ?? ""} ${club.stockName ?? ""}`.toLowerCase().includes(q);
  });
  const sorted = [...clubs].sort((a, b) => {
    if (filter === "newest") return b.founded.localeCompare(a.founded);
    if (filter === "active") return b.weeklyActivity - a.weeklyActivity;
    return scoreOf(b, bumps, usdcAdd) - scoreOf(a, bumps, usdcAdd);
  });

  return (
    <div className="page">
      <header className="page-intro">
        <h1>Explore clubs</h1>
        <p>Every ticker can have its own economy. Filter by what is actually moving.</p>
      </header>
      <div className="seg">
        {(["trending", "newest", "active"] as const).map((item) => (
          <button key={item} type="button" className={filter === item ? "is-active" : undefined} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      {sorted.length === 0 ? (
        <Empty title="No clubs match" body="Try another ticker, or create the first one." />
      ) : (
        <div className="explore-grid">
          {sorted.map((club) => (
            <ClubCard key={club.ticker} club={club} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CreateView() {
  const createClub = useStock((s) => s.createClub);
  const wallet = useStock((s) => s.wallet);
  const openConnect = useStock((s) => s.openConnect);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [membership, setMembership] = useState<Membership>("free");
  const [members, setMembers] = useState(70);
  const [ops, setOps] = useState(20);
  const [founder, setFounder] = useState(10);
  const [cover, setCover] = useState(COVERS[0] ?? "/media/nvda.jpg");
  const [error, setError] = useState<string | null>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [stockHits, setStockHits] = useState<StockHit[]>([]);
  const [paired, setPaired] = useState<StockHit | null>(null);

  function pair(hit: StockHit) {
    const next = tickerFromSymbol(hit.symbol);
    setPaired(hit);
    setStockQuery("");
    setStockHits([]);
    if (next) setTicker(next);
    setName((current) => current.trim() ? current : hit.name);
    setDescription((current) =>
      current.trim().length >= 12 ? current : `Community for ${hit.name} (${hit.symbol}).`,
    );
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const symbol = params.get("symbol");
    if (!symbol) return;
    pair({
      symbol,
      name: params.get("name") || symbol,
      type: params.get("type") || "Stock",
      exchange: "",
    });
    // Prefill once from the link that opened this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = stockQuery.trim();
    if (q.length < 1) {
      setStockHits([]);
      return;
    }
    const id = window.setTimeout(() => {
      void searchStocks(q).then(setStockHits).catch(() => setStockHits([]));
    }, 250);
    return () => window.clearTimeout(id);
  }, [stockQuery]);

  return (
    <div className="page narrow">
      <header className="page-intro">
        <h1>Create a club</h1>
        <p>Search any stock, ETF, or index and pair this club with it. The mark lives at /club/{ticker.toLowerCase() || "ticker"}.</p>
      </header>
      <form
        className="panel form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!wallet) {
            openConnect();
            return;
          }
          const result = await createClub({
            name,
            ticker,
            description,
            rules,
            membership,
            split: { members, ops, founder },
            cover,
            stockSymbol: paired?.symbol,
            stockName: paired?.name,
          });
          if (!result.ok) {
            setError(result.reason);
            return;
          }
          void navigate({ to: "/club/$ticker", params: { ticker: (result.ticker ?? ticker).toLowerCase() } });
        }}
      >
        <label>
          Pair with a stock
          <input
            value={stockQuery}
            onChange={(event) => setStockQuery(event.target.value)}
            placeholder="Search Microsoft, VOO, Bitcoin..."
          />
        </label>
        {stockHits.length > 0 ? (
          <div className="stock-hits">
            {stockHits.map((hit) => (
              <button key={hit.symbol} type="button" onClick={() => pair(hit)}>
                <strong>{hit.symbol}</strong>
                <span>{hit.name}</span>
                <small>{hit.type}{hit.exchange ? ` · ${hit.exchange}` : ""}</small>
              </button>
            ))}
          </div>
        ) : null}
        {paired ? <p className="paired">Paired with {paired.symbol} · {paired.name}</p> : null}
        <label>
          Club name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Club name" />
        </label>
        <label>
          Club ticker
          <input
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
            placeholder="NVDA"
          />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="What this club is for." />
        </label>
        <label>
          Community rules
          <textarea value={rules} onChange={(event) => setRules(event.target.value)} rows={3} placeholder="No spam. Cite sources. Be sharp." />
        </label>
        <fieldset>
          <legend>Membership</legend>
          <label className="check">
            <input type="radio" name="membership" checked={membership === "free"} onChange={() => setMembership("free")} />
            Free — join immediately
          </label>
          <label className="check">
            <input type="radio" name="membership" checked={membership === "collectible"} onChange={() => setMembership("collectible")} />
            Collectible — mint a membership pass
          </label>
        </fieldset>
        <fieldset>
          <legend>Treasury split ({members + ops + founder}%)</legend>
          <div className="split-inputs">
            <label>
              Members
              <input type="number" min={0} max={100} value={members} onChange={(event) => setMembers(Number(event.target.value))} />
            </label>
            <label>
              Ops
              <input type="number" min={0} max={100} value={ops} onChange={(event) => setOps(Number(event.target.value))} />
            </label>
            <label>
              Founder
              <input type="number" min={0} max={100} value={founder} onChange={(event) => setFounder(Number(event.target.value))} />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Cover</legend>
          <div className="cover-pick">
            {COVERS.map((src) => (
              <button key={src} type="button" className={cover === src ? "is-active" : undefined} onClick={() => setCover(src)}>
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        </fieldset>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-lime">
          {wallet ? "Launch club" : "Connect wallet to launch"}
        </button>
      </form>
    </div>
  );
}

export function MyClubsView() {
  const extras = useStock((s) => s.extras);
  const joined = useStock((s) => s.joined);
  const wallet = useStock((s) => s.wallet);
  const clubs = allClubs(extras).filter((club) => joined.includes(club.ticker) || club.founderAddress === wallet?.address);
  return (
    <div className="page">
      <header className="page-intro">
        <h1>My clubs</h1>
        <p>{wallet ? `Signed in as ${wallet.name} on Base.` : "Connect a wallet. Membership follows that address, not this browser."}</p>
      </header>
      {clubs.length === 0 ? (
        <Empty title="No memberships yet" body="Explore a ticker or create the club you wish existed." />
      ) : (
        <div className="explore-grid">
          {clubs.map((club) => (
            <ClubCard key={club.ticker} club={club} />
          ))}
        </div>
      )}
      <Link to="/explore" className="btn btn-ghost">
        Explore clubs
      </Link>
    </div>
  );
}

export function TreasuryView() {
  const extras = useStock((s) => s.extras);
  const joined = useStock((s) => s.joined);
  const wallet = useStock((s) => s.wallet);
  const usdcAdd = useStock((s) => s.usdcAdd);
  const stockAdd = useStock((s) => s.stockAdd);
  const contributions = useStock((s) => s.contributions);
  const registry = useStock((s) => s.registry);
  const deploy = useStock((s) => s.deploy);
  const openConnect = useStock((s) => s.openConnect);
  const clubs = allClubs(extras).filter((club) => joined.includes(club.ticker));
  const mine = contributions.filter((row) => row.address === wallet?.address).reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="page">
      <header className="page-intro">
        <h1>Treasury</h1>
        <p>
          {registry
            ? "Confirmed Base USDC sitting in the club contract. Stock shown here is not a brokerage position."
            : "No treasury contract on Base yet. Deploy it from a club before USDC can move."}
        </p>
      </header>
      <div className="stat-row panel">
        <div>
          <strong>{money(mine)}</strong>
          <span>You contributed</span>
        </div>
        <div>
          <strong>{clubs.length}</strong>
          <span>Clubs you fund</span>
        </div>
        <div>
          <strong>{wallet ? wallet.name : "Guest"}</strong>
          <span>Profile</span>
        </div>
      </div>
      {clubs.length === 0 ? (
        <Empty title="No club treasury yet" body="Join a club, then add USDC from its treasury tab." />
      ) : (
        <div className="stack">
          {clubs.map((club) => {
            const treasury = treasuryOf(club, usdcAdd, stockAdd);
            return (
              <Link key={club.ticker} to="/club/$ticker" params={{ ticker: club.ticker.toLowerCase() }} className="panel treasury-link">
                <Mark ticker={club.ticker} />
                <div>
                  <strong>{club.name}</strong>
                  <span className="muted">
                    USDC {money(treasury.usdc)} · Stock {money(treasury.stock)}
                    <TokenNote ticker={club.ticker} />
                  </span>
                </div>
                <b>{money(treasury.total)}</b>
              </Link>
            );
          })}
        </div>
      )}
      {!registry ? (
        <button
          type="button"
          className="btn btn-lime"
          onClick={() => {
            if (!wallet) {
              openConnect();
              return;
            }
            void deploy();
          }}
        >
          Deploy treasury on Base Sepolia
        </button>
      ) : (
        <p className="muted">Treasury contract {registry}</p>
      )}
    </div>
  );
}

export function GovernanceView() {
  const proposals = useStock((s) => s.proposals);
  return (
    <div className="page">
      <header className="page-intro">
        <h1>Governance</h1>
        <p>Votes record what the club wants. They do not authorize an asset purchase.</p>
      </header>
      <div className="stack">
        {proposals.length === 0 ? (
          <Empty title="No open proposals" body="Open one from a club you belong to. Nothing is preloaded." />
        ) : (
          proposals.map((proposal) => (
            <Link key={proposal.id} to="/club/$ticker" params={{ ticker: proposal.ticker.toLowerCase() }} className="panel">
              <p className="kicker"><span>{proposal.ticker}</span></p>
              <h2>{proposal.title}</h2>
              <p>{proposal.body}</p>
              <p className="muted">Yes {proposal.yes} · No {proposal.no} · {proposal.daysLeft} days left</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export function LeaderboardView() {
  const extras = useStock((s) => s.extras);
  const bumps = useStock((s) => s.bumps);
  const usdcAdd = useStock((s) => s.usdcAdd);
  const ranked = useMemo(
    () => [...allClubs(extras)].sort((a, b) => scoreOf(b, bumps, usdcAdd) - scoreOf(a, bumps, usdcAdd)),
    [bumps, extras, usdcAdd],
  );
  return (
    <div className="page">
      <header className="page-intro">
        <h1>Leaderboard</h1>
        <p>Score mixes member growth, contributions, challenges, and treasury activity. Not raw transactions.</p>
      </header>
      {ranked.length === 0 ? (
        <Empty title="No clubs on the board" body="Create one and it will rank from real activity." />
      ) : (
        <ol className="board panel">
          {ranked.map((club, index) => (
            <li key={club.ticker}>
              <span className="rank-n">#{index + 1}</span>
              <Mark ticker={club.ticker} />
              <Link to="/club/$ticker" params={{ ticker: club.ticker.toLowerCase() }}>
                <strong>{club.name}</strong>
                <small>{compact(membersOf(club, bumps))} members</small>
              </Link>
              <b>{scoreOf(club, bumps, usdcAdd).toLocaleString("en-US")}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function RewardsView() {
  const joined = useStock((s) => s.joined);
  const extras = useStock((s) => s.extras);
  const votes = useStock((s) => s.votes);
  const contributions = useStock((s) => s.contributions);
  const cheers = useStock((s) => s.cheers);
  const wallet = useStock((s) => s.wallet);
  const points = useStock((s) => s.points);
  const founded = extras.some((club) => club.founderAddress === wallet?.address);
  const badges = [
    { name: "First chair", detail: "Join any club", on: joined.length > 0 },
    { name: "Founder", detail: "Create a ticker identity", on: founded },
    { name: "Ballot", detail: "Cast a governance vote", on: Object.keys(votes).length > 0 },
    { name: "Treasury", detail: "Send USDC into a club contract", on: contributions.some((row) => row.address === wallet?.address) },
    { name: "Battle", detail: "Back a club in the weekly fight", on: cheers.length > 0 },
  ];
  return (
    <div className="page">
      <header className="page-intro">
        <h1>Rewards</h1>
        <p>{wallet ? `${points.toLocaleString("en-US")} points on ${wallet.name}.` : "Connect a wallet. Points follow that address."}</p>
      </header>
      <div className="badge-grid">
        {badges.map((badge) => (
          <article key={badge.name} className={badge.on ? "panel badge is-on" : "panel badge"}>
            <span>{badge.on ? "Unlocked" : "Locked"}</span>
            <h2>{badge.name}</h2>
            <p>{badge.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
