import { Link } from "@tanstack/react-router";
import { ArrowRight, Users, Vault } from "lucide-react";
import type { Club } from "@/lib/stockclub/model";
import { compact, membersOf, money, treasuryOf } from "@/lib/stockclub/model";
import { useStock } from "@/lib/stockclub/store";

export function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 56;
      const y = 20 - ((point - min) / span) * 16;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 56 22" className={up ? "spark is-up" : "spark is-down"} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Mark({ ticker }: { ticker: string }) {
  return <span className="mark">{ticker.slice(0, 2)}</span>;
}

export function ClubCard({ club }: { club: Club }) {
  const bumps = useStock((s) => s.bumps);
  const usdcAdd = useStock((s) => s.usdcAdd);
  const stockAdd = useStock((s) => s.stockAdd);
  const joined = useStock((s) => s.joined);
  const minted = useStock((s) => s.minted);
  const wallet = useStock((s) => s.wallet);
  const join = useStock((s) => s.join);
  const openConnect = useStock((s) => s.openConnect);
  const member = joined.includes(club.ticker);
  const needsMint = club.membership === "collectible" && !minted.includes(club.ticker);
  const members = membersOf(club, bumps);
  const treasury = treasuryOf(club, usdcAdd, stockAdd);

  return (
    <article className="club-card">
      <Link
        to="/club/$ticker"
        params={{ ticker: club.ticker.toLowerCase() }}
        className="club-card-media"
      >
        <img src={club.cover} alt="" />
        <span className="club-card-shade" />
        <span className="club-card-mark">
          <Mark ticker={club.ticker} />
        </span>
      </Link>
      <div className="club-card-body">
        <div className="club-card-title">
          <Link to="/club/$ticker" params={{ ticker: club.ticker.toLowerCase() }}>
            {club.name}
          </Link>
          {club.stockSymbol ? <small className="paired-mini">{club.stockSymbol}</small> : null}
          {member ? <span className="dot-live" aria-label="Joined" /> : null}
        </div>
        <p className="muted">{club.tagline}</p>
        <div className="club-card-meta">
          <span>
            <Users size={14} /> {compact(members)}
          </span>
          <span>
            <Vault size={14} /> {money(treasury.total)}
          </span>
        </div>
        {member ? (
          <Link to="/club/$ticker" params={{ ticker: club.ticker.toLowerCase() }} className="btn btn-white">
            Open club <ArrowRight size={16} />
          </Link>
        ) : needsMint ? (
          <Link to="/club/$ticker" params={{ ticker: club.ticker.toLowerCase() }} className="btn btn-white">
            Mint to join <ArrowRight size={16} />
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-white"
            onClick={() => {
              if (!wallet) {
                openConnect();
                return;
              }
              join(club.ticker);
            }}
          >
            Join Club <ArrowRight size={16} />
          </button>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
